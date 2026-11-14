package internal

import (
	"backend/internal/schemas"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func (a *API) issueJWT(id, role string) (string, error) {
	c := Claims{
		UserID: id,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(12 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString([]byte(a.cfg.JWTSecret))
}

func (a *API) parseToken(raw string) (*Claims, error) {
	if raw == "" {
		return nil, errors.New("empty token")
	}
	t, err := jwt.ParseWithClaims(raw, &Claims{}, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(a.cfg.JWTSecret), nil
	})
	if err != nil {
		return nil, err
	}
	c, ok := t.Claims.(*Claims)
	if !ok || !t.Valid {
		return nil, errors.New("invalid token")
	}
	return c, nil
}

// @Summary Регистрация ведущего
// @Tags auth
// @Param user-data body schemas.RegisterRequest true "Логин, пароль и имя"
// @Success 201
// @Failure 400 "invalid json"
// @Failure 400 "email, displayName and password (10+ chars) are required"
// @Failure 500 "could not hash password"
// @Failure 409 "email already registered"
// @Router /api/auth/register [post]
func (a *API) register(w http.ResponseWriter, r *http.Request) {
	var in schemas.RegisterRequest

	if decode(r, &in) != nil {
		writeError(w, 400, "invalid json")
		return
	}
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))
	in.DisplayName = strings.TrimSpace(in.DisplayName)
	if in.Email == "" || len(in.Password) < 10 || in.DisplayName == "" {
		writeError(w, 400, "email, displayName and password (10+ chars) are required")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, 500, "could not hash password")
		return
	}
	var u User
	err = a.db.QueryRow(r.Context(),
		`INSERT INTO users(email,display_name,password_hash,role)
		 VALUES($1,$2,$3,'member')
		 RETURNING id::text,email,display_name,role`,
		in.Email, in.DisplayName, string(hash),
	).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role)
	if err != nil {
		writeError(w, 409, "email already registered")
		return
	}
	token, _ := a.issueJWT(u.ID, u.Role)
	writeJSON(w, 201, map[string]any{"user": u, "token": token})
}

// @Summary Вход ведущего
// @Tags auth
// @Param user-data body schemas.LoginRequest true "Логин и пароль"
// @Success 200
// @Failure 400 "invalid json"
// @Failure 401 "invalid email or password"
// @Router /api/auth/login [post]
func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var in schemas.LoginRequest

	if decode(r, &in) != nil {
		writeError(w, 400, "invalid json")
		return
	}
	var u User
	var hash string
	err := a.db.QueryRow(r.Context(),
		`SELECT id::text,email,display_name,role,password_hash FROM users WHERE email=$1`,
		strings.ToLower(strings.TrimSpace(in.Email)),
	).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role, &hash)
	if err != nil || bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password)) != nil {
		writeError(w, 401, "invalid email or password")
		return
	}
	token, _ := a.issueJWT(u.ID, u.Role)
	writeJSON(w, 200, map[string]any{"user": u, "token": token})
}

func (a *API) me(w http.ResponseWriter, r *http.Request) {
	c := currentUser(r)
	var u User
	err := a.db.QueryRow(r.Context(),
		`SELECT id::text,email,display_name,role FROM users WHERE id=$1`, c.UserID,
	).Scan(&u.ID, &u.Email, &u.DisplayName, &u.Role)
	if err != nil {
		writeError(w, 404, "user not found")
		return
	}
	writeJSON(w, 200, u)
}
