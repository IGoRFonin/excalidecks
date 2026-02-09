# TDD: Рефакторинг mcp_excalidraw — Объединение Canvas + MCP в один процесс

## 1. Цель

Объединить два независимых компонента (Canvas Server и MCP Server) в единый процесс, чтобы пользователю не нужно было запускать Canvas Server вручную. При запуске MCP-сервера через Claude Desktop/Code/Cursor Canvas автоматически поднимается и становится доступен в браузере.

## 2. Текущая архитектура

```
┌─────────────┐  stdio   ┌──────────────┐  HTTP/fetch   ┌───────────────┐
│  AI Agent   │◄────────►│  MCP Server  │──────────────►│ Canvas Server │
│  (Claude)   │          │ src/index.ts │               │ src/server.ts │
└─────────────┘          └──────────────┘               └───────┬───────┘
                                                                │
                                                           WebSocket
                                                                │
                                                        ┌───────▼───────┐
                                                        │   Frontend    │
                                                        │ React + WS   │
                                                        └───────────────┘
```

### Проблемы

- Пользователь вынужден запускать Canvas Server отдельной командой (`npm run canvas`)
- MCP Server общается с Canvas через HTTP fetch (лишняя сетевая прослойка)
- Два процесса могут рассинхронизироваться (Canvas упал, MCP не знает)
- `EXPRESS_SERVER_URL` и `ENABLE_CANVAS_SYNC` — лишние переменные окружения

## 3. Целевая архитектура

```
┌─────────────┐  stdio   ┌──────────────────────────────────────┐
│  AI Agent   │◄────────►│          Единый процесс              │
│  (Claude)   │          │                                      │
└─────────────┘          │  ┌─────────────┐  direct call  ┌──────────────┐
                         │  │ MCP Server  │──────────────►│ ElementStore │
                         │  │ (stdio)     │               │ (in-memory)  │
                         │  └─────────────┘               └──────┬───────┘
                         │                                       │
                         │  ┌─────────────┐              broadcast
                         │  │ Express +   │◄─────────────────────┘
                         │  │ WebSocket   │
                         │  │ :3000       │
                         │  └──────┬──────┘
                         └─────────┼──────────────────────────────┘
                                   │
                            ┌──────▼──────┐
                            │  Frontend   │
                            │  Browser    │
                            └─────────────┘
```

### Ключевые изменения

- MCP-операции работают напрямую с хранилищем — без HTTP-запросов к самому себе
- Express сервер поднимается автоматически при старте MCP
- WebSocket по-прежнему оповещает браузер о новых элементах
- Один процесс — одна точка запуска

## 4. Файловая структура (было → стало)

### Было

```
src/
├── index.ts        # MCP Server (точка входа 1)
├── server.ts       # Canvas Server (точка входа 2)
├── types.ts
└── utils/
    └── logger.ts
```

### Стало

```
src/
├── index.ts              # Единая точка входа (MCP + Canvas)
├── canvas/
│   ├── element-store.ts  # Хранилище элементов (извлечено из server.ts)
│   ├── express-app.ts    # Express routes + static files (извлечено из server.ts)
│   └── websocket.ts      # WebSocket-менеджер (извлечено из server.ts)
├── mcp/
│   └── tools.ts          # MCP tool handlers (извлечено из index.ts)
├── types.ts              # Без изменений
└── utils/
    └── logger.ts         # Без изменений
```

## 5. Пошаговый план рефакторинга

### Шаг 1. Извлечь ElementStore из `server.ts`

Создать `src/canvas/element-store.ts` — единый источник правды для элементов.

**Что извлечь из `server.ts`:**
- In-memory Map/хранилище элементов
- Логику CRUD (create, read, update, delete)
- Функцию генерации ID

