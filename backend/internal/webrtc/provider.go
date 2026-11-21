package webrtc

import (
	"time"

	"github.com/livekit/protocol/auth"
)

type LiveKitProvider struct {
	apiKey, apiSecret, serverURL string
}

func NewLiveKitProvider(apiKey, apiSecret, serverURL string) *LiveKitProvider {
	return &LiveKitProvider{apiKey: apiKey, apiSecret: apiSecret, serverURL: serverURL}
}

func (p *LiveKitProvider) Token(roomName, identity, displayName string, canPublish bool) (string, string, error) {
	subscribe := true
	token, err := auth.NewAccessToken(p.apiKey, p.apiSecret).
		SetIdentity(identity).
		SetName(displayName).
		SetValidFor(4 * time.Hour).
		SetVideoGrant(&auth.VideoGrant{
			RoomJoin:     true,
			Room:         roomName,
			CanPublish:   &canPublish,
			CanSubscribe: &subscribe,
		}).ToJWT()
	if err != nil {
		return "", "", err
	}
	return token, p.serverURL, nil
}
