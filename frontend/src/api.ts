import type { AuthResponse, User } from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'awareness-days-token';

interface ApiErrorBody {
  error?: string;
  message?: string;
}

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY),
  set: (token: string, remember = true) => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errorBody = body as ApiErrorBody | null;
    const message = errorBody?.error || errorBody?.message || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
    throw new Error(translateError(message));
  }

  return body as T;
}

function translateError(message: string): string {
  const known: Record<string, string> = {
    'invalid email or password': 'Неверная почта или пароль.',
    'email already registered': 'Пользователь с такой почтой уже зарегистрирован.',
    'email, displayName and password (10+ chars) are required': 'Заполните все поля. Пароль должен содержать не менее 10 символов.',
    'unauthorized': 'Сессия завершена. Войдите снова.',
    'user not found': 'Пользователь не найден.',
  };
  return known[message] ?? message;
}

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, displayName: string) =>
    request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    }),

  me: () => request<User>('/api/me'),

  health: async () => {
    const response = await fetch(`${API_URL}/healthz`);
    return response.ok;
  },
};