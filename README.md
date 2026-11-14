# Цифровые дни информирования

Проект состоит из Go API, PostgreSQL и React frontend.

## Запуск

### 1. Запустить базу данных

Из корня проекта:

```bash
docker compose up -d
```

### 2. Запустить backend

```bash
cd backend
go run ./cmd/api
```

Backend по умолчанию слушает `http://localhost:8080`.

При необходимости создайте `backend/.env`:

```env
DATABASE_URL=postgres://app:app@localhost:5432/awareness_days?sslmode=disable
JWT_SECRET=replace-this-secret
API_ADDR=:8080
WEB_ORIGIN=http://localhost:5173
```

### 3. Запустить frontend

В отдельном терминале:

```bash
cd frontend
npm install
npm run dev
```

Откройте `http://localhost:5173`.

Vite проксирует `/api` и `/healthz` на `http://localhost:8080`.
Если backend находится на другом адресе, создайте `frontend/.env` на основе `.env.example` и укажите `VITE_API_URL`.

## Что реализовано

- Вход по электронной почте и паролю.
- Регистрация с именем, электронной почтой и паролем.
- Проверка введённых данных на клиенте.
- Отображение ошибок backend.
- Показ/скрытие пароля.
- Сохранение JWT и восстановление сессии через `GET /api/me`.
- Выход из аккаунта.
- Адаптивная вёрстка для компьютеров, планшетов и телефонов.

## API, с которым работает frontend

- `POST /api/auth/login` — `{ "email": "...", "password": "..." }`
- `POST /api/auth/register` — `{ "email": "...", "password": "...", "displayName": "..." }`
- `GET /api/me` — заголовок `Authorization: Bearer <token>`

Для регистрации backend требует пароль длиной не менее 10 символов.
