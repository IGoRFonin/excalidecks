// src/mcp/tools.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  CallToolRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import logger from '../utils/logger.js';
import {
  EXCALIDRAW_ELEMENT_TYPES,
  ExcalidrawElementType,
  ServerElement,
} from '../types.js';
import { elementStore, generateId } from '../canvas/element-store.js';
import { broadcastMessage } from '../canvas/websocket.js';

// --- Zod schemas for MCP input validation ---
const ElementSchema = z.object({
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES) as [ExcalidrawElementType, ...ExcalidrawElementType[]]),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  points: z.array(z.tuple([z.number(), z.number()])).optional(),
  backgroundColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().optional(),
  roughness: z.number().optional(),
  opacity: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.number().optional(),
  groupIds: z.array(z.string()).optional(),
  locked: z.boolean().optional(),
}).passthrough();

const ElementIdSchema = z.object({ id: z.string() });
const ElementIdsSchema = z.object({ elementIds: z.array(z.string()) });
const GroupIdSchema = z.object({ groupId: z.string() });

const AlignElementsSchema = z.object({
  elementIds: z.array(z.string()),
  alignment: z.enum(['left', 'center', 'right', 'top', 'middle', 'bottom']),
});

const DistributeElementsSchema = z.object({
  elementIds: z.array(z.string()),
  direction: z.enum(['horizontal', 'vertical']),
});

const QuerySchema = z.object({
  type: z.enum(Object.values(EXCALIDRAW_ELEMENT_TYPES) as [ExcalidrawElementType, ...ExcalidrawElementType[]]).optional(),
  filter: z.record(z.any()).optional(),
});

const ResourceSchema = z.object({
  resource: z.enum(['scene', 'library', 'theme', 'elements']),
});

// --- Tool definitions ---
const tools: Tool[] = [
  {
    name: 'create_element',
    description: 'Create a new Excalidraw element',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        points: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Point coordinates as [x,y] tuples for arrows/lines/freedraw' },
        backgroundColor: { type: 'string' },
        strokeColor: { type: 'string' },
        strokeWidth: { type: 'number' },
        roughness: { type: 'number' },
        opacity: { type: 'number' },
        text: { type: 'string' },
        fontSize: { type: 'number' },
        fontFamily: { type: 'number', description: '5=Excalifont, 6=Nunito, 7=Lilita One, 8=Comic Shanns' },
      },
      required: ['type', 'x', 'y'],
    },
  },
  {
    name: 'update_element',
    description: 'Update an existing Excalidraw element',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string', enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        points: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Point coordinates as [x,y] tuples for arrows/lines/freedraw' },
        backgroundColor: { type: 'string' },
        strokeColor: { type: 'string' },
        strokeWidth: { type: 'number' },
        roughness: { type: 'number' },
        opacity: { type: 'number' },
        text: { type: 'string' },
        fontSize: { type: 'number' },
        fontFamily: { type: 'number', description: '5=Excalifont, 6=Nunito, 7=Lilita One, 8=Comic Shanns' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_element',
    description: 'Delete an Excalidraw element',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'query_elements',
    description: 'Query Excalidraw elements with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) },
        filter: { type: 'object', additionalProperties: true },
      },
    },
  },
  {
    name: 'get_resource',
    description: 'Get an Excalidraw resource',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', enum: ['scene', 'library', 'theme', 'elements'] },
      },
      required: ['resource'],
    },
  },
  {
    name: 'group_elements',
    description: 'Group multiple elements together',
    inputSchema: {
      type: 'object',
      properties: { elementIds: { type: 'array', items: { type: 'string' } } },
      required: ['elementIds'],
    },
  },
  {
    name: 'ungroup_elements',
    description: 'Ungroup a group of elements',
    inputSchema: {
      type: 'object',
      properties: { groupId: { type: 'string' } },
      required: ['groupId'],
    },
  },
  {
    name: 'align_elements',
    description: 'Align elements to a specific position',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: { type: 'array', items: { type: 'string' } },
        alignment: { type: 'string', enum: ['left', 'center', 'right', 'top', 'middle', 'bottom'] },
      },
      required: ['elementIds', 'alignment'],
    },
  },
  {
    name: 'distribute_elements',
    description: 'Distribute elements evenly',
    inputSchema: {
      type: 'object',
      properties: {
        elementIds: { type: 'array', items: { type: 'string' } },
        direction: { type: 'string', enum: ['horizontal', 'vertical'] },
      },
      required: ['elementIds', 'direction'],
    },
  },
  {
    name: 'lock_elements',
    description: 'Lock elements to prevent modification',
    inputSchema: {
      type: 'object',
      properties: { elementIds: { type: 'array', items: { type: 'string' } } },
      required: ['elementIds'],
    },
  },
  {
    name: 'unlock_elements',
    description: 'Unlock elements to allow modification',
    inputSchema: {
      type: 'object',
      properties: { elementIds: { type: 'array', items: { type: 'string' } } },
      required: ['elementIds'],
    },
  },
  {
    name: 'create_from_mermaid',
    description: 'Convert a Mermaid diagram to Excalidraw elements and render them on the canvas',
    inputSchema: {
      type: 'object',
      properties: {
        mermaidDiagram: {
          type: 'string',
          description: 'The Mermaid diagram definition (e.g., "graph TD; A-->B; B-->C;")',
        },
        config: {
          type: 'object',
          description: 'Optional Mermaid configuration',
          properties: {
            startOnLoad: { type: 'boolean' },
            flowchart: {
              type: 'object',
              properties: { curve: { type: 'string', enum: ['linear', 'basis'] } },
            },
            themeVariables: {
              type: 'object',
              properties: { fontSize: { type: 'string' } },
            },
            maxEdges: { type: 'number' },
            maxTextSize: { type: 'number' },
          },
        },
      },
      required: ['mermaidDiagram'],
    },
  },
  {
    name: 'batch_create_elements',
    description: 'Create multiple Excalidraw elements at once - ideal for complex diagrams',
    inputSchema: {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: Object.values(EXCALIDRAW_ELEMENT_TYPES) },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              points: { type: 'array', items: { type: 'array', items: { type: 'number' } }, description: 'Point coordinates as [x,y] tuples for arrows/lines/freedraw' },
              backgroundColor: { type: 'string' },
              strokeColor: { type: 'string' },
              strokeWidth: { type: 'number' },
              roughness: { type: 'number' },
              opacity: { type: 'number' },
              text: { type: 'string' },
              fontSize: { type: 'number' },
              fontFamily: { type: 'number', description: '5=Excalifont, 6=Nunito, 7=Lilita One, 8=Comic Shanns' },
            },
            required: ['type', 'x', 'y'],
          },
        },
      },
      required: ['elements'],
    },
  },
];

