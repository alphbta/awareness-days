package internal

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"backend/internal/schemas"

	"github.com/jackc/pgx/v5"
)

const (
	maxTitleLen       = 200
	maxDescriptionLen = 5000
)

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func newLinkToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (a *API) meetingLink(token string) string {
	return strings.TrimRight(a.cfg.PublicURL, "/") + "/meetings/" + token
}

// @Summary Создать встречу
// @Description Только для пользователей с ролью organizer. Ссылка на встречу генерируется на бэкенде.
// @Tags meetings
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param meeting body schemas.CreateMeetingRequest true "Данные встречи"
// @Success 201 {object} schemas.Meeting
// @Failure 400 "invalid json / title is required / startsAt must be in the future / host not found"
// @Failure 401 "unauthorized"
// @Failure 403 "only organizers can create meetings"
// @Failure 500 "could not create meeting"
// @Router /api/meetings [post]
func (a *API) createMeeting(w http.ResponseWriter, r *http.Request) {
	c := currentUser(r)
	if c.Role != "organizer" {
		writeError(w, 403, "only organizers can create meetings")
		return
	}

	var in schemas.CreateMeetingRequest
	if decode(r, &in) != nil {
		writeError(w, 400, "invalid json")
		return
	}
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	in.HostID = strings.TrimSpace(in.HostID)

	switch {
	case in.Title == "":
		writeError(w, 400, "title is required")
		return
	case utf8.RuneCountInString(in.Title) > maxTitleLen:
		writeError(w, 400, "title is too long (max 200 chars)")
		return
	case utf8.RuneCountInString(in.Description) > maxDescriptionLen:
		writeError(w, 400, "description is too long (max 5000 chars)")
		return
	case in.StartsAt.IsZero():
		writeError(w, 400, "startsAt is required (RFC 3339)")
		return
	case !in.StartsAt.After(time.Now()):
		writeError(w, 400, "startsAt must be in the future")
		return
	case !uuidRe.MatchString(in.HostID):
		writeError(w, 400, "host not found")
		return
	}

	var host MeetingHost
	err := a.db.QueryRow(r.Context(),
		`SELECT id::text, display_name FROM users WHERE id=$1 AND role='organizer'`, in.HostID,
	).Scan(&host.ID, &host.DisplayName)
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 400, "host not found")
		return
	}
	if err != nil {
		writeError(w, 500, "could not create meeting")
		return
	}

	token, err := newLinkToken()
	if err != nil {
		writeError(w, 500, "could not create meeting")
		return
	}

	m := Meeting{Host: host}
	err = a.db.QueryRow(r.Context(),
		`INSERT INTO meetings(title, description, starts_at, host_id, created_by, link_token)
		 VALUES($1,$2,$3,$4,$5,$6)
		 RETURNING id::text, title, description, starts_at, created_at`,
		in.Title, in.Description, in.StartsAt, host.ID, c.UserID, token,
	).Scan(&m.ID, &m.Title, &m.Description, &m.StartsAt, &m.CreatedAt)
	if err != nil {
		writeError(w, 500, "could not create meeting")
		return
	}
	m.Link = a.meetingLink(token)
	writeJSON(w, 201, m)
}

// @Summary Список созданных встреч
// @Description Отсортирован по дате начала (ближайшие первыми).
// @Tags meetings
// @Security BearerAuth
// @Produce json
// @Success 200 {array} schemas.Meeting
// @Failure 401 "unauthorized"
// @Failure 500 "could not load meetings"
// @Router /api/meetings [get]
func (a *API) listMeetings(w http.ResponseWriter, r *http.Request) {
	rows, err := a.db.Query(r.Context(),
		`SELECT m.id::text, m.title, m.description, m.starts_at, m.created_at, m.link_token,
		        u.id::text, u.display_name
		 FROM meetings m
		 JOIN users u ON u.id = m.host_id
		 ORDER BY m.starts_at ASC, m.created_at ASC`)
	if err != nil {
		writeError(w, 500, "could not load meetings")
		return
	}
	defer rows.Close()

	meetings := make([]Meeting, 0)
	for rows.Next() {
		var m Meeting
		var token string
		if err := rows.Scan(&m.ID, &m.Title, &m.Description, &m.StartsAt, &m.CreatedAt, &token,
			&m.Host.ID, &m.Host.DisplayName); err != nil {
			writeError(w, 500, "could not load meetings")
			return
		}
		m.Link = a.meetingLink(token)
		meetings = append(meetings, m)
	}
	if rows.Err() != nil {
		writeError(w, 500, "could not load meetings")
		return
	}
	writeJSON(w, 200, meetings)
}
