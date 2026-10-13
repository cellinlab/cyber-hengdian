#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { actorTupleSchemas } from '../src/core/actor';
import { quat, transactionSchema, transformSchema, vec3 } from '../src/core/schema';
import { request, uploadReference, ServiceError } from './client';
import { partSelectionSchema } from '../src/core/parts';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

// MCP's SDK emits draft-7 tuple items as an array of schemas. Codex accepts one
// homogeneous items schema, so advertise these numeric tuples as fixed-length
// arrays. This registry is local to this MCP process; runtime Zod tuple,
// quaternion and scale validation stays intact.
for (const [schema, length] of [
  [vec3, 3],
  [quat, 4],
  [transformSchema.shape.scale, 3],
] as const) {
  z.globalRegistry.add(schema, {
    items: { type: 'number' },
    minItems: length,
    maxItems: length,
  });
}

for (const tuple of actorTupleSchemas)
  z.globalRegistry.add(tuple, { items: { type: 'number' }, minItems: 3, maxItems: 3 });

const server = new McpServer(
  { name: 'cyber-hengdian', version: '0.1.0' },
  {
    instructions:
      'Read project and schema before editing. Use stable IDs, explicit baseRevision and requestId. Apply one atomic transaction, then read and inspect to verify. A 409 requires re-reading and reconsidering the edit; never overwrite newer work. Exports are asynchronous; queued or running is not success. This is a previsualization tool, not a video generation service.',
  },
);
async function call(
  path: string,
  body?: unknown,
  select: (data: unknown) => unknown = (data) => data,
): Promise<CallToolResult> {
  try {
    const data = select(await request(path, body));
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      structuredContent: { data },
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: error instanceof ServiceError ? error.status : undefined,
          }),
        },
      ],
    };
  }
}
const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
server.registerTool(
  'read_project',
  {
    description:
      'Read authoritative saved project and revision. Begin every edit here; IDs are stable. Does not return an image.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('/api/project'),
);
server.registerTool(
  'list_catalog',
  {
    description:
      'List stage packs, prop kinds, shot recipes, 30 built-in model definitions, scene templates, assemblies, actor pose presets and joint limits. These describe supported capabilities, not a remote asset marketplace.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('/api/catalog'),
);
server.registerTool(
  'use_scene_template',
  {
    description:
      'Replace the current project with a complete editable built-in scene. Find IDs in list_catalog.sceneTemplates. Requires the observed revision. Existing scene is replaced and can be undone in the director. Read and visually preview the result.',
    inputSchema: { id: z.string().min(1).max(100), baseRevision: z.number().int().nonnegative() },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  ({ id, baseRevision }) =>
    call('/api/scenes/' + encodeURIComponent(id) + '/instantiate', { baseRevision }),
);
server.registerTool(
  'add_assembly',
  {
    description:
      'Append a reusable group of independently editable props in one atomic operation. Find IDs in list_catalog.assemblies. Position is a world-space metre offset. Requires observed baseRevision and unique requestId; safe replay uses the same arguments. Does not create a persistent parent group.',
    inputSchema: {
      id: z.string().min(1).max(100),
      baseRevision: z.number().int().nonnegative(),
      requestId: z.string().min(1).max(100),
      position: vec3.default([0, 0, 0]),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  ({ id, ...input }) => call('/api/assemblies/' + encodeURIComponent(id) + '/instantiate', input),
);
server.registerTool(
  'inspect_meshes',
  {
    description:
      'List stable mesh child-index paths from the actual loaded entity. Use these paths to assign disjoint semantic parts with part.set. Duplicate node names do not identify meshes. Returns observed revision; reject stale edits.',
    inputSchema: { entityId: z.string().min(1) },
    annotations: readOnly,
  },
  ({ entityId }) => call('/api/nodes', { entityId }),
);
server.registerTool(
  'upload_reference',
  {
    description:
      'Import one PNG/JPEG/WebP from an explicitly supplied absolute local file path into the selected loopback workspace. Returns content hash and image size, not a saved binding. Register with reference.add and bind referenceIds via an atomic transaction. Only import images requested for this creative task.',
    inputSchema: { file: z.string().min(1) },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ file }) => {
    try {
      const data = await uploadReference(file);
      return {
        content: [{ type: 'text', text: JSON.stringify(data) }],
        structuredContent: { data },
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              status: error instanceof ServiceError ? error.status : undefined,
            }),
          },
        ],
      };
    }
  },
);
server.registerTool(
  'list_packs',
  {
    description:
      'List built-in and locally installed stage packs. Referenced GLB assets must already be uploaded before a pack can be used.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('/api/packs'),
);
server.registerTool(
  'use_pack',
  {
    description:
      'Replace the current project with a stage pack. Pin version from list_packs for external packs; multiple installed versions require it. Read the current revision first; this resets the scene and shots. Verify by reading the project afterward. Conflicts must not be retried blindly.',
    inputSchema: {
      id: z.string().min(1).max(100),
      baseRevision: z.number().int().nonnegative(),
      version: z
        .string()
        .regex(/^\d+\.\d+\.\d+$/)
        .optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  ({ id, baseRevision, version }) =>
    call('/api/packs/' + encodeURIComponent(id) + '/instantiate', { baseRevision, version }),
);
server.registerTool(
  'get_schema',
  {
    description:
      'Read JSON schemas, optionally limited to project, operation, or pack to reduce context. For edits choose operation. Omitting scope returns all schemas for compatibility. Runtime validation additionally checks references and time boundaries.',
    inputSchema: { scope: z.enum(['all', 'project', 'operation', 'pack']).default('all') },
    annotations: readOnly,
  },
  ({ scope }) =>
    call('/api/schema', undefined, (data) => {
      if (scope === 'all') return data;
      const schemas = z
        .object({ project: z.unknown(), operation: z.unknown(), pack: z.unknown() })
        .parse(data);
      return { [scope]: schemas[scope] };
    }),
);
server.registerTool(
  'apply_operations',
  {
    description:
      'Atomically apply typed edits to the shared project. Requires observed baseRevision and unique requestId. The last 50 accepted request IDs can be replayed idempotently; replay results may be older than the current project. Conflict: read_project and reconsider, never just increment baseRevision. Verify with read_project and inspect_project.',
    inputSchema: transactionSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  (input) => call('/api/commands', input),
);
server.registerTool(
  'inspect_project',
  {
    description:
      'Summarize structural validity and available warnings. This does not judge visual quality, shot framing, motion contact or generated footage.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('/api/inspect'),
);
server.registerTool(
  'preview_shot',
  {
    description:
      'Render an actual saved-project frame at the requested shot time. Returns PNG image content plus revision, camera, timing and per-entity framing metadata. Framing uses projected world bounds and does not prove occlusion or visibility. A still does not prove motion or contact quality. Requires the local browser renderer. Check host/model image support before claiming visual judgment.',
    inputSchema: {
      shotId: z.string().min(1),
      time: z.number().finite().nonnegative().default(0),
      pass: z.enum(['rgb', 'depth', 'id', 'part-id', 'mask', 'highlight']).default('rgb'),
      selection: partSelectionSchema.optional(),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    try {
      const preview = z
        .object({
          revision: z.number(),
          shotId: z.string(),
          time: z.number(),
          width: z.number(),
          height: z.number(),
          mimeType: z.literal('image/png'),
          image: z.string(),
          camera: z.unknown(),
          pass: z.string().optional(),
          selection: partSelectionSchema.optional(),
          framing: z.array(
            z.object({
              id: z.string(),
              intersectsFrame: z.boolean(),
              screenBounds: z.object({
                left: z.number(),
                right: z.number(),
                top: z.number(),
                bottom: z.number(),
              }),
              note: z.string(),
            }),
          ),
        })
        .parse(await request('/api/preview', input, 45000));
      const { image, ...metadata } = preview;
      return {
        content: [
          { type: 'image' as const, data: image, mimeType: preview.mimeType },
          { type: 'text' as const, text: JSON.stringify(metadata, null, 2) },
        ],
        structuredContent: metadata,
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              status: error instanceof ServiceError ? error.status : undefined,
            }),
          },
        ],
      };
    }
  },
);
server.registerTool(
  'create_export',
  {
    description:
      'Start an asynchronous export from the observed project revision. Produces a ZIP with reference MP4, keyframes, project, camera data and assets; optional depth/ID frames. This is not an AI generation call. Read list_exports for actual completion before reporting a result. Requires local browser and FFmpeg.',
    inputSchema: {
      baseRevision: z.number().int().nonnegative(),
      shotId: z.string().min(1),
      size: z.union([z.literal(640), z.literal(1280)]).default(1280),
      controls: z.boolean().default(false),
      parts: z.array(partSelectionSchema).max(16).optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  (input) => call('/api/exports', input),
);
server.registerTool(
  'list_exports',
  {
    description:
      'List exports with queued/running/complete/failed/cancelled status and progress. Download completed jobs at HENGDIAN_URL/api/exports/ID/download. Report errors accurately.',
    inputSchema: {},
    annotations: readOnly,
  },
  () => call('/api/exports'),
);
server.registerTool(
  'cancel_export',
  {
    description:
      'Cancel a specific export job. Does not change the project; completed jobs remain available.',
    inputSchema: { id: z.string().min(1).max(100) },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  ({ id }) => call('/api/exports/' + encodeURIComponent(id) + '/cancel', {}),
);
server.registerResource(
  'project',
  'hengdian://project',
  {
    title: 'Current saved project',
    mimeType: 'application/json',
    description: 'Authoritative project and revision; same state as director and CLI.',
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: 'application/json',
        text: JSON.stringify(await request('/api/project'), null, 2),
      },
    ],
  }),
);
await server.connect(new StdioServerTransport());
