# WhatsApp AI Assessment Platform

Connects a WhatsApp number to the Grok AI (x.ai). Incoming WhatsApp messages get an automatic AI reply. All conversations are stored in PostgreSQL.

**Stack:** NestJS · BullMQ + Redis · PostgreSQL + Prisma · Baileys (WhatsApp) · Grok API

---

## How it works

```
Incoming:  WhatsApp message → queue → save to DB → Grok AI → save reply → send reply back
Outgoing:  POST /api/send-message → queue → save to DB → deliver via WhatsApp
```

---

## Quick start

### 1. Copy the env file and fill in your values

```bash
cp .env.example .env
```

Open `.env` — the values to set:

```
POSTGRES_USER=user
POSTGRES_PASSWORD=password
POSTGRES_DB=waai

# Must match POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB above
DATABASE_URL="postgresql://user:password@postgres:5432/waai"

GROK_API_KEY=xai-your-key-here   # from https://console.x.ai
```

### 2. Start everything

```bash
docker-compose up --build
```

Starts Postgres, Redis, and the app. Migrations run automatically.

### 3. Scan the QR code

```bash
docker-compose logs -f app
```

A QR code will appear. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device** → scan.

Session is saved in `./auth_info` — no re-scan needed on restart.

> The API works without WhatsApp connected — messages are saved to DB and delivered once connected.

---

## API

All routes are prefixed with `/api`.

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/send-message` | `{ phone, message }` | Queue a message to send |
| GET | `/api/conversations` | — | List all conversations |
| GET | `/api/messages/:conversationId` | — | Messages in a conversation |

**Send a message:**
```bash
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -d '{"phone": "919999999999", "message": "Hello!"}'
```

`phone` must be digits only with country code — no `+`, no spaces (e.g. `919999999999` for India).

**Response:**
```json
{ "status": "queued", "conversationId": "uuid-here" }
```

**Get messages:**
```bash
curl http://localhost:3000/api/messages/<conversationId>
```

---

## AI output

Each AI message has an `aiOutput` field:

| Field | Values |
|-------|--------|
| `classification` | `query` · `complaint` · `feedback` · `greeting` · `other` |
| `sentiment` | `positive` · `neutral` · `negative` |
| `raw` | Raw text from Grok before parsing |

---

## Bull Board — Queue Monitor

Visit **http://localhost:3000/queues** to see live queue stats: pending jobs, active jobs, completed, failed, and retry counts.

---

## Project structure

```
src/
├── main.ts                            # App entry point
├── app.module.ts                      # Root module, middleware + Bull Board setup
├── common/
│   ├── interfaces/
│   │   ├── queue.interfaces.ts        # IncomingMessageJob, OutgoingMessageJob
│   │   └── grok.interfaces.ts         # GrokOutput
│   ├── logger.middleware.ts           # Logs every HTTP request with timing
│   └── phone.util.ts                  # Phone number helpers (JID ↔ phone)
├── api/
│   ├── dto/
│   │   └── send-message.dto.ts        # Request body validation
│   ├── conversation.service.ts        # All database read/write operations
│   ├── api.controller.ts              # REST endpoints (prefix: /api)
│   └── api.module.ts                  # Provides and exports ConversationService
├── whatsapp/
│   ├── whatsapp.service.ts            # Baileys connection, sends/receives messages
│   └── whatsapp.module.ts
├── ai/
│   ├── grok.service.ts                # Calls Grok API and parses the response
│   └── ai.module.ts
├── queue/
│   ├── queue.processor.ts             # Handles incoming and outgoing message jobs
│   └── queue.module.ts
└── prisma/
    ├── prisma.service.ts              # Prisma client wrapper
    └── prisma.module.ts               # Global — available everywhere
prisma/
└── schema.prisma                      # DB schema (Conversation + Message)
```

---

## Troubleshooting

**QR code not appearing** — auth is already saved in `./auth_info`. No scan needed.

**Logged out** — delete `./auth_info` folder and restart. A new QR will appear.

**Messages not sending** — check logs for `WhatsApp connection established`. Phone must include country code, digits only.

**DB connection error** — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` in `.env` must match `DATABASE_URL`.
