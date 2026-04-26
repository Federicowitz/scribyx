import React, { useMemo, useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge
} from '@xyflow/react';
import type {
  NodeChange,
  EdgeChange,
  Node,
  Edge,
  Connection
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ChevronLeft, ChevronRight, Plus, Trash2, GripVertical, Edit3, Check, Copy } from 'lucide-react';
import type { Entity, Category, GraphSnapshot, GraphNodeData, GraphEdgeData } from '../types';

/* ─── Helpers ───────────────────────────────────────────── */
const uid = () => Math.random().toString(36).substring(2, 10);

function inferRelationType(sourceCat: string, targetCat: string): string {
  const s = sourceCat.toLowerCase();
  const t = targetCat.toLowerCase();
  if ((s.includes('gruppo') || s.includes('gruppi')) && t.includes('oggett')) return 'APPARTIENE_A';
  if (s.includes('oggett') && t.includes('oggett')) return 'CONTENUTO_IN';
  return 'STA_IN';
}

const getCategoryColor = (catName: string = '') => {
  const name = catName.toLowerCase();
  if (name.includes('personagg')) return '#ef4444'; 
  if (name.includes('luogh')) return '#22c55e'; 
  if (name.includes('oggett')) return '#f59e0b'; 
  if (name.includes('grupp')) return '#6366f1'; 
  
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hues =[0, 45, 160, 210, 270, 320];
  return `hsl(${hues[hash % hues.length]}, 70%, 55%)`;
};

