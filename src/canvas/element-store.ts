// src/canvas/element-store.ts
import { z } from 'zod';
import {
  ServerElement,
  ExcalidrawElementType,
  EXCALIDRAW_ELEMENT_TYPES,
  WebSocketMessage,
  ElementCreatedMessage,
  ElementUpdatedMessage,
  ElementDeletedMessage,
  BatchCreatedMessage,
} from '../types.js';

// --- ID generation (moved from types.ts:263-265) ---
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// --- Zod schemas (moved from server.ts:91-133) ---
export const CreateElementSchema = z.object({
  id: z.string().optional(),
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES) as [ExcalidrawElementType, ...ExcalidrawElementType[]]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  backgroundColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  text: z.string().optional(),
  label: z.object({ text: z.string() }).optional(),
  fontSize: z.number().optional(),
  fontFamily: z.number().optional(),
  groupIds: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
}).passthrough();

export const UpdateElementSchema = z.object({
  id: z.string(),
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES) as [ExcalidrawElementType, ...ExcalidrawElementType[]]).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  backgroundColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  text: z.string().optional(),
  label: z.object({ text: z.string() }).optional(),
  fontSize: z.number().optional(),
  fontFamily: z.number().optional(),
  groupIds: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
}).passthrough();

// --- Scene state (moved from index.ts:166-178) ---
interface SceneState {
  theme: string;
  viewport: { x: number; y: number; zoom: number };
  selectedElements: Set<string>;
  groups: Map<string, string[]>;
}

// --- Convert text to label (moved from index.ts:507-521) ---
function convertTextToLabel(element: ServerElement): ServerElement {
  const { text, ...rest } = element;
  if (text) {
    if (element.type === 'text') {
      return element;
    }
    return { ...rest, label: { text } } as ServerElement;
  }
  return element;
}

// --- Observer types ---
type ChangeListener = (message: WebSocketMessage) => void;

// --- ElementStore singleton ---
class ElementStore {
  private elements = new Map<string, ServerElement>();
  private listeners: ChangeListener[] = [];

  readonly sceneState: SceneState = {
    theme: 'light',
    viewport: { x: 0, y: 0, zoom: 1 },
    selectedElements: new Set(),
    groups: new Map(),
  };

  // --- Observer pattern ---
  onChange(listener: ChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(message: WebSocketMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  // --- CRUD ---
  getAll(): ServerElement[] {
    return Array.from(this.elements.values());
  }

  getById(id: string): ServerElement | undefined {
    return this.elements.get(id);
  }

  get size(): number {
    return this.elements.size;
  }

  has(id: string): boolean {
    return this.elements.has(id);
  }

  create(data: z.infer<typeof CreateElementSchema>): ServerElement {
    const id = data.id || generateId();
    const element: ServerElement = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const stored = convertTextToLabel(element);
    this.elements.set(id, stored);

    const message: ElementCreatedMessage = { type: 'element_created', element: stored };
    this.notify(message);

    return stored;
  }

  update(id: string, updates: Partial<ServerElement>): ServerElement {
    const existing = this.elements.get(id);
    if (!existing) {
      throw new Error(`Element with ID ${id} not found`);
    }

    const updated: ServerElement = {
      ...existing,
      ...updates,
      id, // preserve id
      updatedAt: new Date().toISOString(),
      version: (existing.version || 0) + 1,
    };

    const stored = convertTextToLabel(updated);
    this.elements.set(id, stored);

    const message: ElementUpdatedMessage = { type: 'element_updated', element: stored };
    this.notify(message);

    return stored;
  }

  delete(id: string): boolean {
    if (!this.elements.has(id)) {
      throw new Error(`Element with ID ${id} not found`);
    }

    this.elements.delete(id);

    const message: ElementDeletedMessage = { type: 'element_deleted', elementId: id };
    this.notify(message);

    return true;
  }

  query(type?: string, filters?: Record<string, any>): ServerElement[] {
    let results = Array.from(this.elements.values());

    if (type) {
      results = results.filter(el => el.type === type);
    }

    if (filters && Object.keys(filters).length > 0) {
      results = results.filter(el =>
        Object.entries(filters).every(([key, value]) => (el as any)[key] === value)
      );
    }

    return results;
  }

  // --- Batch operations ---
  batchCreate(items: z.infer<typeof CreateElementSchema>[]): ServerElement[] {
    const created: ServerElement[] = [];

    for (const data of items) {
      const id = data.id || generateId();
      const element: ServerElement = {
        id,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      const stored = convertTextToLabel(element);
      this.elements.set(id, stored);
      created.push(stored);
    }

    const message: BatchCreatedMessage = { type: 'elements_batch_created', elements: created };
    this.notify(message);

    return created;
  }

  // --- Sync (overwrite all) ---
  sync(frontendElements: any[], timestamp?: string): { count: number; beforeCount: number } {
    const beforeCount = this.elements.size;
    this.elements.clear();

    let count = 0;
    for (const el of frontendElements) {
      const id = el.id || generateId();
      const processed: ServerElement = {
        ...el,
        id,
        syncedAt: new Date().toISOString(),
        source: 'frontend_sync',
        syncTimestamp: timestamp,
        version: 1,
      };
      this.elements.set(id, processed);
      count++;
    }

    this.notify({
      type: 'elements_synced',
      count,
      timestamp: new Date().toISOString(),
      source: 'manual_sync',
    });

    return { count, beforeCount };
  }

  // --- Clear (for testing) ---
  clear(): void {
    this.elements.clear();
  }
}

// Singleton export
export const elementStore = new ElementStore();
