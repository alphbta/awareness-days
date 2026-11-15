package internal

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type User struct {
	ID          string `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName"`
	Role        string `json:"role"`
}

type MeetingHost struct {
	ID          string `json:"id"`
	DisplayName string `json:"displayName"`
}

type Meeting struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Description string      `json:"description"`
	StartsAt    time.Time   `json:"startsAt"`
	Host        MeetingHost `json:"host"`
	Link        string      `json:"link"`
	CreatedAt   time.Time   `json:"createdAt"`
}

type Claims struct {
	UserID string `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type ctxKey string

const userKey ctxKey = "user"