```typescript
// src/canvas/element-store.ts

import { ExcalidrawElement, ServerElement } from '../types';

type ElementChangeListener = (event: string, element: ServerElement) => void;

class ElementStore {
  private elements: Map<string, ServerElement> = new Map();
  private listeners: ElementChangeListener[] = [];

  // Подписка на изменения (для WebSocket broadcast)
  onChange(listener: ElementChangeListener): void {
    this.listeners.push(listener);
  }

  private notify(event: string, element: ServerElement): void {
    this.listeners.forEach(fn => fn(event, element));
  }

  // --- CRUD ---

  getAll(): ServerElement[] {
    return Array.from(this.elements.values());
  }

  getById(id: string): ServerElement | undefined {
    return this.elements.get(id);
  }

  query(filters: Record<string, any>): ServerElement[] {
    let results = this.getAll();
    if (filters.type) results = results.filter(e => e.type === filters.type);
    if (filters.isDeleted !== undefined) results = results.filter(e => e.isDeleted === filters.isDeleted);
    // ... остальные фильтры из текущего index.ts
    return results;
  }

  create(data: Partial<ExcalidrawElement>): ServerElement {
    const id = data.id || this.generateId();
    const element: ServerElement = {
      id,
      type: data.type || 'rectangle',
      x: data.x || 0,
      y: data.y || 0,
      width: data.width || 100,
      height: data.height || 100,
      strokeColor: data.strokeColor || '#000000',
      backgroundColor: data.backgroundColor || 'transparent',
      fillStyle: data.fillStyle || 'solid',
      strokeWidth: data.strokeWidth || 2,
      roughness: data.roughness || 1,
      opacity: data.opacity || 100,
      angle: data.angle || 0,
      isDeleted: false,
      version: 1,
      // ... остальные поля из types.ts
      ...data,
    } as ServerElement;

    this.elements.set(id, element);
    this.notify('element_created', element);
    return element;
  }

  update(id: string, updates: Partial<ExcalidrawElement>): ServerElement | null {
    const existing = this.elements.get(id);
    if (!existing) return null;

    const updated: ServerElement = {
      ...existing,
      ...updates,
      id, // ID нельзя менять
      version: (existing.version || 1) + 1,
    };

    this.elements.set(id, updated);
    this.notify('element_updated', updated);
    return updated;
  }

  delete(id: string): boolean {
    const existing = this.elements.get(id);
    if (!existing) return false;

    this.elements.delete(id);
    this.notify('element_deleted', existing);
    return true;
  }

  batchCreate(items: Partial<ExcalidrawElement>[]): ServerElement[] {
    return items.map(item => this.create(item));
  }

  clear(): void {
    this.elements.clear();
    // notify clear event if needed
  }

  private generateId(): string {
    return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton — один инстанс на весь процесс
export const elementStore = new ElementStore();
export { ElementStore };
```

### Шаг 2. Извлечь WebSocket-менеджер из `server.ts`

Создать `src/canvas/websocket.ts`:

```typescript
// src/canvas/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { elementStore } from './element-store';

let wss: WebSocketServer;

export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    // Отправляем текущее состояние при подключении
    const elements = elementStore.getAll();
    ws.send(JSON.stringify({
      type: 'init',
      elements,
    }));
  });

  // Подписываемся на изменения в store
  elementStore.onChange((event, element) => {
    broadcast({ type: event, element });
  });

  return wss;
}

export function broadcast(message: object): void {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
```

### Шаг 3. Извлечь Express-приложение из `server.ts`

Создать `src/canvas/express-app.ts`:

```typescript
// src/canvas/express-app.ts

import express, { Application } from 'express';
import cors from 'cors';
import path from 'path';
import { elementStore } from './element-store';

export function createExpressApp(): Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- REST API (для обратной совместимости и frontend) ---

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', elements: elementStore.getAll().length });
  });

  app.get('/api/elements', (_req, res) => {
    res.json(elementStore.getAll());
  });

  app.post('/api/elements', (req, res) => {
    const element = elementStore.create(req.body);
    res.status(201).json(element);
  });

  app.put('/api/elements/:id', (req, res) => {
    const updated = elementStore.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  });

  app.delete('/api/elements/:id', (req, res) => {
    const deleted = elementStore.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  });

  app.post('/api/elements/batch', (req, res) => {
    const elements = elementStore.batchCreate(req.body.elements || req.body);
    res.status(201).json(elements);
  });

  // --- Static files (React frontend) ---
  const frontendPath = path.join(__dirname, '..', 'frontend');
  app.use(express.static(frontendPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });

  return app;
}
```

### Шаг 4. Извлечь MCP tools из `index.ts`

Создать `src/mcp/tools.ts` — перенести все tool-обработчики, но заменить HTTP-вызовы на прямые вызовы `elementStore`:

