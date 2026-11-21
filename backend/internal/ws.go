package internal

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"time"

	"backend/internal/room"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
)

const (
	wsReadLimit    = 8 << 10
	wsWriteTimeout = 5 * time.Second
	wsPingInterval = 30 * time.Second
)

// @Summary Комната встречи: чаты по WebSocket
// @Description Открывает WebSocket к комнате встречи ({token} последняя часть ссылки на встречу).
// @Description Браузер не умеет слать заголовки при WebSocket, поэтому JWT передаётся в query: `?token=<jwt>`.
// @Description
// @Description Клиент → сервер: `{"channel":"chat"|"questions","text":"..."}`.
// @Description Сервер → клиент: `{"type":"history","channel":"chat","messages":[...]}` (при входе, по одному на чат),
// @Description `{"type":"message","channel":"chat","message":{id,channel,author{id,displayName,role},text,createdAt}}`
// @Description и `{"type":"error","error":"..."}`.
// @Tags meetings
// @Security BearerAuth
// @Param token path string true "Токен из ссылки на встречу"
// @Success 101 "Switching Protocols"
// @Failure 401 "unauthorized"
// @Failure 404 "meeting not found"
// @Router /api/meetings/{token}/ws [get]
func (a *API) meetingWS(w http.ResponseWriter, r *http.Request) {
	claims := currentUser(r)

	var meetingID string
	err := a.db.QueryRow(r.Context(),
		`SELECT id::text FROM meetings WHERE link_token=$1`, chi.URLParam(r, "token"),
	).Scan(&meetingID)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 404, "meeting not found")
		return
	}
	if err != nil {
		writeError(w, 500, "could not load meeting")
		return
	}

	var author room.Author
	err = a.db.QueryRow(r.Context(),
		`SELECT id::text, display_name, role FROM users WHERE id=$1`, claims.UserID,
	).Scan(&author.ID, &author.DisplayName, &author.Role)
	if err != nil {
		writeError(w, 401, "user not found")
		return
	}

	rm, err := a.rooms.Acquire(r.Context(), meetingID)
	if err != nil {
		writeError(w, 500, "could not open room")
		return
	}
	defer a.rooms.Release(rm)

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: a.wsOriginPatterns(),
	})
	if err != nil {
		return // Accept уже ответил клиенту
	}
	defer conn.CloseNow()
	conn.SetReadLimit(wsReadLimit)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	client := room.NewClient(author)
	rm.Join(client)
	defer rm.Leave(client)
	defer client.Close()

	go wsWritePump(ctx, conn, client)
	wsReadPump(ctx, conn, rm, client)
}

func wsReadPump(ctx context.Context, conn *websocket.Conn, rm *room.Room, c *room.Client) {
	for {
		_, data, err := conn.Read(ctx)
		if err != nil {
			return
		}
		var in room.Incoming
		if err := json.Unmarshal(data, &in); err != nil {
			c.SendEvent(room.Event{Type: room.EventError, Error: "invalid json"})
			continue
		}
		if err := rm.Post(ctx, c, in); err != nil {
			msg := err.Error()
			if !isUserError(err) {
				msg = "could not send message"
			}
			c.SendEvent(room.Event{Type: room.EventError, Channel: in.Channel, Error: msg})
		}
	}
}

func wsWritePump(ctx context.Context, conn *websocket.Conn, c *room.Client) {
	ping := time.NewTicker(wsPingInterval)
	defer ping.Stop()
	for {
		select {
		case data := <-c.Send:
			wctx, cancel := context.WithTimeout(ctx, wsWriteTimeout)
			err := conn.Write(wctx, websocket.MessageText, data)
			cancel()
			if err != nil {
				conn.CloseNow()
				return
			}
		case <-ping.C:
			pctx, cancel := context.WithTimeout(ctx, wsWriteTimeout)
			err := conn.Ping(pctx)
			cancel()
			if err != nil {
				conn.CloseNow()
				return
			}
		case <-c.Done():
			conn.Close(websocket.StatusPolicyViolation, "connection is too slow")
			return
		case <-ctx.Done():
			return
		}
	}
}

func isUserError(err error) bool {
	return errors.Is(err, room.ErrUnknownChannel) || errors.Is(err, room.ErrEmptyText) ||
		errors.Is(err, room.ErrTextTooLong) || errors.Is(err, room.ErrRateLimited)
}

func (a *API) wsOriginPatterns() []string {
	if u, err := url.Parse(a.cfg.PublicURL); err == nil && u.Host != "" {
		return []string{u.Host}
	}
	return nil
}