// --- Register tools on MCP server ---
export function registerTools(
  server: Server,
  onActivity: () => void
): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.info('Listing available tools');
    return { tools };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
    onActivity();
    try {
      const { name, arguments: args } = request.params;
      logger.info(`Handling tool call: ${name}`);

      switch (name) {
        case 'create_element': {
          const params = ElementSchema.parse(args);
          logger.info('Creating element via MCP', { type: params.type });
          const element = elementStore.create(params);
          return {
            content: [{
              type: 'text',
              text: `Element created successfully!\n\n${JSON.stringify(element, null, 2)}`,
            }],
          };
        }

        case 'update_element': {
          const params = ElementIdSchema.merge(ElementSchema.partial()).parse(args);
          const { id, ...updates } = params;
          if (!id) throw new Error('Element ID is required');
          const element = elementStore.update(id, {
            ...updates,
            updatedAt: new Date().toISOString(),
          });
          return {
            content: [{
              type: 'text',
              text: `Element updated successfully!\n\n${JSON.stringify(element, null, 2)}`,
            }],
          };
        }

        case 'delete_element': {
          const { id } = ElementIdSchema.parse(args);
          elementStore.delete(id);
          return {
            content: [{
              type: 'text',
              text: `Element deleted successfully!\n\n${JSON.stringify({ id, deleted: true }, null, 2)}`,
            }],
          };
        }

        case 'query_elements': {
          const params = QuerySchema.parse(args || {});
          const results = elementStore.query(params.type, params.filter);
          return {
            content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
          };
        }

        case 'get_resource': {
          const { resource } = ResourceSchema.parse(args);
          logger.info('Getting resource', { resource });
          let result: any;
          switch (resource) {
            case 'scene':
              result = {
                theme: elementStore.sceneState.theme,
                viewport: elementStore.sceneState.viewport,
                selectedElements: Array.from(elementStore.sceneState.selectedElements),
              };
              break;
            case 'library':
            case 'elements':
              result = { elements: elementStore.getAll() };
              break;
            case 'theme':
              result = { theme: elementStore.sceneState.theme };
              break;
            default:
              throw new Error(`Unknown resource: ${resource}`);
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'group_elements': {
          const { elementIds } = ElementIdsSchema.parse(args);
          const groupId = generateId();
          elementStore.sceneState.groups.set(groupId, elementIds);

          let successCount = 0;
          for (const elId of elementIds) {
            const el = elementStore.getById(elId);
            if (el) {
              const existingGroups = el.groupIds || [];
              elementStore.update(elId, { groupIds: [...existingGroups, groupId] });
              successCount++;
            }
          }

          if (successCount === 0) {
            elementStore.sceneState.groups.delete(groupId);
            throw new Error('Failed to group any elements: elements not found');
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ groupId, elementIds, successCount }, null, 2),
            }],
          };
        }

        case 'ungroup_elements': {
          const { groupId } = GroupIdSchema.parse(args);
          if (!elementStore.sceneState.groups.has(groupId)) {
            throw new Error(`Group ${groupId} not found`);
          }

          const elementIds = elementStore.sceneState.groups.get(groupId);
          elementStore.sceneState.groups.delete(groupId);

          let successCount = 0;
          for (const elId of elementIds ?? []) {
            const el = elementStore.getById(elId);
            if (el) {
              const updatedGroupIds = (el.groupIds || []).filter(gid => gid !== groupId);
              elementStore.update(elId, { groupIds: updatedGroupIds });
              successCount++;
            }
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ groupId, ungrouped: true, elementIds, successCount }, null, 2),
            }],
          };
        }

        case 'align_elements': {
          const { elementIds, alignment } = AlignElementsSchema.parse(args);
          logger.info('Aligning elements', { elementIds, alignment });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ aligned: true, elementIds, alignment }, null, 2),
            }],
          };
        }

        case 'distribute_elements': {
          const { elementIds, direction } = DistributeElementsSchema.parse(args);
          logger.info('Distributing elements', { elementIds, direction });
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ distributed: true, elementIds, direction }, null, 2),
            }],
          };
        }

        case 'lock_elements': {
          const { elementIds } = ElementIdsSchema.parse(args);
          let successCount = 0;
          for (const elId of elementIds) {
            if (elementStore.has(elId)) {
              elementStore.update(elId, { locked: true });
              successCount++;
            }
          }
          if (successCount === 0) throw new Error('Failed to lock any elements: elements not found');
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ locked: true, elementIds, successCount }, null, 2),
            }],
          };
        }

        case 'unlock_elements': {
          const { elementIds } = ElementIdsSchema.parse(args);
          let successCount = 0;
          for (const elId of elementIds) {
            if (elementStore.has(elId)) {
              elementStore.update(elId, { locked: false });
              successCount++;
            }
          }
          if (successCount === 0) throw new Error('Failed to unlock any elements: elements not found');
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ unlocked: true, elementIds, successCount }, null, 2),
            }],
          };
        }

        case 'create_from_mermaid': {
          const params = z.object({
            mermaidDiagram: z.string(),
            config: z.object({
              startOnLoad: z.boolean().optional(),
              flowchart: z.object({ curve: z.enum(['linear', 'basis']).optional() }).optional(),
              themeVariables: z.object({ fontSize: z.string().optional() }).optional(),
              maxEdges: z.number().optional(),
              maxTextSize: z.number().optional(),
            }).optional(),
          }).parse(args);

          logger.info('Creating Excalidraw elements from Mermaid diagram via MCP', {
            diagramLength: params.mermaidDiagram.length,
            hasConfig: !!params.config,
          });

          broadcastMessage({
            type: 'mermaid_convert',
            mermaidDiagram: params.mermaidDiagram,
            config: params.config || {},
            timestamp: new Date().toISOString(),
          });

          return {
            content: [{
              type: 'text',
              text: `Mermaid diagram sent for conversion!\n\nNote: The actual conversion happens in the frontend canvas with DOM access. Open the canvas to see the diagram rendered.`,
            }],
          };
        }

        case 'batch_create_elements': {
          const params = z.object({ elements: z.array(ElementSchema) }).parse(args);
          logger.info('Batch creating elements via MCP', { count: params.elements.length });
          const created = elementStore.batchCreate(params.elements);
          return {
            content: [{
              type: 'text',
              text: `${created.length} elements created successfully!\n\n${JSON.stringify({ success: true, elements: created, count: created.length }, null, 2)}`,
            }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      logger.error(`Error handling tool call: ${(error as Error).message}`, { error });
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });
}
