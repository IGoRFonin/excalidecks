// src/canvas/express-app.ts
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import logger from '../utils/logger.js';
import { elementStore, CreateElementSchema, UpdateElementSchema } from './element-store.js';
import { SERVER_VERSION } from '../version.js';
import { getClientCount, broadcastMessage } from './websocket.js';

export function createExpressApp(onActivity: () => void): express.Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  // Activity tracking middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    onActivity();
    next();
  });

  // --- Static files ---
  // Resolve frontend path relative to this file's location.
  // tsup bundled: dist/index.js → dist/frontend/
  // tsc compiled: dist/canvas/express-app.js → dist/frontend/
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  let frontendDir = path.join(__dirname, 'frontend'); // tsup: dist/frontend
  if (!fs.existsSync(frontendDir)) {
    frontendDir = path.join(__dirname, '../frontend'); // tsc: dist/canvas/../frontend
  }
  if (!fs.existsSync(frontendDir)) {
    frontendDir = path.join(__dirname, '../../dist/frontend'); // fallback
  }

  app.use(express.static(frontendDir));

  // --- API Routes ---

  // Get all elements
  app.get('/api/elements', (_req: Request, res: Response) => {
    try {
      const elements = elementStore.getAll();
      res.json({ success: true, elements, count: elements.length });
    } catch (error) {
      logger.error('Error fetching elements:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Batch create elements (must be before /:id route)
  app.post('/api/elements/batch', (req: Request, res: Response) => {
    try {
      const { elements: elementsToCreate } = req.body;
      if (!Array.isArray(elementsToCreate)) {
        return res.status(400).json({ success: false, error: 'Expected an array of elements' });
      }
      const validated = elementsToCreate.map(el => CreateElementSchema.parse(el));
      const created = elementStore.batchCreate(validated);
      res.json({ success: true, elements: created, count: created.length });
    } catch (error) {
      logger.error('Error batch creating elements:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Mermaid conversion (broadcast to frontend)
  app.post('/api/elements/from-mermaid', (req: Request, res: Response) => {
    try {
      const { mermaidDiagram, config } = req.body;
      if (!mermaidDiagram || typeof mermaidDiagram !== 'string') {
        return res.status(400).json({ success: false, error: 'Mermaid diagram definition is required' });
      }
      logger.info('Received Mermaid conversion request', {
        diagramLength: mermaidDiagram.length,
        hasConfig: !!config,
      });
      broadcastMessage({
        type: 'mermaid_convert',
        mermaidDiagram,
        config: config || {},
        timestamp: new Date().toISOString(),
      });
      res.json({
        success: true,
        mermaidDiagram,
        config: config || {},
        message: 'Mermaid diagram sent to frontend for conversion.',
      });
    } catch (error) {
      logger.error('Error processing Mermaid diagram:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Query elements with filters
  app.get('/api/elements/search', (req: Request, res: Response) => {
    try {
      const { type, ...filters } = req.query;
      const results = elementStore.query(
        type as string | undefined,
        Object.keys(filters).length > 0
          ? Object.fromEntries(Object.entries(filters).map(([k, v]) => [k, String(v)]))
          : undefined
      );
      res.json({ success: true, elements: results, count: results.length });
    } catch (error) {
      logger.error('Error querying elements:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Sync elements from frontend (overwrite)
  app.post('/api/elements/sync', (req: Request, res: Response) => {
    try {
      const { elements: frontendElements, timestamp } = req.body;
      if (!Array.isArray(frontendElements)) {
        return res.status(400).json({ success: false, error: 'Expected elements to be an array' });
      }
      logger.info(`Sync request received: ${frontendElements.length} elements`, { timestamp });
      const { count, beforeCount } = elementStore.sync(frontendElements, timestamp);
      logger.info(`Sync completed: ${count}/${frontendElements.length} elements synced`);
      res.json({
        success: true,
        message: `Successfully synced ${count} elements`,
        count,
        syncedAt: new Date().toISOString(),
        beforeCount,
        afterCount: elementStore.size,
      });
    } catch (error) {
      logger.error('Sync error:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Load a full Excalidraw scene (clear + batch create)
  app.post('/api/load', (req: Request, res: Response) => {
    try {
      const { elements: elementsToLoad } = req.body;
      if (!Array.isArray(elementsToLoad)) {
        return res.status(400).json({ success: false, error: 'Expected elements array' });
      }
      elementStore.clear();
      const validated = elementsToLoad.map(el => CreateElementSchema.parse(el));
      const created = elementStore.batchCreate(validated);
      logger.info(`Loaded scene: ${created.length} elements`);
      res.json({ success: true, count: created.length, elements: created });
    } catch (error) {
      logger.error('Error loading scene:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Create new element
  app.post('/api/elements', (req: Request, res: Response) => {
    try {
      const params = CreateElementSchema.parse(req.body);
      logger.info('Creating element via API', { type: params.type });
      const element = elementStore.create(params);
      res.json({ success: true, element });
    } catch (error) {
      logger.error('Error creating element:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Batch update elements (must be before /:id route)
  app.put('/api/elements/batch', (req: Request, res: Response) => {
    try {
      const { elements: elementsToUpdate } = req.body;
      if (!Array.isArray(elementsToUpdate)) {
        return res.status(400).json({ success: false, error: 'Expected an array of elements with id fields' });
      }
      const validated = elementsToUpdate.map(el => UpdateElementSchema.parse(el));
      const updated = elementStore.batchUpdate(validated);
      res.json({ success: true, elements: updated, count: updated.length });
    } catch (error) {
      logger.error('Error batch updating elements:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Get element by ID
  app.get('/api/elements/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Element ID is required' });
      }
      const element = elementStore.getById(id);
      if (!element) {
        return res.status(404).json({ success: false, error: `Element with ID ${id} not found` });
      }
      res.json({ success: true, element });
    } catch (error) {
      logger.error('Error fetching element:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Update element
  app.put('/api/elements/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Element ID is required' });
      }
      const element = elementStore.update(id, req.body);
      res.json({ success: true, element });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ success: false, error: (error as Error).message });
      }
      logger.error('Error updating element:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Delete all elements (clear canvas)
  app.delete('/api/elements', (_req: Request, res: Response) => {
    try {
      const count = elementStore.size;
      elementStore.clear();
      res.json({ success: true, message: `Cleared ${count} elements` });
    } catch (error) {
      logger.error('Error clearing elements:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Batch delete elements (must be before /:id route)
  app.delete('/api/elements/batch', (req: Request, res: Response) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        return res.status(400).json({ success: false, error: 'Expected ids array' });
      }
      const result = elementStore.batchDelete(ids);
      res.json({ success: true, ...result });
    } catch (error) {
      logger.error('Error batch deleting elements:', error);
      res.status(400).json({ success: false, error: (error as Error).message });
    }
  });

  // Delete element
  app.delete('/api/elements/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ success: false, error: 'Element ID is required' });
      }
      elementStore.delete(id);
      res.json({ success: true, message: `Element ${id} deleted successfully` });
    } catch (error) {
      if ((error as Error).message.includes('not found')) {
        return res.status(404).json({ success: false, error: (error as Error).message });
      }
      logger.error('Error deleting element:', error);
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  // Serve frontend index.html
  app.get('/', (_req: Request, res: Response) => {
    const htmlFile = path.join(frontendDir, 'index.html');
    res.sendFile(htmlFile, (err) => {
      if (err) {
        logger.error('Error serving frontend:', err);
        res.status(404).send('Frontend not found. Please run "npm run build" first.');
      }
    });
  });

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      version: SERVER_VERSION,
      timestamp: new Date().toISOString(),
      elements_count: elementStore.size,
      websocket_clients: getClientCount(),
    });
  });

  // Sync status
  app.get('/api/sync/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      elementCount: elementStore.size,
      timestamp: new Date().toISOString(),
      memoryUsage: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
      websocketClients: getClientCount(),
    });
  });

  // Error handling middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  });

  return app;
}
