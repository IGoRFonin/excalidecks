#!/usr/bin/env node

// Disable colors to prevent ANSI codes from breaking JSON parsing
process.env.NODE_DISABLE_COLORS = '1';
process.env.NO_COLOR = '1';

import { createServer } from 'http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import logger from './utils/logger.js';
import { createExpressApp } from './canvas/express-app.js';
import { initWebSocket, closeWebSocket } from './canvas/websocket.js';
import { registerTools } from './mcp/tools.js';

// Safety: redirect console.log to logger so nothing leaks to stdout
console.log = (...args: any[]) => logger.info(args.join(' '));

const PORT = parseInt(process.env.PORT || '41520', 10);
const HOST = process.env.HOST || 'localhost';
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const CANVAS_ONLY = process.argv.includes('--canvas-only');

// --- Inactivity timer ---
let inactivityTimer: ReturnType<typeof setTimeout> | null = null;

function resetInactivityTimer(): void {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    logger.info('No activity for 5 minutes, shutting down');
    shutdown();
  }, INACTIVITY_TIMEOUT_MS);
}

// --- Express + HTTP ---
const app = createExpressApp(resetInactivityTimer);
const httpServer = createServer(app);

// --- WebSocket ---
initWebSocket(httpServer, resetInactivityTimer);

// --- MCP (stdio) ---
let mcpServer: Server | null = null;

async function startMcp(): Promise<void> {
  mcpServer = new Server(
    {
      name: 'mcp-excalidraw-server',
      version: '1.0.2',
      description: 'Advanced MCP server for Excalidraw with real-time canvas',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  registerTools(mcpServer, resetInactivityTimer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  logger.info('MCP server running on stdio');
}

// --- Graceful shutdown ---
async function shutdown(): Promise<void> {
  logger.info('Shutting down...');
  if (inactivityTimer) clearTimeout(inactivityTimer);

  await closeWebSocket();

  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });

  process.exit(0);
}

// --- Start ---
httpServer.listen(PORT, HOST, async () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);

  if (!CANVAS_ONLY) {
    try {
      await startMcp();
    } catch (error) {
      logger.error('Failed to start MCP server:', error);
      process.stderr.write(`Failed to start MCP server: ${(error as Error).message}\n`);
      process.exit(1);
    }
  } else {
    logger.info('Running in canvas-only mode (no MCP)');
  }

  resetInactivityTimer();
});

// --- Error handlers ---
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception:', error);
  process.stderr.write(`UNCAUGHT EXCEPTION: ${error.message}\n${error.stack}\n`);
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection:', reason);
  process.stderr.write(`UNHANDLED REJECTION: ${reason}\n`);
  setTimeout(() => process.exit(1), 1000);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
