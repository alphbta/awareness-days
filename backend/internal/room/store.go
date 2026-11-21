package room

import "context"

type Store interface {
	Save(ctx context.Context, meetingID string, m Message) (Message, error)
	Recent(ctx context.Context, meetingID string, ch Channel, limit int) ([]Message, error)
}
