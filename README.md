# CollabCode

A production-ready, real-time collaborative code editor — think Google Docs, but for code. Built with React, Node.js, Monaco Editor, Yjs, Socket.io, and MongoDB.

---

## What it does

- **VS Code-quality editing** — Monaco Editor brings full syntax highlighting, IntelliSense, and multi-language support right in the browser.
- **True real-time collaboration** — Multiple people can edit the same file simultaneously. Conflicts are resolved automatically using Yjs CRDTs, so you never step on each other's work.
- **Live presence** — See who's in the document, where their cursor is, and what they've selected — all in real time with unique color coding per user.
- **Room-based sharing** — Every document gets a unique room ID. Just share the link to start collaborating.
- **Run code in the browser** — Execute JavaScript, Python, or C++ directly from the editor. Code runs inside sandboxed Docker containers, so it's isolated and safe.
- **Version history** — Take snapshots at any point, browse the full history, and roll back to any previous version.
- **Auto-save** — Documents save themselves in the background. No Ctrl+S needed.
- **Secure by default** — JWT authentication with bcrypt password hashing.
- **Built to scale** — Redis Pub/Sub keeps multiple server instances in sync. The backend is fully stateless.
- **Observable** — Structured logging with Pino, Prometheus metrics, and health check endpoints out of the box.
- **Deployable anywhere** — Docker Compose for local development, Kubernetes manifests for production.

---

## Tech stack

| Layer | What's used |
|---|---|
| Frontend | React 18, TypeScript, Monaco Editor, Tailwind CSS, Framer Motion, Zustand |
| Backend | Node.js, Express, Socket.io, TypeScript |
| Sync engine | Yjs (CRDT) over WebSockets |
| Database | MongoDB (Mongoose) |
| Cache / pub-sub | Redis (ioredis) |
| Code execution | Docker containers via dockerode |
| Auth | JWT + bcrypt |
| Observability | Pino logger, prom-client |
| CI/CD | GitHub Actions |
| Deployment | Docker, Docker Compose, Kubernetes |

---

## Getting started

### What you need

- Node.js 20+
- MongoDB (local or Docker)
- Redis (local or Docker)
- Docker (for the code execution feature)

### Step 1 — Start the infrastructure

```bash
docker run -d --name mongo -p 27017:27017 mongo:7
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### Step 2 — Start the server

```bash
cd server
cp .env.example .env   # Edit as needed
npm install
npm run dev
```

### Step 3 — Start the client

```bash
cd client
npm install
npm run dev
```

### Step 4 — Open the app

Go to `http://localhost:5173` in your browser.

### Prefer Docker Compose?

```bash
docker-compose up --build
```

Then open `http://localhost`. The whole stack runs in containers.

---

## Project structure

```
├── client/
│   └── src/
│       ├── components/     # CodeEditor, UserPresence, VersionPanel, OutputPanel
│       ├── hooks/          # useCollaboration — Yjs + Socket.io integration
│       ├── lib/            # Zustand stores
│       ├── pages/          # AuthPage, DashboardPage, EditorPage
│       ├── services/       # API client, Socket.io client
│       ├── styles/         # Tailwind CSS
│       └── types/          # TypeScript interfaces
├── server/
│   └── src/
│       ├── config/         # Environment config
│       ├── middleware/      # JWT auth middleware
│       ├── models/         # Mongoose models — User, Document, Version
│       ├── routes/         # REST API routes
│       ├── services/       # Auth, Document, Collaboration, Execution, Redis, Metrics
│       ├── types/          # Shared TypeScript types
│       └── utils/          # Logger, load test
├── infra/
│   ├── docker/             # Dockerfiles, nginx config
│   └── kubernetes/         # Deployments, services, HPA, ingress
├── docs/                   # Architecture documentation
├── docker-compose.yml
└── .github/workflows/      # CI/CD pipeline
```

---

## API reference

### Auth

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Log in and receive a JWT |

### Documents

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/documents` | Create a new document |
| GET | `/api/documents/mine` | List your documents |
| GET | `/api/documents/:id` | Fetch a document by ID |
| PATCH | `/api/documents/:id` | Update the title or language |
| GET | `/api/documents/:id/versions` | View version history |
| POST | `/api/documents/:id/versions` | Save a version snapshot |
| POST | `/api/documents/:id/restore/:version` | Restore to a previous version |

### Code execution

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/api/execute` | Run code in a sandboxed container |

### WebSocket events

| Event | Direction | What it does |
|---|---|---|
| `join-room` | Client → Server | Join a collaboration session |
| `sync-init` | Server → Client | Send the current document state and user list |
| `yjs-update` | Both ways | Sync CRDT document changes |
| `cursor-update` | Both ways | Broadcast cursor and selection positions |
| `user-joined` | Server → Client | Notify when someone joins |
| `user-left` | Server → Client | Notify when someone leaves |
| `save-version` | Client → Server | Request a version snapshot |
| `version-saved` | Server → Client | Confirm the snapshot was saved |

### Health and metrics

| Endpoint | What it does |
|---|---|
| `GET /health` | Health check — returns uptime and MongoDB status |
| `GET /metrics` | Prometheus metrics endpoint |

---

## How it works under the hood

### Why Yjs instead of OT?

Most collaborative editors have historically used Operational Transformation (OT) — the approach behind Google Docs. CollabCode uses CRDTs (Conflict-free Replicated Data Types) via Yjs instead. Here's why:

| | Yjs (CRDT) | OT (e.g. ShareJS) |
|---|---|---|
| Server dependency | Works peer-to-peer; server is optional | Needs a central server to transform operations |
| Conflict resolution | Mathematically guaranteed to converge | Complex transform functions with edge cases |
| Offline support | Built-in — changes merge cleanly on reconnect | Hard to implement; requires careful operation queuing |
| Scalability | Each node is independent | Server becomes a bottleneck |
| Trade-off | Higher memory (metadata per character) | Less memory, but more code complexity |

Yjs specifically was chosen because it has mature Monaco Editor bindings, an efficient binary wire format, sub-millisecond local operations, and a built-in awareness protocol for presence features.

### How scaling works

When multiple server instances are running, they stay in sync through Redis Pub/Sub. Each server holds active Yjs document state in memory, loaded from MongoDB when the first user joins and persisted on every change. Users on different server instances see each other's edits in real time through the Redis relay — no sticky sessions required.

Kubernetes HPA scales the server pods automatically based on CPU usage (threshold: 70%).

---

## Testing

```bash
# Unit tests
cd server && npm test

# Load testing
cd server && npx tsx src/utils/load-test.ts
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Server port |
| `MONGODB_URI` | `mongodb://localhost:27017/collab-editor` | MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `dev-secret-change-in-prod` | JWT signing secret — **change this in production** |
| `JWT_EXPIRES_IN` | `7d` | Token expiration window |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `EXECUTION_TIMEOUT_MS` | `10000` | Max time to wait for code execution |
| `EXECUTION_MEMORY_MB` | `128` | Memory limit per execution container |

---

## License

MIT
