import React, { useRef, useState } from 'react';
import { Hash, ImagePlus, Trash2 } from 'lucide-react';
import type { CustomField, Entity } from '../types';
import { uid } from '../editorUtils';

export function EntityModal({
  entity,
  onSave,
  onClose,
  onDelete,
  readOnly = false,
}: {
  entity: Entity;
  onSave: (e: Entity) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<Entity>({ ...entity });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addField = () => {
    if (readOnly) return;
    setDraft(current => ({ ...current, fields: [...current.fields, { id: uid(), title: '', value: '' }] }));
  };

  const updateField = (id: string, key: 'title' | 'value', value: string) => {
    if (readOnly) return;
    setDraft(current => ({
      ...current,
      fields: current.fields.map(field => field.id === id ? { ...field, [key]: value } : field),
    }));
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setDraft(current => ({ ...current, image: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    if (readOnly) return;
    setDraft(current => ({ ...current, image: undefined }));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          {draft.image ? (
            <div className="char-avatar-lg entity-img-preview" style={{ backgroundImage: `url(${draft.image})` }} />
          ) : (
            <div className="char-avatar-lg">{draft.avatar || '?'}</div>
          )}
          <input
            className="modal-title-input"
            value={draft.name}
            onChange={event => !readOnly && setDraft({ ...draft, name: event.target.value })}
            placeholder="Nome entita..."
            autoFocus={!readOnly}
            readOnly={readOnly}
          />
          <input
            style={{ width: '40px', textAlign: 'center', border: '1px solid var(--border)', borderRadius: '4px' }}
            value={draft.avatar}
            onChange={event => !readOnly && setDraft({ ...draft, avatar: event.target.value.substring(0, 2) })}
            placeholder="Az"
            readOnly={readOnly}
          />
        </div>

        <div className="modal-scroll">
          <label className="field-label">Immagine</label>
          <div className="entity-image-section">
            {draft.image ? (
              <div className="entity-image-thumb-wrap">
                <img src={draft.image} alt={draft.name} className="entity-image-thumb" />
                {!readOnly && (
                  <button className="entity-image-remove" onClick={removeImage}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ) : (
              !readOnly && (
                <button className="btn-ghost full" onClick={() => fileInputRef.current?.click()}>
                  <ImagePlus size={14} style={{ marginRight: 6 }} /> Carica immagine
                </button>
              )
            )}
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={readOnly} />
          </div>

          <label className="field-label">Descrizione generale</label>
          <textarea
            className="modal-textarea"
            rows={4}
            value={draft.desc}
            onChange={event => !readOnly && setDraft({ ...draft, desc: event.target.value })}
            placeholder="Descrivi qui i dettagli..."
            readOnly={readOnly}
          />

          <label className="field-label" style={{ marginTop: 10 }}>Campi personalizzati</label>
          {draft.fields.map((field: CustomField) => (
            <div key={field.id} className="custom-field">
              <div className="custom-field-header">
                <Hash size={14} color="var(--text-muted)" />
                <input
                  className="custom-field-title"
                  value={field.title}
                  onChange={event => updateField(field.id, 'title', event.target.value)}
                  placeholder="Nome campo..."
                  readOnly={readOnly}
                />
                {!readOnly && (
                  <button className="icon-btn small" onClick={() => setDraft(current => ({ ...current, fields: current.fields.filter(item => item.id !== field.id) }))}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <textarea
                className="modal-textarea"
                rows={2}
                value={field.value}
                onChange={event => updateField(field.id, 'value', event.target.value)}
                placeholder="Valore..."
                readOnly={readOnly}
              />
            </div>
          ))}
          {!readOnly && <button className="btn-ghost full" onClick={addField}>+ Aggiungi campo personalizzato</button>}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {!readOnly && <button className="btn-danger" onClick={() => onDelete(draft.id)}>Elimina</button>}
          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button className="btn-secondary" onClick={onClose}>{readOnly ? 'Chiudi' : 'Annulla'}</button>
            {!readOnly && <button className="btn-primary" onClick={() => onSave(draft)}>Salva</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