```typescript
// src/mcp/tools.ts

import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { elementStore } from '../canvas/element-store';
import { broadcast } from '../canvas/websocket';

export function registerTools(server: McpServer): void {

  // --- create_element ---
  server.tool(
    'create_element',
    'Create an Excalidraw element on the canvas',
    {
      type: { type: 'string', enum: ['rectangle','ellipse','diamond','arrow','text','line'] },
      x: { type: 'number' },
      y: { type: 'number' },
      width: { type: 'number' },
      height: { type: 'number' },
      // ... остальные параметры из текущего index.ts
    },
    async (params) => {
      // БЫЛО: fetch(`${EXPRESS_SERVER_URL}/api/elements`, { method: 'POST', body: JSON.stringify(params) })
      // СТАЛО: прямой вызов
      const element = elementStore.create(params);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, element }) }],
      };
    }
  );

  // --- update_element ---
  server.tool(
    'update_element',
    'Update an existing element',
    {
      id: { type: 'string' },
      // ... update params
    },
    async ({ id, ...updates }) => {
      const element = elementStore.update(id, updates);
      if (!element) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Not found' }) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, element }) }] };
    }
  );

  // --- delete_element ---
  server.tool(
    'delete_element',
    'Delete an element',
    { id: { type: 'string' } },
    async ({ id }) => {
      const deleted = elementStore.delete(id);
      return { content: [{ type: 'text', text: JSON.stringify({ success: deleted }) }] };
    }
  );

  // --- query_elements ---
  server.tool(
    'query_elements',
    'Query elements with filters',
    { /* filter params */ },
    async (filters) => {
      const elements = elementStore.query(filters);
      return { content: [{ type: 'text', text: JSON.stringify({ elements, count: elements.length }) }] };
    }
  );

  // --- batch_create_elements ---
  server.tool(
    'batch_create_elements',
    'Create multiple elements at once',
    { elements: { type: 'array' } },
    async ({ elements }) => {
      const created = elementStore.batchCreate(elements);
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, elements: created }) }] };
    }
  );

  // --- group_elements, align_elements, distribute_elements, lock/unlock ---
  // Перенести аналогично, заменяя fetch на elementStore.*

  // --- get_resource ---
  server.resource('scene', 'excalidraw://scene', async () => {
    return {
      contents: [{
        uri: 'excalidraw://scene',
        text: JSON.stringify(elementStore.getAll()),
        mimeType: 'application/json',
      }],
    };
  });
}
```

### Шаг 5. Переписать `index.ts` — единая точка входа

```typescript
// src/index.ts — НОВАЯ ВЕРСИЯ

import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from 'http';
import { createExpressApp } from './canvas/express-app';
import { initWebSocket } from './canvas/websocket';
import { registerTools } from './mcp/tools';
import { logger } from './utils/logger';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || 'localhost';

async function main() {
  // ────────────────────────────────────────────
  // 1. Поднимаем Canvas Server (Express + WS)
  // ────────────────────────────────────────────
  const app = createExpressApp();
  const httpServer = createServer(app);
  initWebSocket(httpServer);

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, HOST, () => {
      logger.info(`Canvas server running at http://${HOST}:${PORT}`);
      resolve();
    });
    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${PORT} already in use — Canvas may already be running`);
        resolve(); // Не падаем, MCP всё равно запустится
      } else {
        reject(err);
      }
    });
  });

  // ────────────────────────────────────────────
  // 2. Настраиваем MCP Server (stdio)
  // ────────────────────────────────────────────
  const mcpServer = new McpServer({
    name: 'excalidraw',
    version: '1.0.0',
  });

  registerTools(mcpServer);

  // ────────────────────────────────────────────
  // 3. Подключаем stdio-транспорт
  // ────────────────────────────────────────────
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  logger.info('MCP Server connected via stdio');

  // ────────────────────────────────────────────
  // 4. Graceful shutdown
  // ────────────────────────────────────────────
  const shutdown = () => {
    logger.info('Shutting down...');
    httpServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
```

### Шаг 6. Обновить `package.json`

```jsonc
{
  "scripts": {
    // Основная команда — всё-в-одном
    "start": "node dist/index.js",
    "build": "npm run build:frontend && npm run build:server",
    "build:frontend": "vite build",
    "build:server": "tsc",

    // Для обратной совместимости (опционально)
    "canvas": "node dist/index.js --canvas-only",

    // Dev
    "dev": "tsc --watch & vite dev",
    "type-check": "tsc --noEmit"
  }
}
```

### Шаг 7. Обновить конфиг MCP (пользовательский)

**Было:**
```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/path/to/mcp_excalidraw/dist/index.js"],
      "env": {
        "EXPRESS_SERVER_URL": "http://localhost:3000",
        "ENABLE_CANVAS_SYNC": "true"
      }
    }
  }
}
```

**Стало:**
```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "node",
      "args": ["/path/to/mcp_excalidraw/dist/index.js"]
    }
  }
}
```

Переменные `EXPRESS_SERVER_URL` и `ENABLE_CANVAS_SYNC` больше не нужны — Canvas встроен.

## 6. Чеклист замен в коде

При рефакторинге `index.ts` нужно найти и заменить ВСЕ HTTP-вызовы:

