import { Plus, X } from 'lucide-react';
import { useText } from '../../content';
import type { Subtask } from '../../models/task';

export function Checklist({ items, change }: { items: Subtask[]; change: (items: Subtask[]) => void }) {
  const t = useText();
  function update(id: string, patch: Partial<Subtask>) {
    change(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }
  return (
    <fieldset className="checklist">
      <legend>{t('task.subtasks')}</legend>
      {items.map((item) => (
        <div className="checklist-row" key={item.id}>
          <input
            type="checkbox"
            checked={item.completed}
            aria-label={t('task.complete', { title: item.title })}
            onChange={(event) => update(item.id, { completed: event.target.checked })}
          />
          <input
            aria-label={t('task.subtaskTitle')}
            value={item.title}
            maxLength={240}
            required
            onChange={(event) => update(item.id, { title: event.target.value })}
          />
          <button
            type="button"
            className="icon-button"
            aria-label={t('task.subtaskRemove')}
            onClick={() => change(items.filter((value) => value.id !== item.id))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        disabled={items.length >= 100}
        onClick={() => change([...items, { id: crypto.randomUUID(), title: '', completed: false }])}
      >
        <Plus size={16} />
        {t('task.subtaskAdd')}
      </button>
    </fieldset>
  );
}
