# Plan: Unified Excalidecks Refactoring

## Context

The project has two separate processes (MCP Server + Canvas Server) that communicate via HTTP fetch. This creates operational complexity (two processes to manage), unnecessary network overhead, and sync issues. The goal is to merge them into a single process, bundle into a self-contained single JS file, add auto-shutdown on inactivity, and use a non-standard port.

## Requirements

1. **Merge MCP + Canvas** into one process (per `refactor.md`)
2. **Single-file bundle** via tsup (no node_modules needed at runtime)
3. **Auto-delete node_modules** after build
4. **Auto-stop** after 5 min of inactivity (HTTP + WS + MCP activity resets timer) via `process.exit(0)`
5. **Port 41520** as default (overridable via `PORT` env)

## Target File Structure

```
src/
├── index.ts              # Unified entry point + auto-stop timer
├── canvas/
│   ├── element-store.ts  # ElementStore singleton, observer pattern, CRUD, Zod schemas
│   ├── express-app.ts    # Express routes + static files
│   └── websocket.ts      # WebSocket manager + broadcast
├── mcp/
│   └── tools.ts          # MCP tool handlers (direct elementStore calls, no fetch)
├── types.ts              # Keep interfaces (remove elements Map + generateId)
└── utils/
    └── logger.ts         # Keep as-is
```

## Implementation Steps

### Step 1: Create `src/canvas/element-store.ts`

**Source material:** `src/server.ts` (CRUD logic, Zod schemas), `src/types.ts` (elements Map, generateId), `src/index.ts` (sceneState, convertTextToLabel)

- Move `elements` Map and `generateId()` from `types.ts`
- Move `CreateElementSchema` and `UpdateElementSchema` Zod schemas from `server.ts`
- Move `convertTextToLabel()` from `index.ts`
- Move `sceneState` (theme, viewport, selectedElements, groups) from `index.ts`
- Implement observer pattern: `onChange(listener)` for WebSocket broadcasts
- Events: `element_created`, `element_updated`, `element_deleted`, `elements_batch_created`, `elements_synced`
- **Critical:** `batchCreate()` must use internal `_createRaw()` (no individual notifications) then emit single batch event to avoid double-broadcasting to frontend

### Step 2: Create `src/canvas/websocket.ts`

**Source material:** `src/server.ts` (lines 47-88: clients Set, broadcast(), wss.on('connection'))

- `initWebSocket(server, onActivity)` — accepts activity callback for auto-stop timer reset
- `broadcast(message)` — send to all OPEN clients
- `closeWebSocket()` — graceful shutdown (close all clients, close WSS)
- `getClientCount()` — for health endpoint
- Subscribe to elementStore changes → auto-broadcast
- WebSocket message/close/error events trigger `onActivity()`

### Step 3: Create `src/canvas/express-app.ts`

**Source material:** `src/server.ts` (all Express routes, lines 138-570)

- `createExpressApp(onActivity)` — accepts activity callback
- Activity tracking middleware on ALL requests
- All API routes use `elementStore` directly (no intermediate storage)
- Static files: resolve `dist/frontend/` relative to bundle location using `import.meta.url`
- Handle both tsup bundled path (`dist/index.js` → `dist/frontend/`) and tsc compiled path (`dist/canvas/express-app.js` → `dist/frontend/`)
- Health check includes `getClientCount()` from websocket module
- **Critical:** No `console.log` — use `logger` only (writes to stderr)

### Step 4: Create `src/mcp/tools.ts`

**Source material:** `src/index.ts` (all tool definitions, Zod schemas, tool handlers ~800 lines)

- Move all 12 tool definitions and their Zod schemas
- Replace ALL `fetch()` calls with direct `elementStore` method calls:
  - `fetch(POST /api/elements)` → `elementStore.create()`
  - `fetch(PUT /api/elements/:id)` → `elementStore.update()`
  - `fetch(DELETE /api/elements/:id)` → `elementStore.delete()`
  - `fetch(GET /api/elements)` → `elementStore.getAll()`
  - `fetch(GET /api/elements/:id)` → `elementStore.getById()`
  - `fetch(GET /api/elements/search)` → `elementStore.query()`
  - `fetch(POST /api/elements/batch)` → `elementStore.batchCreate()`
  - `fetch(POST /api/elements/from-mermaid)` → `broadcast()` directly
