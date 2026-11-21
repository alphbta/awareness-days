package room

import (
	"context"
	"sync"
	"time"
)

type Room struct {
	MeetingID string
	Chat      *Hub
	Questions *Hub
	Video     VideoProvider

	store Store
	refs  int
}

func (r *Room) Hub(ch Channel) *Hub {
	switch ch {
	case ChannelChat:
		return r.Chat
	case ChannelQuestions:
		return r.Questions
	}
	return nil
}

func (r *Room) VideoRoomName() string { return "meeting-" + r.MeetingID }

func (r *Room) Join(c *Client) {
	r.Chat.Register(c)
	r.Questions.Register(c)
}

func (r *Room) Leave(c *Client) {
	r.Chat.Unregister(c)
	r.Questions.Unregister(c)
}

func (r *Room) Post(ctx context.Context, c *Client, in Incoming) error {
	if err := in.Validate(); err != nil {
		return err
	}
	if !c.Allow() {
		return ErrRateLimited
	}
	saveCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	saved, err := r.store.Save(saveCtx, r.MeetingID, Message{
		Channel: in.Channel,
		Author:  c.Author,
		Text:    in.Text,
	})
	if err != nil {
		return err
	}
	r.Hub(in.Channel).Broadcast(saved)
	return nil
}

func (r *Room) stop() {
	r.Chat.Stop()
	r.Questions.Stop()
}

type Manager struct {
	store Store
	video VideoProvider
	limit int

	mu    sync.Mutex
	rooms map[string]*Room
}

func NewManager(store Store, video VideoProvider, historyLimit int) *Manager {
	return &Manager{store: store, video: video, limit: historyLimit, rooms: make(map[string]*Room)}
}

func (m *Manager) Acquire(ctx context.Context, meetingID string) (*Room, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if r, ok := m.rooms[meetingID]; ok {
		r.refs++
		return r, nil
	}

	seeds := make(map[Channel][]Message, len(Channels))
	for _, ch := range Channels {
		msgs, err := m.store.Recent(ctx, meetingID, ch, m.limit)
		if err != nil {
			return nil, err
		}
		seeds[ch] = msgs
	}
	r := &Room{
		MeetingID: meetingID,
		Chat:      NewHub(ChannelChat, seeds[ChannelChat], m.limit),
		Questions: NewHub(ChannelQuestions, seeds[ChannelQuestions], m.limit),
		Video:     m.video,
		store:     m.store,
		refs:      1,
	}
	go r.Chat.Run()
	go r.Questions.Run()
	m.rooms[meetingID] = r
	return r, nil
}

func (m *Manager) Release(r *Room) {
	m.mu.Lock()
	r.refs--
	last := r.refs == 0
	if last {
		delete(m.rooms, r.MeetingID)
	}
	m.mu.Unlock()
	if last {
		r.stop()
	}
}

func (m *Manager) Active() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.rooms)
}
