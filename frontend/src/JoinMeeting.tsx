import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft, ChevronDown, Video, VideoOff, Mic, MicOff, Volume2,
  Save, UserRound, FlipHorizontal2, RefreshCw, PhoneOff, Check,
} from 'lucide-react';
import { tokenStorage } from './api';

// Страница подключения: /dashboard/join?id=<meetingId>
// Логика: превью камеры (getUserMedia), выбор устройств, живой уровень микрофона
// (AnalyserNode), тест динамиков (WebAudio + setSinkId при поддержке),
// подключение → комната встречи → выход с завершением встречи в localStorage.

interface Meeting {
  id: string;
  title: string;
  date: string;
  time: string;
  host: string;
  participants: number;
  status: 'upcoming' | 'scheduled' | 'completed';
  dateTime?: string;
}

type DeviceState = 'loading' | 'ready' | 'denied' | 'missing' | 'error';

const STORAGE_MEETINGS = 'awareness-days-meetings';
const STORAGE_SETTINGS = 'awareness-days-device-settings';
const STORAGE_ACTIVE = 'awareness-days-active-meeting';

function errToState(e: unknown): DeviceState {
  const name = (e as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing';
  return 'error';
}

/* ---------- Выбор устройства (дропдаун в стилистике приложения) ---------- */
function DeviceSelect(props: {
  value: string;
  devices: MediaDeviceInfo[];
  onChange: (id: string) => void;
  fallback: string;
  disabled?: boolean;
}) {
  const { value, devices, onChange, fallback, disabled } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const current = devices.find((d) => d.deviceId === value);
  const label = current?.label || fallback;

  return (
    <div className="join-select" ref={ref}>
      <button
        type="button"
        className="form-input join-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="join-select-label">{label}</span>
        <ChevronDown size={20} className={`join-select-chevron ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="join-menu" role="listbox">
          {(devices.length ? devices : [{ deviceId: '', label: fallback } as MediaDeviceInfo]).map((d) => (
            <button
              key={d.deviceId || 'default'}
              type="button"
              role="option"
              aria-selected={d.deviceId === value}
              className={`join-menu-item ${d.deviceId === value ? 'selected' : ''}`}
              onClick={() => { onChange(d.deviceId); setOpen(false); }}
            >
              <span className="join-menu-item-label">{d.label || fallback}</span>
              {d.deviceId === value && <Check size={16} className="join-menu-check" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Переключатель ---------- */
function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      className={`join-switch ${props.checked ? 'on' : ''}`}
      onClick={() => props.onChange(!props.checked)}
    >
      <span className="join-switch-knob" />
    </button>
  );
}

/* ---------- Индикатор уровня микрофона ---------- */
function LevelMeter({ level, active }: { level: number; active: boolean }) {
  const SEGMENTS = 24;
  const lit = active ? Math.round(level * SEGMENTS) : 0;
  return (
    <div className="join-meter" aria-hidden="true">
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const isLit = i < lit;
        const tone = i >= SEGMENTS - 3 ? 'hot' : i >= SEGMENTS - 7 ? 'warn' : 'base';
        return <span key={i} className={`join-meter-seg ${isLit ? `lit ${tone}` : ''}`} />;
      })}
    </div>
  );
}

function JoinMeeting() {
  const [user] = useState({ id: 'test-id', displayName: 'Иван Ведущий', role: 'organizer' });
  const [meeting, setMeeting] = useState<Meeting | null>(null);

  // Устройства
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [camId, setCamId] = useState('');
  const [micId, setMicId] = useState('');
  const [speakerId, setSpeakerId] = useState('');

  // Состояния потоков
  const [camState, setCamState] = useState<DeviceState>('loading');
  const [micState, setMicState] = useState<DeviceState>('loading');
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [mirrored, setMirrored] = useState(true);
  const [volume, setVolume] = useState(80);
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(false);

  // Подключение / комната
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

  const previewRef = useRef<HTMLVideoElement>(null);
  const roomVideoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const micOnRef = useRef(true);
  const testGainRef = useRef<GainNode | null>(null);
  const testCleanupRef = useRef<(() => void) | null>(null);
  const testTimerRef = useRef<number | null>(null);
  const joinTimerRef = useRef<number | null>(null);

  const sinkSupported = typeof HTMLAudioElement !== 'undefined' && 'setSinkId' in HTMLAudioElement.prototype;

  useEffect(() => { micOnRef.current = micOn; }, [micOn]);

  /* ---------- Загрузка встречи и настроек ---------- */
  useEffect(() => {
    const list: Meeting[] = JSON.parse(localStorage.getItem(STORAGE_MEETINGS) || '[]');
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || localStorage.getItem(STORAGE_ACTIVE);
    const found = list.find((m) => m.id === id) || list.find((m) => m.status !== 'completed') || null;
    setMeeting(found);

    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_SETTINGS) || 'null');
      if (s) {
        if (typeof s.volume === 'number') setVolume(s.volume);
        if (typeof s.mirrored === 'boolean') setMirrored(s.mirrored);
        if (typeof s.camOn === 'boolean') setCamOn(s.camOn);
        if (typeof s.micOn === 'boolean') setMicOn(s.micOn);
      }
    } catch { /* повреждённые настройки игнорируем */ }
  }, []);

  /* ----------_devices ---------- */
  const refreshDevices = async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const c = all.filter((d) => d.kind === 'videoinput');
      const m = all.filter((d) => d.kind === 'audioinput');
      const s = all.filter((d) => d.kind === 'audiooutput');
      setCams(c); setMics(m); setSpeakers(s);
      setCamId((prev) => prev || c[0]?.deviceId || '');
      setMicId((prev) => prev || m[0]?.deviceId || '');
      setSpeakerId((prev) => prev || s[0]?.deviceId || '');
    } catch { /* enumerate недоступен — работаем с устройствами по умолчанию */ }
  };

  /* ---------- Камера ---------- */
  const stopVideo = () => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    videoStreamRef.current = null;
    setVideoStream(null);
  };

  const requestVideo = async (deviceId?: string) => {
    setCamState('loading');
    stopVideo();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw { name: 'Unsupported' };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      videoStreamRef.current = stream;
      stream.getVideoTracks().forEach((t) => { t.enabled = micOnRefSafe(camOn); });
      setVideoStream(stream);
      setCamState('ready');
      refreshDevices();
    } catch (e) {
      setCamState(errToState(e));
    }
  };

  // track.enabled выставляется отдельным эффектом после готовности
  const micOnRefSafe = (v: boolean) => v;

  useEffect(() => {
    videoStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = camOn; });
  }, [camOn, videoStream]);

  useEffect(() => {
    audioStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = micOn; });
  }, [micOn, audioStream]);

  /* ---------- Микрофон ---------- */
  const stopAudio = () => {
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    setAudioStream(null);
    setLevel(0);
  };

  const requestAudio = async (deviceId?: string) => {
    setMicState('loading');
    stopAudio();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw { name: 'Unsupported' };
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = stream;
      setAudioStream(stream);
      setMicState('ready');
      refreshDevices();
    } catch (e) {
      setMicState(errToState(e));
    }
  };

  /* ---------- Инициализация и очистка ---------- */
  useEffect(() => {
    requestVideo();
    requestAudio();
    const onDeviceChange = () => refreshDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
      if (joinTimerRef.current) window.clearTimeout(joinTimerRef.current);
      testCleanupRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Привязка потока к <video> ---------- */
  useEffect(() => {
    [previewRef.current, roomVideoRef.current].forEach((el) => {
      if (!el) return;
      el.srcObject = videoStream;
      if (videoStream) el.play().catch(() => { /* autoplay будет разрешён после жеста */ });
    });
  }, [videoStream, joined]);

  /* ---------- Живой уровень микрофона ---------- */
  useEffect(() => {
    if (!audioStream) { setLevel(0); return; }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const src = ctx.createMediaStreamSource(audioStream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let raf = 0;
    let last = 0;
    const loop = (t: number) => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      if (t - last > 80) {
        setLevel(micOnRef.current ? Math.min(1, rms * 3.4) : 0);
        last = t;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      ctx.close().catch(() => {});
    };
  }, [audioStream]);

  /* ---------- Тест динамиков ---------- */
  useEffect(() => {
    if (testGainRef.current) testGainRef.current.gain.value = (volume / 100) * 0.6;
  }, [volume]);

  const playTest = async () => {
    if (testing) return;
    setTesting(true);
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const gain = ctx.createGain();
    gain.gain.value = (volume / 100) * 0.6;
    testGainRef.current = gain;

    let routed: HTMLAudioElement | null = null;
    if (sinkSupported && speakerId) {
      try {
        const dest = ctx.createMediaStreamDestination();
        gain.connect(dest);
        routed = new Audio();
        routed.srcObject = dest.stream;
        await (routed as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(speakerId);
        await routed.play();
      } catch {
        routed = null;
      }
    }
    if (!routed) gain.connect(ctx.destination);

    const now = ctx.currentTime;
    [659.25, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.22;
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(env);
      env.connect(gain);
      osc.start(t);
      osc.stop(t + 0.22);
    });

    testCleanupRef.current = () => {
      routed?.pause();
      testGainRef.current = null;
      ctx.close().catch(() => {});
    };
    testTimerRef.current = window.setTimeout(() => {
      testCleanupRef.current?.();
      testCleanupRef.current = null;
      setTesting(false);
    }, 750);
  };

  /* ---------- Подключение ---------- */
  const handleJoin = () => {
    if (joining || joined) return;
    setJoining(true);
    localStorage.setItem(STORAGE_SETTINGS, JSON.stringify({ camOn, micOn, mirrored, volume, camId, micId, speakerId }));
    if (meeting) localStorage.setItem(STORAGE_ACTIVE, meeting.id);
    joinTimerRef.current = window.setTimeout(() => {
      setJoined(true);
      setJoining(false);
      setElapsed(0);
    }, 900);
  };

  useEffect(() => {
    if (!joined) return;
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [joined]);

  const stopAll = () => {
    videoStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
    testCleanupRef.current?.();
  };

  const goBack = () => { stopAll(); window.location.href = '/dashboard'; };

  const leaveMeeting = () => {
    stopAll();
    if (meeting) {
      const list: Meeting[] = JSON.parse(localStorage.getItem(STORAGE_MEETINGS) || '[]');
      localStorage.setItem(STORAGE_MEETINGS, JSON.stringify(
        list.map((m) => (m.id === meeting.id ? { ...m, status: 'completed' as const } : m)),
      ));
      localStorage.removeItem(STORAGE_ACTIVE);
    }
    window.location.href = '/dashboard';
  };

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const camReady = camState === 'ready';
  const micReady = micState === 'ready';

  const deviceBanner = (kind: 'cam' | 'mic', state: DeviceState, retry: () => void) => {
    if (state === 'loading') {
      return (
        <div className="join-preview-center">
          <span className="loader" />
          <p className="join-preview-note">Запрашиваем доступ…</p>
        </div>
      );
    }
    const text =
      state === 'denied' ? `Нет доступа к ${kind === 'cam' ? 'камере' : 'микрофону'}` :
      state === 'missing' ? `${kind === 'cam' ? 'Камера' : 'Микрофон'} не найден${kind === 'cam' ? 'а' : ''}` :
      'Устройство недоступно';
    const hint =
      state === 'denied' ? 'Разрешите доступ в настройках браузера и повторите попытку' :
      'Подключите устройство или продолжите без него';
    return (
      <div className="join-preview-center">
        {kind === 'cam' ? <VideoOff size={40} className="join-preview-glyph" /> : <MicOff size={40} className="join-preview-glyph" />}
        <p className="join-preview-title">{text}</p>
        <p className="join-preview-note">{hint}</p>
        <button type="button" className="join-retry" onClick={retry}>
          <RefreshCw size={15} />
          <span>Повторить</span>
        </button>
      </div>
    );
  };

  /* ================= КОМНАТА ВСТРЕЧИ ================= */
  if (joined) {
    return (
      <div className="dash-page">
        <header className="dash-header">
          <div className="dash-brand">
            <svg className="dash-brand-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8V36C0 38.1217 0.842855 40.1566 2.34315 41.6569C3.84344 43.1571 5.87827 44 8 44H36C38.1217 44 40.1566 43.1571 41.6569 41.6569C43.1571 40.1566 44 38.1217 44 36V8C44 5.87827 43.1571 3.84344 41.6569 2.34315C40.1566 0.842855 38.1217 0 36 0H8ZM7 15.522C7 14.392 7.916 13.478 9.046 13.478H24.046C25.3116 13.478 26.5254 13.9808 27.4203 14.8757C28.3152 15.7706 28.818 16.9844 28.818 18.25V28.478C28.818 29.606 27.902 30.522 26.772 30.522H11.772C10.5064 30.522 9.29261 30.0192 8.39769 29.1243C7.50276 28.2294 7 27.0156 7 25.75V15.522ZM35.364 14.022C35.516 13.9078 35.6968 13.8382 35.8862 13.8211C36.0756 13.804 36.266 13.8401 36.436 13.9253C36.6059 14.0105 36.7488 14.1415 36.8484 14.3034C36.9481 14.4653 37.0006 14.6519 37 14.842V29.158C37.0006 29.3481 36.9481 29.5347 36.8484 29.6966C36.7488 29.8585 36.6059 29.9895 36.436 30.0747C36.266 30.1599 36.0756 30.196 35.8862 30.1789C35.6968 30.1618 35.516 30.0922 35.364 29.978L31 26.702C30.7454 26.512 30.5386 26.2651 30.3963 25.9811C30.2539 25.6971 30.1798 25.3837 30.18 25.066V18.93C30.18 18.286 30.484 17.68 31 17.294L35.364 14.022Z" fillRule="evenodd" clipRule="evenodd" fill="#3474EC" />
            </svg>
            <span className="dash-brand-text">Цифровые дни</span>
          </div>
          <div className="dash-user" onClick={() => { stopAll(); tokenStorage.clear(); window.location.href = '/role'; }} title="Выйти">
            <div className="dash-avatar">{user.displayName.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <main className="dash-content join-content">
          <div className="create-top">
            <button className="back-link" onClick={leaveMeeting}>
              <ChevronLeft size={20} />
              <span>Покинуть встречу</span>
            </button>
            <h1 className="create-title">{meeting?.title || 'Встреча'}</h1>
            <p className="create-subtitle">Вы подключены · ведущий: {meeting?.host || user.displayName}</p>
          </div>

          <div className="room-card">
            <div className="room-stage">
              {camReady && camOn ? (
                <video ref={roomVideoRef} autoPlay playsInline muted className={`room-video ${mirrored ? 'mirrored' : ''}`} />
              ) : (
                <div className="room-avatar">
                  <span className="room-avatar-circle">{user.displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="room-topbar">
                <span className="room-live"><span className="room-live-dot" />В эфире</span>
                <span className="room-timer">{fmt(elapsed)}</span>
              </div>
              <div className="room-namechip">
                {micOn && micReady ? <Mic size={14} /> : <MicOff size={14} className="room-chip-muted" />}
                <span>{user.displayName} (вы)</span>
              </div>
              <div className="room-waiting">
                <span>Ожидаем участников</span>
                <span className="room-dots"><i /><i /><i /></span>
              </div>
            </div>

            <div className="room-controls">
              <button
                type="button"
                className={`room-round ${micOn && micReady ? '' : 'off'}`}
                title={micOn ? 'Выключить микрофон' : 'Включить микрофон'}
                onClick={() => (micReady ? setMicOn(!micOn) : requestAudio(micId || undefined))}
              >
                {micOn && micReady ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              <button
                type="button"
                className={`room-round ${camOn && camReady ? '' : 'off'}`}
                title={camOn ? 'Выключить камеру' : 'Включить камеру'}
                onClick={() => (camReady ? setCamOn(!camOn) : requestVideo(camId || undefined))}
              >
                {camOn && camReady ? <Video size={20} /> : <VideoOff size={20} />}
              </button>
              <button type="button" className="dash-btn-primary dash-btn-danger" onClick={leaveMeeting}>
                <PhoneOff size={18} />
                <span>Завершить</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ================= ПРОВЕРКА ОБОРУДОВАНИЯ ================= */
  return (
    <div className="dash-page">
      <header className="dash-header">
        <div className="dash-brand">
          <svg className="dash-brand-icon" width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 0C5.87827 0 3.84344 0.842855 2.34315 2.34315C0.842855 3.84344 0 5.87827 0 8V36C0 38.1217 0.842855 40.1566 2.34315 41.6569C3.84344 43.1571 5.87827 44 8 44H36C38.1217 44 40.1566 43.1571 41.6569 41.6569C43.1571 40.1566 44 38.1217 44 36V8C44 5.87827 43.1571 3.84344 41.6569 2.34315C40.1566 0.842855 38.1217 0 36 0H8ZM7 15.522C7 14.392 7.916 13.478 9.046 13.478H24.046C25.3116 13.478 26.5254 13.9808 27.4203 14.8757C28.3152 15.7706 28.818 16.9844 28.818 18.25V28.478C28.818 29.606 27.902 30.522 26.772 30.522H11.772C10.5064 30.522 9.29261 30.0192 8.39769 29.1243C7.50276 28.2294 7 27.0156 7 25.75V15.522ZM35.364 14.022C35.516 13.9078 35.6968 13.8382 35.8862 13.8211C36.0756 13.804 36.266 13.8401 36.436 13.9253C36.6059 14.0105 36.7488 14.1415 36.8484 14.3034C36.9481 14.4653 37.0006 14.6519 37 14.842V29.158C37.0006 29.3481 36.9481 29.5347 36.8484 29.6966C36.7488 29.8585 36.6059 29.9895 36.436 30.0747C36.266 30.1599 36.0756 30.196 35.8862 30.1789C35.6968 30.1618 35.516 30.0922 35.364 29.978L31 26.702C30.7454 26.512 30.5386 26.2651 30.3963 25.9811C30.2539 25.6971 30.1798 25.3837 30.18 25.066V18.93C30.18 18.286 30.484 17.68 31 17.294L35.364 14.022Z" fillRule="evenodd" clipRule="evenodd" fill="#3474EC" />
          </svg>
          <span className="dash-brand-text">Цифровые дни</span>
        </div>
        <div className="dash-user" onClick={() => { stopAll(); tokenStorage.clear(); window.location.href = '/role'; }} title="Выйти">
          <div className="dash-avatar">{user.displayName.charAt(0).toUpperCase()}</div>
        </div>
      </header>

      <main className="dash-content join-content">
        <div className="create-top">
          <button className="back-link" onClick={goBack}>
            <ChevronLeft size={20} />
            <span>Вернуться назад</span>
          </button>
          <h1 className="create-title">Проверка оборудования</h1>
          <p className="create-subtitle">Настройте звук и видео перед подключением</p>
        </div>

        <div className="join-card">
          {/* ===== Левая колонка: камера ===== */}
          <div className="join-col">
            <div className="join-section-head">
              <span className="join-section-icon"><Video size={20} /></span>
              <h2>Камера</h2>
            </div>

            <div className="join-preview">
              {camReady && camOn ? (
                <>
                  <video ref={previewRef} autoPlay playsInline muted className={`join-video ${mirrored ? 'mirrored' : ''}`} />
                  <div className="join-namechip">
                    {micOn && micReady ? <Mic size={13} /> : <MicOff size={13} className="room-chip-muted" />}
                    <span>{user.displayName} (вы)</span>
                  </div>
                </>
              ) : camReady && !camOn ? (
                <div className="join-preview-center">
                  <UserRound size={96} strokeWidth={1.6} className="join-preview-glyph" />
                  <p className="join-preview-note">Камера выключена</p>
                </div>
              ) : (
                deviceBanner('cam', camState, () => requestVideo(camId || undefined))
              )}
            </div>

            <div className="join-controls">
              <div className="join-switch-row">
                <Toggle
                  checked={camOn && camReady}
                  disabled={camState === 'loading'}
                  label="Камера"
                  onChange={(v) => (camReady ? setCamOn(v) : v && requestVideo(camId || undefined))}
                />
                {camOn && camReady ? <Video size={18} className="join-state-icon on" /> : <VideoOff size={18} className="join-state-icon" />}
                <span className="join-switch-label">{camOn && camReady ? 'Камера включена' : 'Камера выключена'}</span>
              </div>
              <button
                type="button"
                className={`join-icon-btn ${mirrored ? 'active' : ''}`}
                title="Зеркальное отображение"
                aria-pressed={mirrored}
                onClick={() => setMirrored((m) => !m)}
              >
                <FlipHorizontal2 size={18} />
              </button>
            </div>

            <div className="join-field">
              <label className="join-field-label">Устройство камеры</label>
              <DeviceSelect
                value={camId}
                devices={cams}
                fallback="Камера по умолчанию"
                onChange={(id) => { setCamId(id); requestVideo(id || undefined); }}
              />
            </div>
          </div>

          {/* ===== Разделитель ===== */}
          <div className="join-divider" aria-hidden="true" />

          {/* ===== Правая колонка: звук ===== */}
          <div className="join-col">
            <div className="join-group">
              <div className="join-section-head">
                <span className="join-section-icon"><Mic size={20} /></span>
                <h2>Микрофон</h2>
              </div>

              <div className="join-field">
                <label className="join-field-label">Устройство микрофона</label>
                <DeviceSelect
                  value={micId}
                  devices={mics}
                  fallback="Микрофон по умолчанию"
                  onChange={(id) => { setMicId(id); requestAudio(id || undefined); }}
                />
              </div>

              <div className="join-field">
                <div className="join-meter-head">
                  <label className="join-field-label">Уровень сигнала</label>
                  <span className="join-meter-value">
                    {micReady && micOn ? `${Math.round(level * 100)}%` : '—'}
                  </span>
                </div>
                <LevelMeter level={level} active={micReady && micOn} />
                <p className="join-hint">
                  {micState === 'loading' && 'Запрашиваем доступ к микрофону…'}
                  {micState === 'denied' && 'Нет доступа к микрофону — разрешите его в браузере.'}
                  {micState === 'missing' && 'Микрофон не найден — подключите устройство.'}
                  {micState === 'error' && 'Микрофон недоступен в этом браузере.'}
                  {micReady && micOn && 'Скажите что-нибудь — индикатор должен реагировать.'}
                  {micReady && !micOn && 'Микрофон выключен.'}
                </p>
                {(micState === 'denied' || micState === 'missing' || micState === 'error') && (
                  <button type="button" className="join-retry" onClick={() => requestAudio(micId || undefined)}>
                    <RefreshCw size={15} />
                    <span>Повторить</span>
                  </button>
                )}
              </div>

              <div className="join-switch-row">
                <Toggle
                  checked={micOn && micReady}
                  disabled={micState === 'loading'}
                  label="Микрофон"
                  onChange={(v) => (micReady ? setMicOn(v) : v && requestAudio(micId || undefined))}
                />
                {micOn && micReady ? <Mic size={18} className="join-state-icon on" /> : <MicOff size={18} className="join-state-icon" />}
                <span className="join-switch-label">{micOn && micReady ? 'Микрофон включён' : 'Микрофон выключен'}</span>
              </div>
            </div>

            <div className="join-group join-group-separated">
              <div className="join-section-head">
                <span className="join-section-icon"><Volume2 size={20} /></span>
                <h2>Динамики</h2>
              </div>

              <div className="join-field">
                <label className="join-field-label">Устройство вывода</label>
                <DeviceSelect
                  value={speakerId}
                  devices={speakers}
                  fallback="Динамики по умолчанию"
                  disabled={!sinkSupported}
                  onChange={setSpeakerId}
                />
                {!sinkSupported && (
                  <p className="join-hint">Этот браузер не поддерживает выбор динамиков — используется системное устройство.</p>
                )}
              </div>

              <div className="join-field">
                <div className="join-meter-head">
                  <label className="join-field-label" htmlFor="join-volume">Громкость</label>
                  <span className="join-meter-value">{volume}%</span>
                </div>
                <div className="join-volume-row">
                  <Volume2 size={18} className="join-state-icon on" />
                  <input
                    id="join-volume"
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    className="join-range"
                    style={{ background: `linear-gradient(90deg, #3474EC ${volume}%, #E5E7EB ${volume}%)` }}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                </div>
              </div>

              <button type="button" className={`join-test-btn ${testing ? 'playing' : ''}`} onClick={playTest} disabled={testing}>
                {testing ? (
                  <>
                    <span className="join-eq"><i /><i /><i /></span>
                    <span>Воспроизведение…</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={18} />
                    <span>Проверить звук</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="join-actions">
          <button type="button" className="dash-btn-primary" onClick={handleJoin} disabled={joining}>
            {joining ? <span className="loader small" /> : <Save size={18} />}
            <span>{joining ? 'Подключение…' : 'Подключиться к встрече'}</span>
          </button>
        </div>
      </main>
    </div>
  );
}

export default JoinMeeting;