package schemas

import "time"

type CreateMeetingRequest struct {
	Title       string    `json:"title" example:"День информирования: кибербезопасность"`
	Description string    `json:"description" example:"Разбираем основные угрозы и способы защиты"`
	StartsAt    time.Time `json:"startsAt" example:"2026-12-01T10:00:00+05:00"`
	HostID      string    `json:"hostId" example:"3f1c0c3e-6a3b-4c53-9d63-3a0f8d3c3a11"`
}
