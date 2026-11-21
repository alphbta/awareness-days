package room

type Hub struct {
	channel Channel
	limit   int

	register   chan *Client
	unregister chan *Client
	broadcast  chan Message
	stop       chan struct{}
	done       chan struct{}

	clients map[*Client]struct{}
	recent  []Message
}

func NewHub(ch Channel, seed []Message, historyLimit int) *Hub {
	if historyLimit <= 0 {
		historyLimit = 100
	}
	if len(seed) > historyLimit {
		seed = seed[len(seed)-historyLimit:]
	}
	return &Hub{
		channel:    ch,
		limit:      historyLimit,
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan Message, 16),
		stop:       make(chan struct{}),
		done:       make(chan struct{}),
		clients:    make(map[*Client]struct{}),
		recent:     append(make([]Message, 0, historyLimit), seed...),
	}
}

func (h *Hub) Run() {
	defer close(h.done)
	for {
		select {
		case c := <-h.register:
			h.clients[c] = struct{}{}
			hist := make([]Message, len(h.recent))
			copy(hist, h.recent)
			c.SendEvent(Event{Type: EventHistory, Channel: h.channel, Messages: hist})

		case c := <-h.unregister:
			delete(h.clients, c)

		case m := <-h.broadcast:
			h.recent = append(h.recent, m)
			if len(h.recent) > h.limit {
				h.recent = append(h.recent[:0], h.recent[len(h.recent)-h.limit:]...)
			}
			data := MarshalEvent(Event{Type: EventMessage, Channel: h.channel, Message: &m})
			for c := range h.clients {
				if !c.TrySend(data) {
					delete(h.clients, c)
					c.Close()
				}
			}

		case <-h.stop:
			for c := range h.clients {
				delete(h.clients, c)
				c.Close()
			}
			return
		}
	}
}

func (h *Hub) Register(c *Client) {
	select {
	case h.register <- c:
	case <-h.done:
	}
}

func (h *Hub) Unregister(c *Client) {
	select {
	case h.unregister <- c:
	case <-h.done:
	}
}

func (h *Hub) Broadcast(m Message) {
	select {
	case h.broadcast <- m:
	case <-h.done:
	}
}

func (h *Hub) Stop() {
	select {
	case h.stop <- struct{}{}:
	case <-h.done:
	}
	<-h.done
}
