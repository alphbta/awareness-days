package room

import (
	"encoding/json"
	"sync"
	"time"
)

const sendBuffer = 64

type Client struct {
	Author Author
	Send   chan []byte

	done chan struct{}
	once sync.Once

	mu     sync.Mutex
	tokens float64
	last   time.Time
}

const (
	rateBurst  = 5
	rateRefill = 500 * time.Millisecond
)

func NewClient(a Author) *Client {
	return &Client{
		Author: a,
		Send:   make(chan []byte, sendBuffer),
		done:   make(chan struct{}),
		tokens: rateBurst,
		last:   time.Now(),
	}
}

func (c *Client) Done() <-chan struct{} { return c.done }

func (c *Client) Close() { c.once.Do(func() { close(c.done) }) }

func (c *Client) TrySend(b []byte) bool {
	select {
	case <-c.done:
		return false
	default:
	}
	select {
	case c.Send <- b:
		return true
	default:
		return false
	}
}

func (c *Client) SendEvent(e Event) bool { return c.TrySend(MarshalEvent(e)) }

func (c *Client) Allow() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	c.tokens += float64(now.Sub(c.last)) / float64(rateRefill)
	if c.tokens > rateBurst {
		c.tokens = rateBurst
	}
	c.last = now
	if c.tokens < 1 {
		return false
	}
	c.tokens--
	return true
}

func MarshalEvent(e Event) []byte {
	b, err := json.Marshal(e)
	if err != nil { // не должно случаться: все поля сериализуемы
		return []byte(`{"type":"error","error":"internal error"}`)
	}
	return b
}
