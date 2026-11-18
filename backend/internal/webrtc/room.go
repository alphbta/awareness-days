package webrtc

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/livekit/protocol/auth"
)

const (
	apiKey    = "devkey"
	apiSecret = "secret"
	serverURL = "http://127.0.0.1:7880"
	wsURL     = "ws://127.0.0.1:7880"
)

func TokenHandler(w http.ResponseWriter, r *http.Request) {
	roomName := r.URL.Query().Get("room")
	identity := r.URL.Query().Get("identity")
	if roomName == "" || identity == "" {
		http.Error(w, "нужен параметр room identity", http.StatusBadRequest)
		return
	}

	at := auth.NewAccessToken(apiKey, apiSecret).
		SetIdentity(identity).
		SetVideoGrant(&auth.VideoGrant{
			RoomJoin: true,
			Room:     roomName,
		})

	token, err := at.ToJWT()
	if err != nil {
		log.Printf("ошибка создания JWT: %v", err)
		http.Error(w, "не удалось создать токен", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"token":     token,
		"serverUrl": wsURL,
		"identity":  identity,
	})
}

/*
func RecordHandler(w http.ResponseWriter, r *http.Request) {
	roomName := r.URL.Query().Get("room")
	if roomName == "" {
		http.Error(w, "нужен параметр room", http.StatusBadRequest)
		return
	}

	egressClient := lksdk.NewEgressClient(serverURL, apiKey, apiSecret)

	req := &livekit.RoomCompositeEgressRequest{
		RoomName: roomName,
		Layout:   "grid",
		FileOutputs: []*livekit.EncodedFileOutput{
			{
				FileType: livekit.EncodedFileType_MP4,
				// в перспективе надо сделать s3 хранилище
				Filepath: fmt.Sprintf("/out/%s-%d.mp4", roomName, time.Now().Unix()),
			},
		},
	}

	info, err := egressClient.StartRoomCompositeEgress(context.Background(), req)
	if err != nil {
		log.Printf("ошибка запуска записи: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("запись запущена: EgressID=%s", info.EgressId)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"egressId": info.EgressId,
		"status":   "started",
	})
}

func WebhookHandler(w http.ResponseWriter, r *http.Request) {
	authProvider := auth.NewSimpleKeyProvider(apiKey, apiSecret)

	event, err := webhook.ReceiveWebhookEvent(r, authProvider)
	if err != nil {
		log.Printf("не удалось проверить вебхук: %v", err)
		http.Error(w, "invalid webhook", http.StatusUnauthorized)
		return
	}

	if event.Event == "egress_ended" {
		log.Printf("Запись завершена! EgressID=%s", event.EgressInfo.EgressId)
	}
	//обработка других событий
	w.WriteHeader(http.StatusOK)
}

func StopRecordHandler(w http.ResponseWriter, r *http.Request) {
	egressID := r.URL.Query().Get("egressId")
	if egressID == "" {
		http.Error(w, "нужен параметр egressId", http.StatusBadRequest)
		return
	}

	egressClient := lksdk.NewEgressClient(serverURL, apiKey, apiSecret)
	info, err := egressClient.StopEgress(context.Background(), &livekit.StopEgressRequest{
		EgressId: egressID,
	})
	if err != nil {
		log.Printf("ошибка остановки записи: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("запись остановлена: EgressID=%s", info.EgressId)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"egressId": info.EgressId,
		"status":   "stopped",
	})
}
*/
