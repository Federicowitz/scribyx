import React, { useState } from 'react';
import { Trash2, Hash } from 'lucide-react';
import type { Entity, CustomField } from '../types';
import { uid } from '../editorUtils';

export function EntityModal({ entity, onSave, onClose, onDelete }: { entity: Entity, onSave: (e: Entity) => void, onClose: () => void, onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState<Entity>({ ...entity });

  const addField = () => setDraft(d => ({ ...d, fields: [...d.fields, { id: uid(), title: '', value: '' }] }));
  const updateField = (id: string, key: 'title'|'value', val: string) => 
    setDraft(d => ({ ...d, fields: d.fields.map(f => f.id === id ? { ...f, [key]: val } : f) }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="char-avatar-lg">{draft.avatar || '?'}</div>
          <input className="modal-title-input" value={draft.name} onChange={e => setDraft({...draft, name: e.target.value})} placeholder="Nome Entità..." autoFocus />
          <input style={{width:'40px', textAlign:'center', border:'1px solid var(--border)', borderRadius:'4px'}} value={draft.avatar} onChange={e => setDraft({...draft, avatar: e.target.value.substring(0,2)})} placeholder="Az" />
        </div>
        <div className="modal-scroll">
          <label className="field-label">Descrizione Generale</label>
          <textarea className="modal-textarea" rows={4} value={draft.desc} onChange={e => setDraft({...draft, desc: e.target.value})} placeholder="Descrivi qui i dettagli..." />
          
          <label className="field-label" style={{marginTop: 10}}>Campi Personalizzati</label>
          {draft.fields.map((f: CustomField) => (
            <div key={f.id} className="custom-field">
              <div className="custom-field-header">
                <Hash size={14} color="var(--text-muted)" />
                <input className="custom-field-title" value={f.title} onChange={e => updateField(f.id, 'title', e.target.value)} placeholder="Nome campo..." />
                <button className="icon-btn small" onClick={() => setDraft(d => ({...d, fields: d.fields.filter(x => x.id !== f.id)}))}><Trash2 size={12} /></button>
              </div>
              <textarea className="modal-textarea" rows={2} value={f.value} onChange={e => updateField(f.id, 'value', e.target.value)} placeholder="Valore..." />
            </div>
          ))}
          <button className="btn-ghost full" onClick={addField}>+ Aggiungi Campo Personalizzato</button>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="btn-danger" onClick={() => onDelete(draft.id)}>Elimina</button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={onClose}>Annulla</button>
            <button className="btn-primary" onClick={() => onSave(draft)}>Salva</button>
          </div>
        </div>
      </div>
    </div>
  );
}