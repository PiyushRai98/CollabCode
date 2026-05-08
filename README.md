# CollabCode — Real-Time Collaborative Code Editor

A production-grade, real-time collaborative code editor (Google Docs for Code) built with React, Node.js, Monaco Editor, Yjs CRDT, Socket.io, and MongoDB.

## Features

- **Monaco Editor** — VS Code-grade editing with syntax highlighting, IntelliSense, multi-language support
- **Real-Time Collaboration** — CRDT-based (Yjs) conflict-free editing with WebSocket sync
- **Live Presence** — See active users, colored cursors, and selections in real-time
- **Room-Based** — Each document is a unique room; share the room ID to collaborate
- **Code Execution** — Run JS, Python, C++ in sandboxed Docker containers
- **Version History** — Snapshot versions, browse history, rollback to any point
- **Auto-Save** — Documents persist automatically with debounced saves
- **Authentication** — JWT-based auth with bcrypt password hashing
- **Scalable** — Redis Pub/Sub for multi-instance sync, stateless backend
- **Observability** — Pino structured logging, Prometheus metrics, health checks
- **Deployment** — Docker Compose for local dev, Kubernetes manifests for production

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Monaco Editor, Tailwind CSS, Framer Motion, Zustand |
| Backend | Node.js, Express, Socket.io, TypeScript |
| Sync Engine | Yjs (CRDT) over WebSockets |
| Database | MongoDB (Mongoose ODM) |
| Cache/Pub-Sub | Redis (ioredis) |
| Code Execution | Docker containers (dockerode) |
| Auth | JWT + bcrypt |
| Observability | Pino logger, prom-client (Prometheus) |
| CI/CD | GitHub Actions |
| Deployment | Docker, Docker Compose, Kubernetes |

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB (local or Docker)
- Redis (local or Docker)
- Docker (for code execution feature)

### 1. Start infrastructure

```bash
# Start MongoDB and Redis with Docker
docker run -d --name mongo -p 27017:27017 mongo:7
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 2. Setup server

```bash
cd server
cp .env.example .env   # Edit as needed
npm install
npm run dev
```

### 3. Setup client

```bash
cd client
npm install
npm run dev
```

### 4. Open browser

Navigate to `http://localhost:5173`

### Full Stack with Docker Compose

```bash
docker-compose up --build
```

Open `http://localhost` — the entire stack runs in containers.

## Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # CodeEditor, UserPresence, VersionPanel, OutputPanel
│   │   ├── hooks/          # useCollaboration (Yjs + Socket.io)
│   │   ├── lib/            # Zustand stores
│   │   ├── pages/          # AuthPage, DashboardPage, EditorPage
│   │   ├── services/       # API client, Socket.io client
│   │   ├── styles/         # Tailwind CSS
│   │   └── types/          # TypeScript interfaces
│   └── vite.config.ts
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── config/         # Environment config
│   │   ├── middleware/      # JWT auth middleware
│   │   ├── models/         # Mongoose models (User, Document, Version)
│   │   ├── routes/         # REST API routes
│   │   ├── services/       # Auth, Document, Collaboration, Execution, Redis, Metrics
│   │   ├── types/          # Shared TypeScript types
│   │   └── utils/          # Logger, load test
│   └── tsconfig.json
├── infra/
│   ├── docker/             # Dockerfiles, nginx config
│   └── kubernetes/         # K8s manifests (deployments, services, HPA, ingress)
├── docs/                   # Architecture documentation
├── docker-compose.yml      # Local full-stack deployment
└── .github/workflows/      # CI/CD pipeline
```

## API Reference

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and get JWT token |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/documents` | Create a new document |
| GET | `/api/documents/mine` | List user's documents |
| GET | `/api/documents/:id` | Get document by ID |
| PATCH | `/api/documents/:id` | Update document title/language |
| GET | `/api/documents/:id/versions` | Get version history |
| POST | `/api/documents/:id/versions` | Create a version snapshot |
| POST | `/api/documents/:id/restore/:version` | Restore to a version |

### Code Execution

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/execute` | Execute code in sandbox |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `join-room` | Client → Server | Join a collaboration room |
| `sync-init` | Server → Client | Initial document state + users |
| `yjs-update` | Bidirectional | CRDT document updates |
| `cursor-update` | Bidirectional | Live cursor/selection sync |
| `user-joined` | Server → Client | User joined the room |
| `user-left` | Server → Client | User left the room |
| `save-version` | Client → Server | Create version snapshot |
| `version-saved` | Server → Client | Version saved confirmation |

### Health & Metrics

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check (returns uptime, MongoDB status) |
| `GET /metrics` | Prometheus metrics |

## Architecture

### CRDT vs OT — Why Yjs?

We chose **CRDT (Conflict-free Replicated Data Types)** via Yjs over OT (Operational Transformation) for these reasons:

| Aspect | CRDT (Yjs) | OT (ShareJS) |
|--------|-----------|---------------|
| Server dependency | Works peer-to-peer, server optional | Requires central server for transform |
| Conflict resolution | Mathematically guaranteed convergence | Complex transform functions, edge cases |
| Offline support | Built-in — merge on reconnect | Difficult, requires queueing + rebasing |
| Scalability | Each node independent | Server bottleneck for transforms |
| Complexity | Higher memory (metadata per character) | Lower memory, higher code complexity |

**Yjs** specifically was chosen because:
- Mature, well-tested library with Monaco Editor bindings
- Efficient binary encoding (small wire format)
- Sub-millisecond local operations
- Built-in awareness protocol for presence

### Scaling Strategy

```
                    ┌─────────────┐
                    │  Nginx/LB   │
                    └──────┬──────┘
               ┌───────────┼───────────┐
               │           │           │
          ┌────▼───┐  ┌────▼───┐  ┌────▼───┐
          │Server 1│  │Server 2│  │Server 3│
          └────┬───┘  └────┬───┘  └────┬───┘
               │           │           │
               └─────┬─────┘─────┬─────┘
                     │           │
              ┌──────▼──┐  ┌─────▼────┐
              │  Redis   │  │ MongoDB  │
              │ Pub/Sub  │  │  (data)  │
              └──────────┘  └──────────┘
```

- **Stateless servers** — Yjs document state is loaded from MongoDB on first connection, kept in memory while users are active, persisted on changes
- **Redis Pub/Sub** — Cross-instance WebSocket message relay so users on different server instances see each other's changes
- **HPA** — Kubernetes Horizontal Pod Autoscaler scales server pods based on CPU (70% threshold)
- **Sticky sessions** — Not required; Yjs state syncs via the server's in-memory doc + Redis relay

## Testing

```bash
# Unit tests (server)
cd server && npm test

# Load test simulation
cd server && npx tsx src/utils/load-test.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `MONGODB_URI` | mongodb://localhost:27017/collab-editor | MongoDB connection string |
| `REDIS_URL` | redis://localhost:6379 | Redis connection string |
| `JWT_SECRET` | dev-secret-change-in-prod | JWT signing secret |
| `JWT_EXPIRES_IN` | 7d | Token expiration |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |
| `EXECUTION_TIMEOUT_MS` | 10000 | Code execution timeout |
| `EXECUTION_MEMORY_MB` | 128 | Code execution memory limit |

## License

MIT
