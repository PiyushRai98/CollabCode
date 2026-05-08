# Architecture Documentation

## System Overview

CollabCode is a real-time collaborative code editor following a client-server architecture with CRDT-based conflict resolution.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Monaco   │  │ Yjs Doc  │  │ Socket.io│  │ Zustand     │  │
│  │ Editor   │◄─┤ (CRDT)   │◄─┤ Client   │  │ State Store │  │
│  └──────────┘  └──────────┘  └──────────┘  └─────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼───────────────────────────────────────┐
│                       SERVER (Node.js)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Express  │  │ Socket.io│  │ Yjs Doc  │  │ Execution   │  │
│  │ REST API │  │ Server   │  │ (Server) │  │ Service     │  │
│  └─────┬────┘  └─────┬────┘  └──────────┘  └──────┬──────┘  │
│        │             │                             │          │
│  ┌─────▼─────────────▼──────────────────────────── ▼───────┐  │
│  │              Service Layer                              │  │
│  │  Auth | Document | Collaboration | Metrics | Redis      │  │
│  └─────────────────┬──────────────────┬────────────────────┘  │
└────────────────────┼──────────────────┼───────────────────────┘
                     │                  │
              ┌──────▼──────┐    ┌──────▼──────┐
              │   MongoDB   │    │    Redis    │
              │  (persist)  │    │  (pub/sub)  │
              └─────────────┘    └─────────────┘
```

## Data Flow: Collaborative Edit

```
User A types "hello"
    │
    ▼
Monaco Editor onChange
    │
    ▼
Y.Doc.transact() — local CRDT operation
    │
    ├──► Y.Doc.on('update') fires
    │        │
    │        ▼
    │    Socket.emit('yjs-update', base64)
    │        │
    │        ▼
    │    Server receives update
    │        │
    │        ├──► Y.applyUpdate(serverDoc, update)
    │        │
    │        ├──► socket.to(room).emit('yjs-update', base64)
    │        │        │
    │        │        ▼
    │        │    User B's socket receives update
    │        │        │
    │        │        ▼
    │        │    Y.applyUpdate(clientDoc, update, 'remote')
    │        │        │
    │        │        ▼
    │        │    Y.Doc.observe() fires
    │        │        │
    │        │        ▼
    │        │    Monaco editor.executeEdits('remote', edits)
    │        │
    │        └──► scheduleSave() — debounced persist to MongoDB
    │
    ▼
User A sees their edit immediately (local-first)
User B sees the edit after WebSocket round-trip (~50ms)
```

## Sequence Diagram: Room Join

```
Client                    Server                   MongoDB
  │                         │                         │
  │──── connect(token) ────►│                         │
  │                         │── verify JWT ──►        │
  │                         │◄── valid ──────         │
  │                         │                         │
  │── emit('join-room') ───►│                         │
  │                         │── loadYjsState() ──────►│
  │                         │◄── Buffer ──────────────│
  │                         │                         │
  │                         │── Y.applyUpdate()       │
  │                         │── socket.join(room)     │
  │                         │                         │
  │◄── emit('sync-init') ──│                         │
  │    {update, users}      │                         │
  │                         │                         │
  │  Y.applyUpdate(local)   │                         │
  │  editor.setValue()       │                         │
  │                         │── broadcast ───►Other   │
  │                         │   'user-joined' Clients │
```

## CRDT vs OT Decision

### Why CRDT?

1. **No central authority needed** — Each client can apply operations independently. The server acts as a relay, not a transform engine.

2. **Guaranteed convergence** — Yjs uses a unique client ID + logical clock to order operations. Any permutation of the same operations produces the same result.

3. **Offline-first** — Clients can edit offline. When reconnecting, they send their accumulated updates. Yjs merges them automatically.

4. **Simpler server** — The server just applies updates and broadcasts. No transform functions, no operation buffering, no rebasing.

### Trade-offs

- **Memory overhead** — Yjs stores metadata per character (tombstones for deletes). For very large documents, this can be significant.
- **Binary protocol** — Yjs updates are binary (efficient on wire, but not human-readable for debugging).

## Scaling Architecture

### Horizontal Scaling with Redis

When running multiple server instances behind a load balancer:

1. User A connects to Server 1, User B to Server 2
2. User A edits → Server 1 applies locally and publishes to Redis channel `room:{id}`
3. Server 2 subscribes to `room:{id}`, receives the update, broadcasts to its local clients
4. Both servers maintain their own in-memory Y.Doc, kept in sync via Redis relay

### Room Lifecycle

1. **First user joins** → Load Y.Doc from MongoDB, create in-memory room
2. **Editing** → Apply updates in-memory, debounced save to MongoDB every 2s
3. **Last user leaves** → Final save to MongoDB, destroy Y.Doc, free memory
4. **No persistent memory** → Room state is entirely reconstructible from MongoDB

### Connection Handling

- Socket.io with WebSocket transport (polling fallback)
- JWT authentication on connection handshake
- Automatic reconnection with state reconciliation (Yjs handles merge)
