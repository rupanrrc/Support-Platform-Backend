# Backend (Support Platform)

Node.js + Express + MongoDB (Mongoose) + Socket.IO.

## Setup

1. Copy environment file:

```bash
cp .env.example .env
```

2. Set `MONGODB_URI` and long random values for `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` (minimum 32 characters each).

3. Install and run:

```bash
npm install
npm run dev
```

## Endpoints

### Health (STEP 2)

- `GET /health` — process health
- `GET /api/health` — API health

### Auth (STEP 4) — `/api/auth`

- `POST /api/auth/register` — bootstrap first **admin** without auth; afterwards **admin-only** (Bearer access token)
- `POST /api/auth/login` — returns `{ user, accessToken, refreshToken }`
- `POST /api/auth/logout` — body `{ refreshToken }`; blacklists refresh **jti**
- `POST /api/auth/refresh` — body `{ refreshToken }`; rotates refresh token (old **jti** blacklisted)
- `POST /api/auth/forgot-password` — body `{ email }`; always responds with generic message (no email enumeration)
- `POST /api/auth/reset-password` — body `{ token, password }`
- `GET /api/auth/me` — Bearer access token; returns `{ user }`

Password rules: **≥ 8 chars**, uppercase, lowercase, number, special character.

Configure optional SMTP in `.env` for real reset emails; without SMTP, reset links are **logged to the console in non-production**.

### Tickets & messages (STEP 5) — `/api/tickets`

All routes require `Authorization: Bearer <accessToken>` unless noted.

**Tickets**

- `GET /api/tickets` — role-scoped list (`status`, `priority`, `teamId`, `from`, `to`, pagination)
- `POST /api/tickets` — create (`customer`, `agent`, `admin`, `manager`; managers must send `customerId`)
- `GET /api/tickets/:ticketId` — detail
- `PATCH /api/tickets/:ticketId` — update fields (not status lifecycle; customers limited)
- `DELETE /api/tickets/:ticketId` — **admin only** (deletes messages first)
- `GET /api/tickets/:ticketId/history` — audit log entries for the ticket
- `PATCH /api/tickets/:ticketId/assign` — **agent/manager/admin** — body `{ agentId, teamId }`
- `PATCH /api/tickets/:ticketId/escalate` — **agent/manager/admin** — body `{ targetTeamId, reason }`
- `PATCH /api/tickets/:ticketId/resolve` — **agent/manager/admin** (assigned agent must be self for `agent`)
- `PATCH /api/tickets/:ticketId/reopen` — staff only
- `PATCH /api/tickets/:ticketId/close` — staff only
- `POST /api/tickets/:ticketId/watchers` — body `{ userId }`
- `DELETE /api/tickets/:ticketId/watchers/:userId` — remove watcher

**Messages** (nested under `/api/tickets/:ticketId/messages`)

- `GET /` — thread (`isInternal` hidden for customers)
- `POST /` — new message or internal note (customers cannot post internal notes)
- `POST /read` — mark visible messages as read for the current user
- `PATCH /:messageId` — edit own message within **10 minutes**
- `DELETE /:messageId` — **admin only**

Internal services used by mutations: `src/modules/auditlogs/auditlog.service.js`, `src/modules/notifications/notification.service.js`.

### Socket.IO (STEP 6)

Socket.IO shares the HTTP server (`server.js` → `attachSocketIO`). Client connects with the **same JWT** as REST:

```javascript
import { io } from "socket.io-client";
const socket = io(BASE_URL, { auth: { token: accessToken } });
```

**Rooms (auto on connect):** `user:{userId}`, `team:{teamId}` (if set), `role:admin`, `role:manager` (when applicable).

**Client → server**

| Event | Payload |
|-------|---------|
| `ticket:join` | `{ ticketId }` |
| `ticket:leave` | `{ ticketId }` |
| `message:typing` | `{ ticketId }` |
| `message:stop-typing` | `{ ticketId }` |
| `ticket:view` | `{ ticketId }` |

**Server → client**

