export type WritexAgentToolDefinition = {
  name: string;
  description: string;
  whenToUse: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
};

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
};

export const writexAgentToolDefinitions: WritexAgentToolDefinition[] = [
  {
    name: 'getProject',
    description: 'Read the full current WriteX project state.',
    whenToUse: 'Use before planning edits, resolving ids, checking existing chapters/entities, or deciding what to call next.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'exportProject',
    description: 'Return the current project as a .writexproj JSON payload.',
    whenToUse: 'Use after edits and commits when the agent needs to save or transmit the project.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'importProject',
    description: 'Replace the local browser project with a WriteX project payload.',
    whenToUse: 'Use when opening a shared project payload or restoring an exported .writexproj document.',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'object' },
        document: { type: 'object' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'createShareLink',
    description: 'Create a serverless URL that embeds the current WriteX project in the hash fragment.',
    whenToUse: 'Use when the user wants to send the story to another person without uploading it to a server.',
    parameters: {
      type: 'object',
      properties: {
        baseUrl: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'setTitle',
    description: 'Set the project title.',
    whenToUse: 'Use when the user names or renames the story/project.',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'createChapter',
    description: 'Append a new chapter with an H1 title and optional initial paragraph.',
    whenToUse: 'Use for new story sections. Keep body concise; subsequent writing can be added through richer document-editing tools later.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'updateChapterStatus',
    description: 'Set a chapter status to draft, revised, or final.',
    whenToUse: 'Use after writing or reviewing a chapter to reflect its workflow state.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string' },
        status: { type: 'string', enum: ['draft', 'revised', 'final'] },
      },
      required: ['chapterId', 'status'],
      additionalProperties: false,
    },
  },
  {
    name: 'commitChapter',
    description: 'Create a snapshot/version for one chapter.',
    whenToUse: 'Use after meaningful changes to a chapter, especially before global commits.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string' },
        label: { type: 'string' },
        branch: { type: 'string' },
      },
      required: ['chapterId', 'label'],
      additionalProperties: false,
    },
  },
  {
    name: 'commitGlobal',
    description: 'Create a project-wide version snapshot.',
    whenToUse: 'Use after a coherent editing milestone: story draft completed, entities linked, graph updated, or import finished.',
    parameters: {
      type: 'object',
      properties: {
        label: { type: 'string' },
        branch: { type: 'string' },
      },
      required: ['label'],
      additionalProperties: false,
    },
  },
  {
    name: 'createCategory',
    description: 'Create a new entity category.',
    whenToUse: 'Use only when the default categories are not enough for the user domain.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        icon: { type: 'string' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'createEntity',
    description: 'Create a narrative entity such as a character, place, object, or group.',
    whenToUse: 'Use before linking text to a new person/place/object/group. Resolve categoryId with getProject first.',
    parameters: {
      type: 'object',
      properties: {
        categoryId: { type: 'string' },
        name: { type: 'string' },
        avatar: { type: 'string' },
        image: { type: 'string' },
        desc: { type: 'string' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              value: { type: 'string' },
            },
            required: ['title', 'value'],
            additionalProperties: false,
          },
        },
      },
      required: ['categoryId', 'name'],
      additionalProperties: false,
    },
  },
  {
    name: 'createTodo',
    description: 'Create a todo note.',
    whenToUse: 'Use for unresolved writing tasks or editorial reminders.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        anchorId: { type: 'string' },
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'linkText',
    description: 'Attach exact document text to entities, todos, or graph snapshots.',
    whenToUse: 'Use after creating or finding an entity/snapshot/todo that should be connected to a text fragment.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        chapterId: { type: 'string' },
        occurrence: { type: 'number' },
        entityIds: stringArraySchema,
        todoIds: stringArraySchema,
        graphSnapshotIds: stringArraySchema,
      },
      required: ['text'],
      additionalProperties: false,
    },
  },
  {
    name: 'createGraphMap',
    description: 'Create a graph map container.',
    whenToUse: 'Use when the project needs a separate map/timeline space.',
    parameters: {
      type: 'object',
      properties: { label: { type: 'string' } },
      required: ['label'],
      additionalProperties: false,
    },
  },
  {
    name: 'createGraphSnapshot',
    description: 'Create a graph snapshot, optionally copied from an existing snapshot.',
    whenToUse: 'Use when the story state needs a visual relationship/map checkpoint.',
    parameters: {
      type: 'object',
      properties: {
        mapId: { type: 'string' },
        label: { type: 'string' },
        copyFromSnapshotId: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'addGraphNode',
    description: 'Place or replace an entity node in a graph snapshot.',
    whenToUse: 'Use after createGraphSnapshot when an entity should appear on the map/canvas.',
    parameters: {
      type: 'object',
      properties: {
        snapshotId: { type: 'string' },
        node: {
          type: 'object',
          properties: {
            entityId: { type: 'string' },
            position: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
              },
              required: ['x', 'y'],
              additionalProperties: false,
            },
            mapRole: { type: 'string', enum: ['entity', 'place'] },
          },
          required: ['entityId', 'position'],
          additionalProperties: false,
        },
      },
      required: ['snapshotId', 'node'],
      additionalProperties: false,
    },
  },
  {
    name: 'addGraphEdge',
    description: 'Create or replace a directed edge between two entities in a graph snapshot.',
    whenToUse: 'Use after both source and target entities exist, usually after placing nodes.',
    parameters: {
      type: 'object',
      properties: {
        snapshotId: { type: 'string' },
        edge: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sourceId: { type: 'string' },
            targetId: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['sourceId', 'targetId', 'type'],
          additionalProperties: false,
        },
      },
      required: ['snapshotId', 'edge'],
      additionalProperties: false,
    },
  },
];
