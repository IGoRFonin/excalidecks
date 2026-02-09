// src/canvas/websocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger.js';
import { elementStore } from './element-store.js';
import {
  WebSocketMessage,
  InitialElementsMessage,
  SyncStatusMessage,
} from '../types.js';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

function broadcast(message: WebSocketMessage): void {
  const data = JSON.stringify(message);
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

export function initWebSocket(
  server: HttpServer,
  onActivity: () => void
): void {
  wss = new WebSocketServer({ server });

  // Subscribe to element store changes → auto-broadcast
  elementStore.onChange((message) => {
    broadcast(message);
  });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);
    onActivity();
    logger.info('New WebSocket connection established');

    // Send current elements to new client
    const initialMessage: InitialElementsMessage = {
      type: 'initial_elements',
      elements: elementStore.getAll(),
    };
    ws.send(JSON.stringify(initialMessage));

    // Send sync status
    const syncMessage: SyncStatusMessage = {
      type: 'sync_status',
      elementCount: elementStore.size,
      timestamp: new Date().toISOString(),
    };
    ws.send(JSON.stringify(syncMessage));

    ws.on('message', () => {
      onActivity();
    });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
}

export function broadcastMessage(message: WebSocketMessage): void {
  broadcast(message);
}

export function getClientCount(): number {
  return clients.size;
}

export function closeWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (!wss) {
      resolve();
      return;
    }
    clients.forEach(client => client.close());
    clients.clear();
    wss.close(() => {
      wss = null;
      resolve();
    });
  });
}
