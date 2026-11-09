package internal

import (
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	JWTSecret string
}

type API struct {
	db  *pgxpool.Pool
	cfg Config
}

func NewAPI(db *pgxpool.Pool, cfg Config) *API {
	if cfg.JWTSecret == "" {
		log.Println("WARNING: JWT_SECRET is empty; tokens will be signed with an empty key")
	}
	return &API{db: db, cfg: cfg}
}
