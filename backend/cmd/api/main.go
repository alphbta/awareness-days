package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"backend/internal"
	"backend/internal/webrtc"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	ctx := context.Background()

	db, err := pgxpool.New(ctx, env("DATABASE_URL", "postgres://app:app@localhost:5432/awareness_days?sslmode=disable"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(ctx); err != nil {
		log.Fatal(err)
	}

	cfg := internal.Config{
		JWTSecret: env("JWT_SECRET", "change-me-in-production"),
		PublicURL: env("WEB_ORIGIN", "http://localhost:5173"),
	}

	if key, secret, url := os.Getenv("LIVEKIT_API_KEY"), os.Getenv("LIVEKIT_API_SECRET"), os.Getenv("LIVEKIT_URL"); key != "" && secret != "" && url != "" {
		cfg.Video = webrtc.NewLiveKitProvider(key, secret, url)
	}
	api := internal.NewAPI(db, cfg)

	srv := &http.Server{
		Addr:              env("API_ADDR", ":8080"),
		Handler:           api.Router(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	go func() {
		log.Printf("API listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = srv.Shutdown(shutdown)
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
