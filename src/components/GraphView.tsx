import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import type { NodeChange, EdgeChange, Node, Edge, Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CornerUpLeft,
  Edit3,
  FastForward,
  GripVertical,
  MapIcon,
  Pause,
  Play,
  Plus,
  Rewind,
  Trash2,
} from 'lucide-react';
import type { Entity, Category, GraphMap, GraphSnapshot, GraphNodeData, GraphEdgeData } from '../types';

const uid = () => Math.random().toString(36).substring(2, 10);
type GraphEditMode = 'map' | 'links';
type RelationChoice = 'AUTO' | 'STA_IN' | 'CONTENUTO_IN' | 'APPARTIENE_A' | 'CONOSCE' | 'ALLEATO' | 'NEMICO' | 'CAUSA' | 'VISUALE';

const RELATION_OPTIONS: Array<{ value: RelationChoice; label: string }> = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'STA_IN', label: 'Sta in' },
  { value: 'CONTENUTO_IN', label: 'Contenuto in' },
  { value: 'APPARTIENE_A', label: 'Appartiene a' },
  { value: 'CONOSCE', label: 'Conosce' },
  { value: 'ALLEATO', label: 'Alleato' },
  { value: 'NEMICO', label: 'Nemico' },
  { value: 'CAUSA', label: 'Causa' },
  { value: 'VISUALE', label: 'Visuale' },
];

function inferRelationType(sourceCat: string, targetCat: string): string {
  const s = sourceCat.toLowerCase();
  const t = targetCat.toLowerCase();
  if ((s.includes('gruppo') || s.includes('gruppi')) && t.includes('oggett')) return 'APPARTIENE_A';
  if (s.includes('oggett') && t.includes('oggett')) return 'CONTENUTO_IN';
  return 'STA_IN';
}

function getRelationStyle(type: string) {
  if (type === 'STA_IN') return { stroke: '#22c55e', dash: undefined };
  if (type === 'CONTENUTO_IN') return { stroke: '#f59e0b', dash: '5 4' };
  if (type === 'APPARTIENE_A') return { stroke: '#6366f1', dash: undefined };
  if (type === 'CONOSCE') return { stroke: '#0ea5e9', dash: '3 3' };
  if (type === 'ALLEATO') return { stroke: '#16a34a', dash: undefined };
  if (type === 'NEMICO') return { stroke: '#dc2626', dash: '7 4' };
  if (type === 'CAUSA') return { stroke: '#7c2d12', dash: undefined };
  return { stroke: 'var(--text-subtle)', dash: '2 5' };
}

const getCategoryColor = (catName: string = '') => {
  const name = catName.toLowerCase();
  if (name.includes('personagg')) return '#ef4444';
  if (name.includes('luogh')) return '#22c55e';
  if (name.includes('oggett')) return '#f59e0b';
  if (name.includes('grupp')) return '#6366f1';

  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues = [0, 45, 160, 210, 270, 320];
  return `hsl(${hues[hash % hues.length]}, 70%, 55%)`;
};

