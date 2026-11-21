package room

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

type Channel string

const (
	ChannelChat      Channel = "chat"
	ChannelQuestions Channel = "questions"
)

var Channels = []Channel{ChannelChat, ChannelQuestions}

func (c Channel) Valid() bool { return c == ChannelChat || c == ChannelQuestions }

const MaxTextLen = 2000

var (
	ErrUnknownChannel = errors.New("unknown channel (use \"chat\" or \"questions\")")
	ErrEmptyText      = errors.New("text is empty")
	ErrTextTooLong    = errors.New("text is too long (max 2000 chars)")
	ErrRateLimited    = errors.New("too many messages, slow down")
)

type Author struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
}

type Message struct {
	ID        string    `json:"id"`
	Channel   Channel   `json:"channel"`
	Author    Author    `json:"author"`
	Text      string    `json:"text"`
	CreatedAt time.Time `json:"createdAt"`
}

type Incoming struct {
	Channel Channel `json:"channel"`
	Text    string  `json:"text"`
}

func (in *Incoming) Validate() error {
	if !in.Channel.Valid() {
		return ErrUnknownChannel
	}
	in.Text = strings.TrimSpace(in.Text)
	if in.Text == "" {
		return ErrEmptyText
	}
	if utf8.RuneCountInString(in.Text) > MaxTextLen {
		return ErrTextTooLong
	}
	return nil
}

const (
	EventHistory = "history"
	EventMessage = "message"
	EventError   = "error"
)

type Event struct {
	Type     string    `json:"type"`
	Channel  Channel   `json:"channel,omitempty"`
	Message  *Message  `json:"message,omitempty"`
	Messages []Message `json:"messages,omitempty"`
	Error    string    `json:"error,omitempty"`
}
