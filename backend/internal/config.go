package internal

import (
	"log"

	"backend/internal/room"
	"backend/internal/room/pgstore"

	"github.com/jackc/pgx/v5/pgxpool"
)

const chatHistoryLimit = 100

type Config struct {
	JWTSecret string
	PublicURL string
	Video     room.VideoProvider
}

type API struct {
	db    *pgxpool.Pool
	cfg   Config
	rooms *room.Manager
}

func NewAPI(db *pgxpool.Pool, cfg Config) *API {
	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT_SECRET is empty; tokens will be signed with an empty key")
	}
	return &API{
		db:    db,
		cfg:   cfg,
		rooms: room.NewManager(pgstore.New(db), cfg.Video, chatHistoryLimit),
	}
}