function EntityNode({ data }: any) {
  const { entity, category, isInvalid, warnings } = data;
  const color = getCategoryColor(category?.name);
  const isPlace = data.mapRole === 'place';

  return (
    <div
      className={`graph-entity-node ${isPlace ? 'is-place' : ''}`}
      data-invalid={isInvalid || undefined}
      style={{ borderTop: `4px solid ${color}` }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle" />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {entity.image ? (
          <div className="graph-node-img compact" style={{ backgroundImage: `url(${entity.image})` }} />
        ) : (
          <div
            className="graph-node-avatar compact"
            style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}40` }}
          >
            {entity.avatar}
          </div>
        )}
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div className="graph-node-name">{entity.name}</div>
          <div className="graph-node-cat" style={{ color }}>{isPlace ? 'Luogo sulla mappa' : category?.name}</div>
        </div>
      </div>

      {isInvalid && (
        <div className="graph-node-warning">
          {warnings.map((warning: string, index: number) => <div key={index}>{warning}</div>)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="graph-handle" />
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode };

interface GraphViewProps {
  entities: Entity[];
  categories: Category[];
  graphMaps: GraphMap[];
  setGraphMaps: React.Dispatch<React.SetStateAction<GraphMap[]>>;
  activeGraphMapId: string;
  setActiveGraphMapId: React.Dispatch<React.SetStateAction<string>>;
  graphSnapshots: GraphSnapshot[];
  setGraphSnapshots: React.Dispatch<React.SetStateAction<GraphSnapshot[]>>;
  activeGraphId: string | null;
  setActiveGraphId: React.Dispatch<React.SetStateAction<string | null>>;
  navigationContext?: { linkId: string; snapshotLabel: string } | null;
  onReturnToContext?: () => void;
  readOnly?: boolean;
}

function validateGraph(graphNodes: GraphNodeData[], graphEdges: GraphEdgeData[], entities: Entity[], categories: Category[]) {
  const invalidNodeIds = new Set<string>();
  const nodeWarnings: Record<string, string[]> = {};

  graphNodes.forEach(graphNode => {
    const entity = entities.find(item => item.id === graphNode.entityId);
    if (!entity) return;
    const category = categories.find(item => item.id === entity.categoryId);
    if (!category) return;
    const name = category.name.toLowerCase();
    const outgoing = graphEdges.filter(edge => edge.sourceId === graphNode.entityId);

    if (name.includes('oggett') && outgoing.filter(edge => edge.type === 'STA_IN').length > 1) {
      invalidNodeIds.add(graphNode.entityId);
      nodeWarnings[graphNode.entityId] = [...(nodeWarnings[graphNode.entityId] || []), 'Piu di un luogo (STA_IN)'];
    }

    if (name.includes('grupp') && outgoing.filter(edge => edge.type === 'APPARTIENE_A').length > 1) {
      invalidNodeIds.add(graphNode.entityId);
      nodeWarnings[graphNode.entityId] = [...(nodeWarnings[graphNode.entityId] || []), 'Appartiene a piu entita'];
    }
  });

  return { invalidNodeIds, nodeWarnings };
}

function collectLinkedNodeIds(startIds: string[], edges: GraphEdgeData[]) {
  const linked = new Set(startIds);
  const queue = [...startIds];

  while (queue.length) {
    const current = queue.shift();
    if (!current) continue;
    edges.forEach(edge => {
      const next = edge.sourceId === current ? edge.targetId : edge.targetId === current ? edge.sourceId : null;
      if (next && !linked.has(next)) {
        linked.add(next);
        queue.push(next);
      }
    });
  }

  return linked;
}

function GraphCanvas({
  activeGraph,
  entities,
  categories,
  editMode,
  isPlaying,
  propagateLinkedMovement,
  relationChoice,
  selectedEdgeId,
  onSelectEdge,
  onPersistNodes,
  onPersistNodeRemove,
  onPersistEdgeRemove,
  onPersistEdgeAdd,
  onDropEntity,
  readOnly,
}: {
  activeGraph: GraphSnapshot;
  entities: Entity[];
  categories: Category[];
  editMode: GraphEditMode;
  isPlaying: boolean;
  propagateLinkedMovement: boolean;
  relationChoice: RelationChoice;
  selectedEdgeId: string | null;
  onSelectEdge: (edgeId: string | null) => void;
  onPersistNodes: (nodes: GraphNodeData[]) => void;
  onPersistNodeRemove: (nodeIds: string[]) => void;
  onPersistEdgeRemove: (edgeIds: string[]) => void;
  onPersistEdgeAdd: (edge: GraphEdgeData) => void;
  onDropEntity: (entityId: string, position: { x: number; y: number }) => void;
  readOnly: boolean;
}) {
  const { invalidNodeIds, nodeWarnings } = useMemo(
    () => validateGraph(activeGraph.nodes, activeGraph.edges, entities, categories),
    [activeGraph.nodes, activeGraph.edges, entities, categories]
  );

  const flowNodes: Node[] = useMemo(() => activeGraph.nodes.map(graphNode => {
    const entity = entities.find(item => item.id === graphNode.entityId);
    const category = entity ? categories.find(item => item.id === entity.categoryId) : null;
    return {
      id: graphNode.entityId,
      type: 'entityNode',
      position: graphNode.position,
      data: {
        entity: entity || { avatar: '?', name: '???', image: undefined },
        category,
        mapRole: graphNode.mapRole,
        isInvalid: invalidNodeIds.has(graphNode.entityId),
        warnings: nodeWarnings[graphNode.entityId] || [],
      },
    };
  }), [activeGraph.nodes, entities, categories, invalidNodeIds, nodeWarnings]);

  const flowEdges: Edge[] = useMemo(() => {
    if (editMode === 'map') return [];

    return activeGraph.edges.map(graphEdge => {
      const relationStyle = getRelationStyle(graphEdge.type);
      const selected = graphEdge.id === selectedEdgeId;
      return {
        id: graphEdge.id,
        source: graphEdge.sourceId,
        target: graphEdge.targetId,
        label: graphEdge.type === 'VISUALE' ? '' : graphEdge.type,
        type: 'default',
        style: {
          stroke: selected ? 'var(--accent-2)' : relationStyle.stroke,
          strokeWidth: selected ? 3 : 2,
          strokeDasharray: relationStyle.dash,
        },
        labelStyle: { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 },
        markerEnd: { type: MarkerType.ArrowClosed, color: selected ? 'var(--accent-2)' : relationStyle.stroke },
      };
    });
  }, [activeGraph.edges, editMode, selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const pendingConnectionSourceRef = useRef<string | null>(null);

  useEffect(() => {
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [flowNodes, flowEdges, setNodes, setEdges]);

  const onNodeDragStop = useCallback((_event: any, _node: Node, draggedNodes: Node[]) => {
    if (isPlaying || readOnly) return;
    const nextNodes = activeGraph.nodes.map(item => ({ ...item, position: { ...item.position } }));
    const deltas = draggedNodes.map(dragged => {
      const previous = activeGraph.nodes.find(item => item.entityId === dragged.id);
      if (!previous) return null;
      return {
        entityId: dragged.id,
        dx: dragged.position.x - previous.position.x,
        dy: dragged.position.y - previous.position.y,
      };
    }).filter(Boolean) as Array<{ entityId: string; dx: number; dy: number }>;

    deltas.forEach(delta => {
      const affected = propagateLinkedMovement
        ? collectLinkedNodeIds([delta.entityId], activeGraph.edges)
        : new Set([delta.entityId]);

      nextNodes.forEach(node => {
        if (!affected.has(node.entityId)) return;
        node.position = {
          x: node.position.x + delta.dx,
          y: node.position.y + delta.dy,
        };
      });
    });

    onPersistNodes(nextNodes);
    setNodes(current => current.map(node => {
      const persisted = nextNodes.find(item => item.entityId === node.id);
      return persisted ? { ...node, position: persisted.position } : node;
    }));
  }, [activeGraph.nodes, activeGraph.edges, isPlaying, propagateLinkedMovement, onPersistNodes, readOnly, setNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    if (readOnly) return;
    onNodesChange(changes);
    const removals = changes.filter(change => change.type === 'remove').map(change => change.id);
    if (removals.length > 0) onPersistNodeRemove(removals);
  }, [onNodesChange, onPersistNodeRemove, readOnly]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (readOnly) return;
    onEdgesChange(changes);
    const removals = changes.filter(change => change.type === 'remove').map(change => change.id);
    if (removals.length > 0) onPersistEdgeRemove(removals);
  }, [onEdgesChange, onPersistEdgeRemove, readOnly]);

  const createEdgeBetween = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId || isPlaying || editMode === 'map' || readOnly) return;
    const sourceEnt = entities.find(entity => entity.id === sourceId);
    const targetEnt = entities.find(entity => entity.id === targetId);
    if (!sourceEnt || !targetEnt) return;
    const alreadyExists = activeGraph.edges.some(edge =>
      edge.sourceId === sourceId &&
      edge.targetId === targetId &&
      (relationChoice === 'AUTO' || edge.type === relationChoice)
    );
    if (alreadyExists) return;
    const sourceCat = categories.find(category => category.id === sourceEnt.categoryId)?.name || '';
    const targetCat = categories.find(category => category.id === targetEnt.categoryId)?.name || '';
    const relationType = relationChoice === 'AUTO'
      ? inferRelationType(sourceCat, targetCat)
      : relationChoice;
    const newEdge: GraphEdgeData = {
      id: `edge-${uid()}`,
      sourceId: sourceEnt.id,
      targetId: targetEnt.id,
      type: relationType,
    };
    const relationStyle = getRelationStyle(newEdge.type);
    const flowEdge: Edge = {
      id: newEdge.id,
      source: newEdge.sourceId,
      target: newEdge.targetId,
      label: newEdge.type === 'VISUALE' ? '' : newEdge.type,
      type: 'default',
      style: { stroke: relationStyle.stroke, strokeWidth: 2, strokeDasharray: relationStyle.dash },
      labelStyle: { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 },
      markerEnd: { type: MarkerType.ArrowClosed, color: relationStyle.stroke },
    };
    setEdges(current => addEdge(flowEdge, current));
    onPersistEdgeAdd(newEdge);
    onSelectEdge(newEdge.id);
  }, [activeGraph.edges, entities, categories, isPlaying, editMode, relationChoice, readOnly, setEdges, onPersistEdgeAdd, onSelectEdge]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    pendingConnectionSourceRef.current = null;
    createEdgeBetween(params.source, params.target);
  }, [createEdgeBetween]);

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const sourceId = pendingConnectionSourceRef.current;
    pendingConnectionSourceRef.current = null;
    if (!sourceId || editMode === 'map' || readOnly) return;

    const point = event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : event.changedTouches[0]
        ? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
        : null;
    if (!point) return;

    const target = document.elementFromPoint(point.x, point.y);
    const nodeElement = target?.closest('.react-flow__node') as HTMLElement | null;
    const targetId = nodeElement?.dataset.id;
    if (targetId) {
      createEdgeBetween(sourceId, targetId);
    }
  }, [editMode, createEdgeBetween, readOnly]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    if (readOnly) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, [readOnly]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (isPlaying || readOnly) return;
    const entityId = event.dataTransfer.getData('application/entity-id');
    if (!entityId || !reactFlowInstance) return;
    if (activeGraph.nodes.some(node => node.entityId === entityId)) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    onDropEntity(entityId, position);
  }, [isPlaying, readOnly, reactFlowInstance, activeGraph.nodes, onDropEntity]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onConnectStart={(_event, params) => {
        pendingConnectionSourceRef.current = readOnly ? null : params.nodeId ?? null;
      }}
      onConnectEnd={onConnectEnd}
      onEdgeClick={(_event, edge) => onSelectEdge(edge.id)}
      onPaneClick={() => onSelectEdge(null)}
      onNodeDragStop={onNodeDragStop}
      onInit={setReactFlowInstance}
      onDragOver={onDragOver}
      onDrop={onDrop}
      deleteKeyCode={isPlaying || readOnly ? null : ['Backspace', 'Delete']}
      nodesDraggable={!isPlaying && !readOnly}
      nodesConnectable={!isPlaying && !readOnly && editMode === 'links'}
      className={`graph-flow ${isPlaying ? 'is-playing' : ''}`}
      fitView
    >
      <Background color="var(--border)" gap={24} />
      <Controls />
    </ReactFlow>
  );
}

export function GraphView({
  entities,
  categories,
  graphMaps,
  setGraphMaps,
  activeGraphMapId,
  setActiveGraphMapId,
  graphSnapshots,
  setGraphSnapshots,
  activeGraphId,
  setActiveGraphId,
  navigationContext,
  onReturnToContext,
  readOnly = false,
}: GraphViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [editMode, setEditMode] = useState<GraphEditMode>('map');
  const [relationChoice, setRelationChoice] = useState<RelationChoice>('AUTO');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [propagateLinkedMovement, setPropagateLinkedMovement] = useState(true);

  const sortedMaps = useMemo(() => [...graphMaps].sort((a, b) => a.order - b.order), [graphMaps]);
  const activeMap = sortedMaps.find(map => map.id === activeGraphMapId) ?? sortedMaps[0] ?? null;
  const activeMapId = activeMap?.id ?? activeGraphMapId;
  const sortedSnapshots = useMemo(
    () => graphSnapshots
      .filter(snapshot => (snapshot.mapId ?? activeMapId) === activeMapId)
      .sort((a, b) => a.order - b.order),
    [graphSnapshots, activeMapId]
  );
  const activeGraph = sortedSnapshots.find(snapshot => snapshot.id === activeGraphId) ?? sortedSnapshots[0] ?? null;
  const activeSnapshotIndex = activeGraph ? sortedSnapshots.findIndex(snapshot => snapshot.id === activeGraph.id) : -1;
  const selectedEdge = activeGraph?.edges.find(edge => edge.id === selectedEdgeId) ?? null;

  useEffect(() => {
    if (!activeMap && sortedMaps.length > 0) {
      setActiveGraphMapId(sortedMaps[0].id);
    }
  }, [activeMap, sortedMaps, setActiveGraphMapId]);

  useEffect(() => {
    if (!activeGraph && sortedSnapshots.length > 0) {
      setActiveGraphId(sortedSnapshots[0].id);
    }
  }, [activeGraph, sortedSnapshots, setActiveGraphId]);

  useEffect(() => {
    if (!isPlaying) return;
    if (sortedSnapshots.length < 2) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setInterval(() => {
      const currentIndex = sortedSnapshots.findIndex(snapshot => snapshot.id === activeGraphId);
      const nextIndex = currentIndex < 0 ? 0 : currentIndex + 1;
      if (nextIndex >= sortedSnapshots.length) {
        setIsPlaying(false);
        return;
      }
      setActiveGraphId(sortedSnapshots[nextIndex].id);
    }, 900);

    return () => window.clearInterval(timer);
  }, [isPlaying, sortedSnapshots, activeGraphId, setActiveGraphId]);

  const createMap = () => {
    const newMap: GraphMap = {
      id: `map-${uid()}`,
      label: `Mappa ${graphMaps.length + 1}`,
      order: graphMaps.length,
      createdAt: Date.now(),
    };
    setGraphMaps(prev => [...prev, newMap]);
    setActiveGraphMapId(newMap.id);
    setActiveGraphId(null);
  };

  const deleteMap = (id: string) => {
    if (graphMaps.length <= 1) return;
    const fallback = sortedMaps.find(map => map.id !== id);
    setGraphMaps(prev => prev.filter(map => map.id !== id));
    setGraphSnapshots(prev => prev.filter(snapshot => snapshot.mapId !== id));
    setActiveGraphMapId(fallback?.id ?? sortedMaps[0].id);
    setActiveGraphId(null);
  };

  const renameMap = (id: string, label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    setGraphMaps(prev => prev.map(map => map.id === id ? { ...map, label: nextLabel } : map));
  };

  const createSnapshot = (copyFrom?: GraphSnapshot) => {
    const newSnap: GraphSnapshot = {
      id: uid(),
      mapId: activeMapId,
      label: copyFrom ? `${copyFrom.label} (copia)` : `Snapshot ${sortedSnapshots.length + 1}`,
      timestamp: Date.now(),
      order: sortedSnapshots.length,
      nodes: copyFrom ? copyFrom.nodes.map(node => ({ ...node, position: { ...node.position } })) : [],
      edges: copyFrom ? copyFrom.edges.map(edge => ({ ...edge, id: `edge-${uid()}` })) : [],
    };
    setGraphSnapshots(prev => [...prev, newSnap]);
    setActiveGraphId(newSnap.id);
  };

  const deleteSnapshot = (id: string) => {
    const remaining = sortedSnapshots.filter(snapshot => snapshot.id !== id);
    setGraphSnapshots(prev => prev.filter(snapshot => snapshot.id !== id));
    if (activeGraphId === id) {
      setActiveGraphId(remaining[0]?.id ?? null);
    }
  };

  const renameSnapshot = (id: string, label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel) return;
    setGraphSnapshots(prev => prev.map(snapshot => snapshot.id === id ? { ...snapshot, label: nextLabel } : snapshot));
  };

  const moveSnapshot = (id: string, direction: 'up' | 'down') => {
    setGraphSnapshots(prev => {
      const target = prev.find(snapshot => snapshot.id === id);
      if (!target) return prev;
      const scoped = prev.filter(snapshot => (snapshot.mapId ?? activeMapId) === (target.mapId ?? activeMapId)).sort((a, b) => a.order - b.order);
      const index = scoped.findIndex(snapshot => snapshot.id === id);
      const swapIndex = direction === 'up' ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= scoped.length) return prev;
      const swap = scoped[swapIndex];
      return prev.map(snapshot => {
        if (snapshot.id === target.id) return { ...snapshot, order: swap.order };
        if (snapshot.id === swap.id) return { ...snapshot, order: target.order };
        return snapshot;
      });
    });
  };

  const goToSnapshot = (direction: -1 | 1) => {
    const next = sortedSnapshots[activeSnapshotIndex + direction];
    if (next) {
      setIsPlaying(false);
      setActiveGraphId(next.id);
    }
  };

  const onPersistNodes = useCallback((nodes: GraphNodeData[]) => {
    setGraphSnapshots(prev => prev.map(snapshot => snapshot.id === activeGraph?.id ? { ...snapshot, nodes } : snapshot));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onPersistNodeRemove = useCallback((nodeIds: string[]) => {
    setGraphSnapshots(prev => prev.map(snapshot => {
      if (snapshot.id !== activeGraph?.id) return snapshot;
      return {
        ...snapshot,
        nodes: snapshot.nodes.filter(node => !nodeIds.includes(node.entityId)),
        edges: snapshot.edges.filter(edge => !nodeIds.includes(edge.sourceId) && !nodeIds.includes(edge.targetId)),
      };
    }));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onPersistEdgeRemove = useCallback((edgeIds: string[]) => {
    setGraphSnapshots(prev => prev.map(snapshot =>
      snapshot.id === activeGraph?.id ? { ...snapshot, edges: snapshot.edges.filter(edge => !edgeIds.includes(edge.id)) } : snapshot
    ));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onPersistEdgeAdd = useCallback((edge: GraphEdgeData) => {
    setGraphSnapshots(prev => prev.map(snapshot =>
      snapshot.id === activeGraph?.id ? { ...snapshot, edges: [...snapshot.edges, edge] } : snapshot
    ));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onPersistEdgeType = useCallback((edgeId: string, type: string) => {
    setGraphSnapshots(prev => prev.map(snapshot =>
      snapshot.id === activeGraph?.id
        ? { ...snapshot, edges: snapshot.edges.map(edge => edge.id === edgeId ? { ...edge, type } : edge) }
        : snapshot
    ));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onToggleNodePlace = useCallback((entityId: string) => {
    setGraphSnapshots(prev => prev.map(snapshot =>
      snapshot.id === activeGraph?.id
        ? {
            ...snapshot,
            nodes: snapshot.nodes.map(node =>
              node.entityId === entityId
                ? { ...node, mapRole: node.mapRole === 'place' ? 'entity' : 'place' }
                : node
            ),
          }
        : snapshot
    ));
  }, [activeGraph?.id, setGraphSnapshots]);

  const onDropEntity = useCallback((entityId: string, position: { x: number; y: number }) => {
    const entity = entities.find(item => item.id === entityId);
    const category = entity ? categories.find(item => item.id === entity.categoryId) : null;
    const isPlace = category?.name.toLowerCase().includes('luogh') ?? false;
    setGraphSnapshots(prev => prev.map(snapshot =>
      snapshot.id === activeGraph?.id
        ? { ...snapshot, nodes: [...snapshot.nodes, { entityId, position, mapRole: isPlace ? 'place' : 'entity' }] }
        : snapshot
    ));
  }, [activeGraph?.id, entities, categories, setGraphSnapshots]);

  const entitiesOnCanvas = new Set(activeGraph?.nodes.map(node => node.entityId) || []);
  const availableEntities = entities.filter(entity => !entitiesOnCanvas.has(entity.id));
  const nodesOnCanvas = (activeGraph?.nodes ?? [])
    .map(node => ({
      ...node,
      entity: entities.find(entity => entity.id === node.entityId),
    }))
    .filter(item => item.entity);

  return (
    <div className="graph-layout">
      <div
        className="graph-sidebar"
        style={{
          width: sidebarOpen ? '300px' : '48px',
          minWidth: sidebarOpen ? '300px' : '48px',
          transition: 'all 0.2s ease',
          borderRight: '1px solid var(--border)',
        }}
      >
        {sidebarOpen ? (
          <>
            <div className="graph-sidebar-header" style={{ justifyContent: 'space-between' }}>
              <span className="graph-sidebar-title">Mappe e grafo</span>
              <button className="icon-btn" onClick={() => setSidebarOpen(false)} title="Nascondi pannello grafo">
                <ChevronLeft size={16} />
              </button>
            </div>

            <div className="graph-section">
              <div className="graph-section-header">
                <span>Mappe</span>
                {!readOnly && (
                  <button className="graph-add-btn" onClick={createMap} title="Nuova mappa">
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div className="graph-snap-list compact-list">
                {sortedMaps.map(map => (
                  <div
                    key={map.id}
                    className={`graph-snap-item graph-map-item ${map.id === activeMapId ? 'active' : ''}`}
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveGraphMapId(map.id);
                      setActiveGraphId(null);
                    }}
                  >
                    {!readOnly && editingId === map.id ? (
                      <div className="graph-snap-edit-row">
                        <input
                          className="graph-snap-edit-input"
                          value={editingLabel}
                          onChange={event => setEditingLabel(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') { renameMap(map.id, editingLabel); setEditingId(null); }
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          onClick={event => event.stopPropagation()}
                        />
                        <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); renameMap(map.id, editingLabel); setEditingId(null); }}>
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <MapIcon size={13} color="var(--text-muted)" />
                        <span className="graph-snap-label">{map.label}</span>
                        {!readOnly && <div className="graph-snap-actions">
                          <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); setEditingId(map.id); setEditingLabel(map.label); }} title="Rinomina">
                            <Edit3 size={12} />
                          </button>
                          <button className="graph-snap-icon-btn danger" onClick={event => { event.stopPropagation(); deleteMap(map.id); }} title="Elimina">
                            <Trash2 size={12} />
                          </button>
                        </div>}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="graph-section">
              <div className="graph-section-header">
                <span>Snapshot</span>
                <div style={{ position: 'relative' }}>
                  {!readOnly && (
                    <button className="graph-add-btn" onClick={() => setShowNewMenu(!showNewMenu)} title="Nuovo snapshot">
                      <Plus size={14} />
                    </button>
                  )}
                  {!readOnly && showNewMenu && (
                    <div className="graph-new-menu">
                      <button className="graph-new-menu-item" onClick={() => { createSnapshot(); setShowNewMenu(false); }}>
                        <Plus size={12} /> Vuoto
                      </button>
                      {activeGraph && (
                        <button className="graph-new-menu-item" onClick={() => { createSnapshot(activeGraph); setShowNewMenu(false); }}>
                          <Copy size={12} /> Copia attuale
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="graph-snap-list">
                {sortedSnapshots.map(snapshot => (
                  <div
                    key={snapshot.id}
                    className={`graph-snap-item ${snapshot.id === activeGraph?.id ? 'active' : ''}`}
                    onClick={() => {
                      setIsPlaying(false);
                      setActiveGraphId(snapshot.id);
                    }}
                  >
                    {!readOnly && editingId === snapshot.id ? (
                      <div className="graph-snap-edit-row">
                        <input
                          className="graph-snap-edit-input"
                          value={editingLabel}
                          onChange={event => setEditingLabel(event.target.value)}
                          onKeyDown={event => {
                            if (event.key === 'Enter') { renameSnapshot(snapshot.id, editingLabel); setEditingId(null); }
                            if (event.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          onClick={event => event.stopPropagation()}
                        />
                        <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); renameSnapshot(snapshot.id, editingLabel); setEditingId(null); }}>
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="graph-snap-label">{snapshot.label}</span>
                        {!readOnly && <div className="graph-snap-actions">
                          <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); moveSnapshot(snapshot.id, 'up'); }} title="Sposta su">^</button>
                          <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); moveSnapshot(snapshot.id, 'down'); }} title="Sposta giu">v</button>
                          <button className="graph-snap-icon-btn" onClick={event => { event.stopPropagation(); setEditingId(snapshot.id); setEditingLabel(snapshot.label); }} title="Rinomina">
                            <Edit3 size={12} />
                          </button>
                          <button className="graph-snap-icon-btn danger" onClick={event => { event.stopPropagation(); deleteSnapshot(snapshot.id); }} title="Elimina">
                            <Trash2 size={12} />
                          </button>
                        </div>}
                      </>
                    )}
                  </div>
                ))}
                {sortedSnapshots.length === 0 && (
                  <div className="graph-empty-hint">Nessuno snapshot su questa mappa.</div>
                )}
              </div>
            </div>

            <div className="graph-section">
              {!readOnly && <div className="graph-mode-switch">
                <button
                  className={`graph-mode-btn ${editMode === 'map' ? 'active' : ''}`}
                  onClick={() => {
                    setEditMode('map');
                    setSelectedEdgeId(null);
                  }}
                >
                  Mappa
                </button>
                <button
                  className={`graph-mode-btn ${editMode === 'links' ? 'active' : ''}`}
                  onClick={() => setEditMode('links')}
                >
                  Collegamenti
                </button>
              </div>}

              {!readOnly && editMode === 'links' && (
                <div className="graph-relation-tools">
                  <label className="graph-field-label">
                    Tipo nuova freccia
                    <select
                      className="graph-field-select"
                      value={relationChoice}
                      onChange={event => setRelationChoice(event.target.value as RelationChoice)}
                    >
                      {RELATION_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  {selectedEdge && (
                    <label className="graph-field-label">
                      Freccia selezionata
                      <select
                        className="graph-field-select"
                        value={selectedEdge.type}
                        onChange={event => onPersistEdgeType(selectedEdge.id, event.target.value)}
                      >
                        {RELATION_OPTIONS.filter(option => option.value !== 'AUTO').map(option => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="graph-section">
              <div className="graph-timeline-controls">
                <button className="editor-tool-btn" onClick={() => goToSnapshot(-1)} disabled={activeSnapshotIndex <= 0} title="Snapshot precedente">
                  <Rewind size={14} />
                </button>
                <button
                  className={`editor-tool-btn primary ${isPlaying ? 'active' : ''}`}
                  onClick={() => setIsPlaying(value => !value)}
                  disabled={sortedSnapshots.length < 2}
                  title={isPlaying ? 'Pausa' : 'Play'}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="editor-tool-btn" onClick={() => goToSnapshot(1)} disabled={activeSnapshotIndex >= sortedSnapshots.length - 1} title="Snapshot successivo">
                  <FastForward size={14} />
                </button>
                <span className="graph-timeline-label">
                  {activeSnapshotIndex >= 0 ? `${activeSnapshotIndex + 1}/${sortedSnapshots.length}` : '0/0'}
                </span>
              </div>
              {!readOnly && <label className="graph-toggle-row">
                <input
                  type="checkbox"
                  checked={propagateLinkedMovement}
                  onChange={event => setPropagateLinkedMovement(event.target.checked)}
                />
                Propaga movimento sui collegamenti
              </label>}
            </div>

            {!readOnly && activeGraph && (
              <div className="graph-section" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="graph-section-header">
                  <span>{editMode === 'map' ? 'Sulla mappa' : 'Entita'}</span>
                </div>
                <div className="graph-entity-palette" style={{ maxHeight: 'none' }}>
                  {editMode === 'map' && nodesOnCanvas.length > 0 && (
                    <div className="graph-map-node-list">
                      {nodesOnCanvas.map(node => (
                        <div key={node.entityId} className="graph-map-node-row">
                          <span className="graph-map-node-name">{node.entity?.avatar} {node.entity?.name}</span>
                          <button
                            className={`graph-place-toggle ${node.mapRole === 'place' ? 'active' : ''}`}
                            onClick={() => onToggleNodePlace(node.entityId)}
                            title="Marca come luogo sulla mappa"
                          >
                            {node.mapRole === 'place' ? 'Luogo' : 'Entita'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {categories.map(category => {
                    const catEntities = availableEntities.filter(entity => entity.categoryId === category.id);
                    if (catEntities.length === 0) return null;
                    return (
                      <div key={category.id}>
                        <div className="graph-palette-cat">{category.name}</div>
                        {catEntities.map(entity => (
                          <div
                            key={entity.id}
                            className="graph-palette-entity"
                            draggable
                            onDragStart={event => {
                              event.dataTransfer.setData('application/entity-id', entity.id);
                              event.dataTransfer.effectAllowed = 'move';
                            }}
                          >
                            <GripVertical size={12} className="graph-palette-grip" />
                            {entity.image ? (
                              <span className="graph-palette-img" style={{ backgroundImage: `url(${entity.image})` }} />
                            ) : (
                              <span className="graph-palette-avatar">{entity.avatar}</span>
                            )}
                            <span className="graph-palette-name">{entity.name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {availableEntities.length === 0 && (
                    <div className="graph-empty-hint">Tutte le entita sono sul canvas.</div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', height: '100%' }}>
            <button className="icon-btn" onClick={() => setSidebarOpen(true)} title="Mostra pannello grafo">
              <ChevronRight size={16} />
            </button>
            <div className="graph-sidebar-rail">Mappe</div>
          </div>
        )}
      </div>

      <div className="graph-canvas-wrap">
        {navigationContext && onReturnToContext && (
          <div className="graph-return-banner">
            <button className="btn-secondary" style={{ width: 'auto', padding: '6px 10px' }} onClick={onReturnToContext}>
              <CornerUpLeft size={13} style={{ marginRight: 6 }} /> Torna al link
            </button>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{navigationContext.snapshotLabel}</div>
              <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Aperto da un collegamento nel testo</div>
            </div>
          </div>
        )}

        {activeGraph ? (
          <GraphCanvas
            activeGraph={activeGraph}
            entities={entities}
            categories={categories}
            editMode={editMode}
            isPlaying={isPlaying}
            propagateLinkedMovement={propagateLinkedMovement}
            relationChoice={relationChoice}
            selectedEdgeId={selectedEdgeId}
            onSelectEdge={setSelectedEdgeId}
            onPersistNodes={onPersistNodes}
            onPersistNodeRemove={onPersistNodeRemove}
            onPersistEdgeRemove={onPersistEdgeRemove}
            onPersistEdgeAdd={onPersistEdgeAdd}
            onDropEntity={onDropEntity}
            readOnly={readOnly}
          />
        ) : (
          <div className="graph-empty-canvas">
            <div className="graph-empty-canvas-icon">M</div>
            <div className="graph-empty-canvas-title">Nessuno snapshot selezionato</div>
            <div className="graph-empty-canvas-hint">Crea uno snapshot per posizionare entita e costruire la timeline.</div>
            {!readOnly && (
              <button className="btn-primary" style={{ width: 'auto', marginTop: 16 }} onClick={() => createSnapshot()}>
                + Crea snapshot
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