| Event | Notes |
|-------|--------|
| `ticket:created` | Team + manager + admin rooms |
| `ticket:updated` | `ticket:{id}` room |
| `ticket:assigned` | `user:{agentId}` + `team:{teamId}` |
| `ticket:escalated` | Origin team, target team, `role:manager` |
| `ticket:resolved` | Ticket room + `user:{customerId}` |
| `ticket:status-changed` | Ticket room |
| `message:new` | Internal notes **not** sent to `ticket:{id}` (staff/team rooms only) |
| `message:typing` / `message:stop-typing` | Ticket room (excluding sender) |
| `notification:new` | `user:{userId}` only |
| `agent:online-status` | `team:{teamId}` on connect/disconnect |

REST mutations call emitters in `src/sockets/ticketSocket.js`, `messageSocket.js`, and `notificationSocket.js`. **SLA monitor** (`src/sockets/slaMonitor.js`, 60s interval) sets `slaBreached`, sets `slaWarningSent`, and creates `sla_breach_warning` notifications (which also emit over sockets).

### Users (STEP 7) — `/api/users`

- `GET /` — **admin/manager** (manager: own team only); filters `role`, `teamId`, `isActive`
- `POST /` — **admin** — create user
- `PATCH /me/profile` — update own profile
- `PATCH /me/password` — change own password
- `GET /:id` — get user (RBAC in service)
- `PATCH /:id` — **admin** — update user
- `DELETE /:id` — **admin** — soft deactivate
- `PATCH /:id/role` — **admin**
- `PATCH /:id/team` — **admin/manager**

### Teams (STEP 7) — `/api/teams`

- `GET /` — list teams (scoped for agent/manager)
- `POST /` — **admin** — create team
- `GET /:id` — team + members
- `PATCH /:id` — **admin/manager** (manager: own team)
- `DELETE /:id` — **admin** — deactivate
- `POST /:id/members` — body `{ userId }` — **admin/manager**
- `DELETE /:id/members/:uid` — **admin/manager**
- `GET /:id/queue` — open/escalated queue (`?status=escalated`)
- `GET /:id/stats` — team performance snapshot

### Notifications (STEP 7) — `/api/notifications`

- `GET /` — list for current user + `unreadCount`
- `PATCH /read-all` — mark all read
- `PATCH /:id/read` — mark one read
- `DELETE /:id` — delete notification

### Analytics (STEP 7) — `/api/analytics` (manager+)

- `GET /overview` — open, resolved, escalated, SLA-breached counts
- `GET /ticket-volume` — `from`, `to`, `groupBy=day|week|month`
- `GET /resolution-time` — avg by team/priority
- `GET /agent-performance` — leaderboard
- `GET /team-performance` — per-team stats
- `GET /sla` — compliance by team/priority
- `GET /categories` — counts by category

### Audit logs (STEP 7) — `/api/auditlogs` (admin)

- `GET /` — filters: `actorId`, `targetId`, `targetModel`, `action`, `from`, `to`
- `GET /:id` — single entry

### Seed data

```bash
npm run seed
```

Creates default team, admin, manager, agent, and customer (override via `SEED_*_EMAIL` / `SEED_*_PASSWORD` env vars).

## Data layer (STEP 3)

Mongoose models live under `src/modules/**` and are side-effect registered via `src/models/registerModels.js` after MongoDB connects (`src/config/db.js`).

| Model        | File |
|--------------|------|
| `User`       | `src/modules/users/user.model.js` |
| `Team`       | `src/modules/teams/team.model.js` |
| `Ticket`     | `src/modules/tickets/ticket.model.js` (+ `slaWarningSent` for SLA warnings) |
| `Message`    | `src/modules/messages/message.model.js` |
| `Notification` | `src/modules/notifications/notification.model.js` |
| `AuditLog`   | `src/modules/auditlogs/auditlog.model.js` |

Shared enums/constants: `src/constants/`.

## Scripts

- `npm run dev` — run with Node’s built-in file watcher
- `npm start` — production-style start