- Remove: `syncToCanvas()`, `createElementOnCanvas()`, `updateElementOnCanvas()`, `deleteElementOnCanvas()`, `batchCreateElementsOnCanvas()`, `getElementFromCanvas()`
- Remove: `node-fetch` import, `EXPRESS_SERVER_URL`, `ENABLE_CANVAS_SYNC` env vars
- `registerTools(server, activityCallback)` — accepts activity callback, calls it on every tool call
- Keep `Server` (low-level API with `setRequestHandler`), NOT `McpServer` (matches current code)
- Keep `align_elements` and `distribute_elements` as stubs

### Step 5: Update `src/types.ts`

- **Remove:** `elements` Map (line 244) — moved to element-store
- **Remove:** `generateId()` (lines 263-265) — moved to element-store
- **Remove:** `validateElement()` (lines 247-260) — replaced by Zod schemas in element-store
- **Keep:** All interfaces, type aliases, `EXCALIDRAW_ELEMENT_TYPES`, WebSocket message types

### Step 6: Rewrite `src/index.ts`

**New unified entry point (~100 lines):**

1. Set `NODE_DISABLE_COLORS=1`, `NO_COLOR=1`
2. Start Express app + HTTP server on port 41520
3. Init WebSocket on same HTTP server
4. Start MCP server on stdio (unless `--canvas-only`)
5. Inactivity timer: 5 min → `process.exit(0)`, reset on any activity
6. Graceful shutdown: close WS → close HTTP → exit
7. Global error handlers (uncaughtException, unhandledRejection) — write to stderr
8. Safety override: `console.log = (...args) => logger.info(args.join(' '))` to prevent stdout pollution

### Step 7: Delete `src/server.ts`

All functionality absorbed by `src/canvas/` modules.

### Step 8: Create `tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  bundle: true,
  splitting: false,
  clean: true,
  outDir: 'dist',
  noExternal: [/.*/],
  external: [
    '@excalidraw/excalidraw',
    '@excalidraw/mermaid-to-excalidraw',
    'react', 'react-dom', 'mermaid',
  ],
  banner: { js: '#!/usr/bin/env node' },
});
```

### Step 9: Update `package.json`

**Scripts:**
- `"start": "node dist/index.js"`
- `"canvas": "node dist/index.js --canvas-only"`
- `"build": "npm run build:frontend && npm run build:backend && rm -rf node_modules"`
- `"build:frontend": "vite build"`
- `"build:backend": "tsup"`
- `"build:server": "npx tsc"` (kept for dev)
- `"dev": "concurrently \"npm run dev:server\" \"vite\""`
- `"type-check": "npx tsc --noEmit"`

**Dependencies changes:**
- Remove from deps: `node-fetch`, `zod-to-json-schema`
- Move to devDeps: `@excalidraw/excalidraw`, `@excalidraw/mermaid-to-excalidraw`, `react`, `react-dom`, `mermaid`
- Add to devDeps: `tsup`
- Update `"files"`: `["dist/index.js", "dist/frontend/**/*", "README.md", "LICENSE"]`

### Step 10: Update `vite.config.js`

Change proxy targets from `http://localhost:3000` to `http://localhost:41520`.

### Step 11: Update Docker

- **Delete** `Dockerfile.canvas`
- **Rewrite** `Dockerfile`: 2-stage build (builder + production). Production stage has NO node_modules — only `dist/index.js` + `dist/frontend/`
- **Update** `docker-compose.yml`: Single service, port 41520

### Step 12: Update CI workflows

- Remove `dist/server.js` artifact checks
- Remove canvas Docker job
- Update port references to 41520

### Step 13: Update `claude_desktop_config.json`

Remove `EXPRESS_SERVER_URL` and `ENABLE_CANVAS_SYNC` env vars.

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| stdout pollution breaks MCP | Override `console.log` to route through logger (stderr). Already verified: Winston console transport uses stderr |
| tsup fails to bundle `@modelcontextprotocol/sdk` deep imports | If fails, mark as external and ship alongside bundle |
| batchCreate double-notifies frontend | Use internal `_createRaw()` without per-element events |
| Static file path differs between tsup/tsc output | Use `import.meta.url` + fallback path resolution checking `fs.existsSync` |

## Verification

After all steps:
1. `npx tsc --noEmit` — type checking passes
2. `npm run build:backend` (tsup) — single `dist/index.js` produced
3. `rm -rf node_modules && node dist/index.js` — runs without node_modules
4. `curl http://localhost:41520/health` — returns healthy
5. Open `http://localhost:41520` — Excalidraw loads
6. MCP Inspector: `create_element`, `query_elements`, `batch_create_elements` — all work
7. `node dist/index.js --canvas-only` — canvas-only mode works
8. Wait 5 min with no activity — process exits with code 0
9. `docker build -t test . && docker run -p 41520:41520 test` — Docker works without node_modules