| Было (HTTP fetch) | Стало (прямой вызов) |
|-|-|
| `fetch(\`${serverUrl}/api/elements\`, { method: 'POST', body })` | `elementStore.create(data)` |
| `fetch(\`${serverUrl}/api/elements/${id}\`, { method: 'PUT', body })` | `elementStore.update(id, data)` |
| `fetch(\`${serverUrl}/api/elements/${id}\`, { method: 'DELETE' })` | `elementStore.delete(id)` |
| `fetch(\`${serverUrl}/api/elements\`)` (GET) | `elementStore.getAll()` |
| `fetch(\`${serverUrl}/api/elements/batch\`, { method: 'POST', body })` | `elementStore.batchCreate(items)` |
| `fetch(\`${serverUrl}/health\`)` | Не нужен — сервер в том же процессе |

## 7. Обработка edge cases

### 7.1. Порт уже занят

Если Canvas на порту 3000 уже запущен другим процессом — не падаем. MCP-сервер всё равно работает, потому что он обращается к `elementStore` напрямую, а не через HTTP. В этом случае WebSocket-клиенты просто не подключатся к этому инстансу.

```typescript
httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    logger.warn(`Port ${PORT} in use — running MCP without embedded Canvas`);
    // MCP продолжает работать
  }
});
```

### 7.2. Режим "только Canvas" (обратная совместимость)

Добавить CLI-флаг `--canvas-only` для тех, кто хочет запустить только Canvas без MCP:

```typescript
if (process.argv.includes('--canvas-only')) {
  // Не запускаем MCP, только Express + WS
  return;
}
```

### 7.3. stdout конфликт

MCP использует stdout для stdio-транспорта. Express (morgan, console.log) тоже может писать в stdout. **Критически важно**: убедиться, что Express-логирование идёт в stderr или в файл, а НЕ в stdout.

```typescript
// В express-app.ts НЕ использовать morgan с stdout
// Логировать через logger, который пишет в stderr или файл
import { logger } from '../utils/logger';

// Вместо console.log
logger.info('Canvas started'); // → stderr / file
```

### 7.4. Mermaid-конвертация

Текущий проект поддерживает `create_from_mermaid` — эта фича работает через frontend (browser-based). При объединении это продолжает работать: MCP отправляет Mermaid-текст → REST API → WebSocket → frontend конвертирует → результат обратно. Этот поток остаётся через HTTP/WS, но это нормально, т.к. конвертация требует DOM.

## 8. Порядок выполнения

```
1. [ ] Форкнуть репо, создать ветку refactor/unified-process
2. [ ] Создать src/canvas/element-store.ts (извлечь из server.ts)
3. [ ] Создать src/canvas/websocket.ts (извлечь из server.ts)
4. [ ] Создать src/canvas/express-app.ts (извлечь из server.ts)
5. [ ] Создать src/mcp/tools.ts (извлечь из index.ts, заменить fetch → elementStore)
6. [ ] Переписать src/index.ts (единая точка входа)
7. [ ] Удалить src/server.ts (или оставить как legacy wrapper)
8. [ ] Обновить package.json (скрипты)
9. [ ] Убедиться что ВСЕ console.log в Express идут в stderr
10. [ ] npm run build — проверить компиляцию
11. [ ] Тестирование:
    a. [ ] Запустить node dist/index.js — Canvas поднялся на :3000?
    b. [ ] Открыть http://localhost:3000 — видим Excalidraw?
    c. [ ] MCP Inspector: tools/list — инструменты зарегистрированы?
    d. [ ] MCP Inspector: create_element — элемент появляется на Canvas?
    e. [ ] Batch create — работает?
    f. [ ] Query elements — возвращает результаты?
12. [ ] Обновить README
13. [ ] Обновить Dockerfile (один образ вместо двух)
```

## 9. Оценка трудозатрат

| Задача | Сложность | Время |
|-|-|-|
| Извлечь ElementStore | Средняя | 1-2 ч |
| Извлечь WebSocket + Express | Средняя | 1-2 ч |
| Перенести MCP tools (заменить fetch) | Высокая (много кода ~800 строк) | 3-4 ч |
| Переписать index.ts | Низкая | 30 мин |
| Обработка edge cases (stdout, порт) | Средняя | 1 ч |
| Тестирование | Средняя | 1-2 ч |
| **Итого** | | **~8-12 ч** |

## 10. Риски

| Риск | Вероятность | Митигация |
|-|-|-|
| stdout конфликт (Express логи ломают MCP stdio) | Высокая | Перенаправить ВСЕ логи в stderr/файл |
| Mermaid перестанет работать | Низкая | Mermaid идёт через WS → frontend, не зависит от архитектуры |
| Утечка памяти (elements + MCP в одном процессе) | Низкая | Текущее in-memory хранилище и так не персистентное |
| Обратная совместимость (кто-то использует server.ts отдельно) | Средняя | Оставить `--canvas-only` режим |
