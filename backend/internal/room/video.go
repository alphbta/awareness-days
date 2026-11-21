package room

type VideoProvider interface {
	Token(roomName, identity, displayName string, canPublish bool) (token, serverURL string, err error)
}