/* ─── Custom Node ───────────────────────────────────────── */
function EntityNode({ data }: any) {
  const { entity, category, isInvalid, warnings } = data;
  const color = getCategoryColor(category?.name);

  return (
    <div 
      className="graph-entity-node" 
      data-invalid={isInvalid || undefined}
      style={{ 
        borderTop: `4px solid ${color}`,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      <Handle type="target" position={Position.Top} className="graph-handle" />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {entity.image ? (
          <div 
            className="graph-node-img" 
            style={{ 
              backgroundImage: `url(${entity.image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              flexShrink: 0
            }} 
          />
        ) : (
          <div 
            className="graph-node-avatar"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: `${color}15`,
              color: color,
              border: `1px solid ${color}40`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '12px',
              flexShrink: 0
            }}
          >
            {entity.avatar}
          </div>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start' }}>
          <div className="graph-node-name" style={{ margin: 0, padding: 0, fontSize: '13px', fontWeight: 600 }}>
            {entity.name}
          </div>
          <div className="graph-node-cat" style={{ margin: 0, padding: 0, color: color, background: 'transparent', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {category?.name}
          </div>
        </div>
      </div>

      {isInvalid && (
        <div className="graph-node-warning" style={{ marginTop: '4px' }}>
          {warnings.map((w: string, i: number) => <div key={i}>{w}</div>)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="graph-handle" />
    </div>
  );
}

const nodeTypes = { entityNode: EntityNode };


/* ─── Props ─────────────────────────────────────────────── */
interface GraphViewProps {
  entities: Entity[];
  categories: Category[];
  graphSnapshots: GraphSnapshot[];
  setGraphSnapshots: React.Dispatch<React.SetStateAction<GraphSnapshot[]>>;
  activeGraphId: string | null;
  setActiveGraphId: React.Dispatch<React.SetStateAction<string | null>>;
}

/* ─── Inner Canvas (owns React Flow state) ──────────────── */
function GraphCanvas({
  activeGraph, entities, categories,
  onPersistNodes, onPersistNodeRemove, onPersistEdgeRemove, onPersistEdgeAdd, onDropEntity
}: {
  activeGraph: GraphSnapshot;
  entities: Entity[];
  categories: Category[];
  onPersistNodes: (nodes: GraphNodeData[]) => void;
  onPersistNodeRemove: (nodeIds: string[]) => void;
  onPersistEdgeRemove: (edgeIds: string[]) => void;
  onPersistEdgeAdd: (edge: GraphEdgeData) => void;
  onDropEntity: (entityId: string, position: { x: number; y: number }) => void;
}) {
  const validate = useCallback((graphNodes: GraphNodeData[], graphEdges: GraphEdgeData[]) => {
    const invalidNodeIds = new Set<string>();
    const nodeWarnings: Record<string, string[]> = {};
    graphNodes.forEach(gn => {
      const ent = entities.find(e => e.id === gn.entityId);
      if (!ent) return;
      const cat = categories.find(c => c.id === ent.categoryId);
      if (!cat) return;
      const name = cat.name.toLowerCase();
      const outgoing = graphEdges.filter(e => e.sourceId === gn.entityId);
      if (name.includes('oggett')) {
        if (outgoing.filter(e => e.type === 'STA_IN').length > 1) {
          invalidNodeIds.add(gn.entityId);
          nodeWarnings[gn.entityId] = [...(nodeWarnings[gn.entityId] ||[]), 'Più di un luogo (STA_IN)'];
        }
      }
      if (name.includes('grupp')) {
        if (outgoing.filter(e => e.type === 'APPARTIENE_A').length > 1) {
          invalidNodeIds.add(gn.entityId);
          nodeWarnings[gn.entityId] =[...(nodeWarnings[gn.entityId] ||[]), 'Appartiene a più entità'];
        }
      }
    });
    return { invalidNodeIds, nodeWarnings };
  }, [entities, categories]);

  const { invalidNodeIds, nodeWarnings } = validate(activeGraph.nodes, activeGraph.edges);

  const initialNodes: Node[] = activeGraph.nodes.map(gn => {
    const ent = entities.find(e => e.id === gn.entityId);
    const cat = ent ? categories.find(c => c.id === ent.categoryId) : null;
    return {
      id: gn.entityId,
      type: 'entityNode',
      position: gn.position,
      data: {
        entity: ent || { avatar: '?', name: '???', image: undefined },
        category: cat,
        isInvalid: invalidNodeIds.has(gn.entityId),
        warnings: nodeWarnings[gn.entityId] ||[],
      }
    };
  });

  const initialEdges: Edge[] = activeGraph.edges.map(ge => ({
    id: ge.id,
    source: ge.sourceId,
    target: ge.targetId,
    label: ge.type,
    type: 'default',
    style: { stroke: 'var(--accent)', strokeWidth: 2 },
    labelStyle: { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 },
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
  }));

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const lastSnapId = useRef(activeGraph.id);
  const lastSnapTimestamp = useRef(activeGraph.timestamp);
  if (activeGraph.id !== lastSnapId.current || activeGraph.nodes.length !== nodes.length) {
    lastSnapId.current = activeGraph.id;
    lastSnapTimestamp.current = activeGraph.timestamp;
    setNodes(initialNodes);
    setEdges(initialEdges);
  }

  const onNodeDragStop = useCallback((_event: any, _node: any, draggedNodes: Node[]) => {
    const updated: GraphNodeData[] = activeGraph.nodes.map(n => {
      const moved = draggedNodes.find(d => d.id === n.entityId);
      return moved ? { ...n, position: moved.position } : n;
    });
    onPersistNodes(updated);
  }, [activeGraph.nodes, onPersistNodes]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    const removals = changes.filter(c => c.type === 'remove').map((c: any) => c.id);
    if (removals.length > 0) onPersistNodeRemove(removals);
  }, [onNodesChange, onPersistNodeRemove]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    const removals = changes.filter(c => c.type === 'remove').map((c: any) => c.id);
    if (removals.length > 0) onPersistEdgeRemove(removals);
  },[onEdgesChange, onPersistEdgeRemove]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    const sourceEnt = entities.find(e => e.id === params.source);
    const targetEnt = entities.find(e => e.id === params.target);
    if (!sourceEnt || !targetEnt) return;
    const sourceCat = categories.find(c => c.id === sourceEnt.categoryId)?.name || '';
    const targetCat = categories.find(c => c.id === targetEnt.categoryId)?.name || '';
    const relType = inferRelationType(sourceCat, targetCat);
    const newEdge: GraphEdgeData = {
      id: `edge-${uid()}`,
      sourceId: sourceEnt.id,
      targetId: targetEnt.id,
      type: relType,
    };
    const flowEdge: Edge = {
      id: newEdge.id,
      source: newEdge.sourceId,
      target: newEdge.targetId,
      label: newEdge.type,
      type: 'default',
      style: { stroke: 'var(--accent)', strokeWidth: 2 },
      labelStyle: { fontSize: 10, fill: 'var(--text-muted)', fontWeight: 500 },
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
    };
    setEdges(eds => addEdge(flowEdge, eds));
    onPersistEdgeAdd(newEdge);
  },[entities, categories, setEdges, onPersistEdgeAdd]);

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  },[]);

  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const entityId = event.dataTransfer.getData('application/entity-id');
    if (!entityId || !reactFlowInstance) return;
    if (activeGraph.nodes.some(n => n.entityId === entityId)) return;
    const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const ent = entities.find(e => e.id === entityId);
    const cat = ent ? categories.find(c => c.id === ent.categoryId) : null;
    setNodes(nds =>[...nds, {
      id: entityId,
      type: 'entityNode',
      position,
      data: {
        entity: ent || { avatar: '?', name: '???', image: undefined },
        category: cat,
        isInvalid: false,
        warnings: [],
      }
    }]);
    onDropEntity(entityId, position);
  },[reactFlowInstance, activeGraph.nodes, entities, categories, setNodes, onDropEntity]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onNodeDragStop={onNodeDragStop}
      onInit={setReactFlowInstance}
      onDragOver={onDragOver}
      onDrop={onDrop}
      deleteKeyCode={['Backspace', 'Delete']}
      fitView
    >
      <Background color="var(--border)" gap={24} />
      <Controls />
    </ReactFlow>
  );
}

/* ─── Main GraphView Component ──────────────────────────── */
export function GraphView({
  entities, categories,
  graphSnapshots, setGraphSnapshots,
  activeGraphId, setActiveGraphId
}: GraphViewProps) {

  const activeGraph = graphSnapshots.find(g => g.id === activeGraphId) || null;
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const createSnapshot = (copyFrom?: GraphSnapshot) => {
    const newSnap: GraphSnapshot = {
      id: uid(),
      label: copyFrom ? `${copyFrom.label} (copia)` : `Snapshot ${graphSnapshots.length + 1}`,
      timestamp: Date.now(),
      order: graphSnapshots.length,
      nodes: copyFrom ? copyFrom.nodes.map(n => ({ ...n })) :[],
      edges: copyFrom ? copyFrom.edges.map(e => ({ ...e, id: `edge-${uid()}` })) : [],
    };
    setGraphSnapshots(prev => [...prev, newSnap]);
    setActiveGraphId(newSnap.id);
  };

  const deleteSnapshot = (id: string) => {
    setGraphSnapshots(prev => prev.filter(g => g.id !== id));
    if (activeGraphId === id) {
      const remaining = graphSnapshots.filter(g => g.id !== id);
      setActiveGraphId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const renameSnapshot = (id: string, newLabel: string) => {
    setGraphSnapshots(prev => prev.map(g => g.id === id ? { ...g, label: newLabel } : g));
  };

  const moveSnapshot = (id: string, direction: 'up' | 'down') => {
    setGraphSnapshots(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex(g => g.id === id);
      if (direction === 'up' && idx > 0) {
        [sorted[idx].order, sorted[idx - 1].order] = [sorted[idx - 1].order, sorted[idx].order];
      } else if (direction === 'down' && idx < sorted.length - 1) {
        [sorted[idx].order, sorted[idx + 1].order] = [sorted[idx + 1].order, sorted[idx].order];
      }
      return sorted;
    });
  };

  const onPersistNodes = useCallback((nodes: GraphNodeData[]) => {
    setGraphSnapshots(prev => prev.map(g => g.id === activeGraphId ? { ...g, nodes } : g));
  }, [activeGraphId, setGraphSnapshots]);

  const onPersistNodeRemove = useCallback((nodeIds: string[]) => {
    setGraphSnapshots(prev => prev.map(g => {
      if (g.id === activeGraphId) {
        return {
          ...g,
          nodes: g.nodes.filter(n => !nodeIds.includes(n.entityId)),
          edges: g.edges.filter(e => !nodeIds.includes(e.sourceId) && !nodeIds.includes(e.targetId))
        };
      }
      return g;
    }));
  }, [activeGraphId, setGraphSnapshots]);

  const onPersistEdgeRemove = useCallback((edgeIds: string[]) => {
    setGraphSnapshots(prev => prev.map(g =>
      g.id === activeGraphId ? { ...g, edges: g.edges.filter(e => !edgeIds.includes(e.id)) } : g
    ));
  }, [activeGraphId, setGraphSnapshots]);

  const onPersistEdgeAdd = useCallback((edge: GraphEdgeData) => {
    setGraphSnapshots(prev => prev.map(g =>
      g.id === activeGraphId ? { ...g, edges: [...g.edges, edge] } : g
    ));
  }, [activeGraphId, setGraphSnapshots]);

  const onDropEntity = useCallback((entityId: string, position: { x: number; y: number }) => {
    setGraphSnapshots(prev => prev.map(g =>
      g.id === activeGraphId ? { ...g, nodes: [...g.nodes, { entityId, position }] } : g
    ));
  },[activeGraphId, setGraphSnapshots]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const[showNewMenu, setShowNewMenu] = useState(false);

  const entitiesOnCanvas = new Set(activeGraph?.nodes.map(n => n.entityId) ||[]);
  const availableEntities = entities.filter(e => !entitiesOnCanvas.has(e.id));

  const sortedSnapshots = [...graphSnapshots].sort((a, b) => a.order - b.order);

  return (
    <div className="graph-layout" style={{ flex: 1, display: 'flex', width: '100%', overflow: 'hidden' }}>
      
      {/* ── Pannello a scomparsa ─────────────────────────── */}
      <div 
        className="graph-sidebar" 
        style={{ 
          width: sidebarOpen ? '280px' : '48px',
          minWidth: sidebarOpen ? '280px' : '48px',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          background: 'var(--panel-bg)',
          overflow: 'hidden'
        }}
      >
        {sidebarOpen ? (
          <>
            <div className="graph-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="graph-sidebar-title">Strumenti Grafo</span>
              <button className="icon-btn" onClick={() => setSidebarOpen(false)} title="Nascondi pannello grafo">
                <ChevronLeft size={16} />
              </button>
            </div>

            <div className="graph-section">
              <div className="graph-section-header">
                <span>Snapshot</span>
                <div style={{ position: 'relative' }}>
                  <button className="graph-add-btn" onClick={() => setShowNewMenu(!showNewMenu)} title="Nuovo snapshot">
                    <Plus size={14} />
                  </button>
                  {showNewMenu && (
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
                {sortedSnapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className={`graph-snap-item ${snap.id === activeGraphId ? 'active' : ''}`}
                    onClick={() => setActiveGraphId(snap.id)}
                  >
                    {editingId === snap.id ? (
                      <div className="graph-snap-edit-row">
                        <input
                          className="graph-snap-edit-input"
                          value={editingLabel}
                          onChange={e => setEditingLabel(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { renameSnapshot(snap.id, editingLabel); setEditingId(null); }
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          onClick={e => e.stopPropagation()}
                        />
                        <button className="graph-snap-icon-btn" onClick={(e) => { e.stopPropagation(); renameSnapshot(snap.id, editingLabel); setEditingId(null); }}>
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="graph-snap-label">{snap.label}</span>
                        <div className="graph-snap-actions">
                          <button className="graph-snap-icon-btn" onClick={(e) => { e.stopPropagation(); moveSnapshot(snap.id, 'up'); }} title="Sposta su">▲</button>
                          <button className="graph-snap-icon-btn" onClick={(e) => { e.stopPropagation(); moveSnapshot(snap.id, 'down'); }} title="Sposta giù">▼</button>
                          <button className="graph-snap-icon-btn" onClick={(e) => { e.stopPropagation(); setEditingId(snap.id); setEditingLabel(snap.label); }} title="Rinomina">
                            <Edit3 size={12} />
                          </button>
                          <button className="graph-snap-icon-btn danger" onClick={(e) => { e.stopPropagation(); deleteSnapshot(snap.id); }} title="Elimina">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {sortedSnapshots.length === 0 && (
                  <div className="graph-empty-hint">Nessun snapshot. Creane uno per iniziare.</div>
                )}
              </div>
            </div>

            {activeGraph && (
              <div className="graph-section" style={{ flex: 1, overflow: 'hidden' }}>
                <div className="graph-section-header">
                  <span>Entità</span>
                </div>
                <div className="graph-entity-palette" style={{ maxHeight: 'none', flex: 1 }}>
                  {categories.map(cat => {
                    const catEntities = availableEntities.filter(e => e.categoryId === cat.id);
                    if (catEntities.length === 0) return null;
                    return (
                      <div key={cat.id}>
                        <div className="graph-palette-cat">{cat.name}</div>
                        {catEntities.map(ent => (
                          <div
                            key={ent.id}
                            className="graph-palette-entity"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/entity-id', ent.id);
                              e.dataTransfer.effectAllowed = 'move';
                            }}
                          >
                            <GripVertical size={12} className="graph-palette-grip" />
                            {ent.image ? (
                              <span 
                                className="graph-palette-img" 
                                style={{ 
                                  backgroundImage: `url(${ent.image})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  display: 'inline-block',
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%'
                                }} 
                              />
                            ) : (
                              <span className="graph-palette-avatar">{ent.avatar}</span>
                            )}
                            <span className="graph-palette-name">{ent.name}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                  {availableEntities.length === 0 && (
                    <div className="graph-empty-hint">Tutte le entità sono sul canvas.</div>
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
            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '24px' }}>
              Strumenti Grafo
            </div>
          </div>
        )}
      </div>

      {/* ── Canvas ──────────────────────────────────────── */}
      <div className="graph-canvas-wrap" style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        {activeGraph ? (
          <GraphCanvas
            key={activeGraph.id}
            activeGraph={activeGraph}
            entities={entities}
            categories={categories}
            onPersistNodes={onPersistNodes}
            onPersistNodeRemove={onPersistNodeRemove}
            onPersistEdgeRemove={onPersistEdgeRemove}
            onPersistEdgeAdd={onPersistEdgeAdd}
            onDropEntity={onDropEntity}
          />
        ) : (
          <div className="graph-empty-canvas">
            <div className="graph-empty-canvas-icon">🗺️</div>
            <div className="graph-empty-canvas-title">Nessun snapshot selezionato</div>
            <div className="graph-empty-canvas-hint">Crea o seleziona uno snapshot dal pannello laterale</div>
            <button className="btn-primary" style={{ width: 'auto', marginTop: 16 }} onClick={() => createSnapshot()}>
              + Crea primo snapshot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
