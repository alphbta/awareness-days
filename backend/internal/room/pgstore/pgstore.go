package pgstore

import (
	"context"

	"backend/internal/room"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ db *pgxpool.Pool }

func New(db *pgxpool.Pool) *Store { return &Store{db: db} }

var _ room.Store = (*Store)(nil)

func (s *Store) Save(ctx context.Context, meetingID string, m room.Message) (room.Message, error) {
	err := s.db.QueryRow(ctx,
		`INSERT INTO chat_messages(meeting_id, channel, author_id, body)
		 VALUES($1,$2,$3,$4)
		 RETURNING id::text, created_at`,
		meetingID, string(m.Channel), m.Author.ID, m.Text,
	).Scan(&m.ID, &m.CreatedAt)
	return m, err
}

func (s *Store) Recent(ctx context.Context, meetingID string, ch room.Channel, limit int) ([]room.Message, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id::text, body, created_at, author_id::text, display_name, role FROM (
		     SELECT m.id, m.body, m.created_at, u.id AS author_id, u.display_name, u.role
		     FROM chat_messages m
		     JOIN users u ON u.id = m.author_id
		     WHERE m.meeting_id = $1 AND m.channel = $2
		     ORDER BY m.id DESC
		     LIMIT $3
		 ) t ORDER BY id ASC`,
		meetingID, string(ch), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	msgs := make([]room.Message, 0, limit)
	for rows.Next() {
		m := room.Message{Channel: ch}
		if err := rows.Scan(&m.ID, &m.Text, &m.CreatedAt, &m.Author.ID, &m.Author.DisplayName, &m.Author.Role); err != nil {
			return nil, err
		}
		msgs = append(msgs, m)
	}
	return msgs, rows.Err()
}
