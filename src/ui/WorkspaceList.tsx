import { Plus, Sparkles } from 'lucide-react';
import { useText, type ContentKey } from '../content';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
import type { Workspace } from '../hooks/useWorkspace';
import { isTask } from '../models/task';
import { EntryList } from './EntryList';
import { Filters } from './Filters';

export function WorkspaceList({ controller: c, data }: { controller: WorkspaceController; data: Workspace }) {
  const t = useText();
  const readOnly = c.query.view === 'trash' || c.query.view === 'archive';
  const showQuick = !readOnly && c.query.view !== 'notes' && !c.query.search;
  return (
    <>
      {showQuick && (
        <form
          className="quick-add"
          onSubmit={(event) => {
            event.preventDefault();
            c.addQuick();
          }}
        >
          <Plus size={20} aria-hidden="true" />
          <input
            aria-label={t('task.quick')}
            placeholder={t('task.quick')}
            value={c.quick}
            maxLength={240}
            required
            onChange={(event) => c.setQuick(event.target.value)}
          />
          <button disabled={c.busy || !c.quick.trim()}>
            {t('task.add')}
            <span aria-hidden="true">↵</span>
          </button>
        </form>
      )}
      <Filters query={c.query} change={c.changeQuery} tags={c.tags} projects={data.projects} />
      <div className="list-heading">
        <span>
          {t('common.items', {
            count: c.entries.length,
          })}
        </span>
        <span className="muted">{t('common.saved')}</span>
      </div>
      <BulkBar controller={c} readOnly={readOnly} />
      {c.entries.length ? (
        <EntryList
          entries={c.entries}
          projects={data.projects}
          locale={data.settings.locale}
          selected={c.selected}
          select={c.select}
          edit={(entry) => c.setEditor({ entry, existing: true })}
          act={c.act}
          readOnly={readOnly}
          move={c.move}
        />
      ) : (
        <Empty controller={c} />
      )}
    </>
  );
}

function BulkBar({ controller: c, readOnly }: { controller: WorkspaceController; readOnly: boolean }) {
  const t = useText();
  const values = c.entries.filter((entry) => c.selected.has(entry.id));
  if (!values.length) return null;
  const cannotComplete = readOnly || values.some((entry) => !isTask(entry));
  return (
    <div className="bulk-bar">
      <strong>{t('common.selected', { count: values.length })}</strong>
      <button disabled={c.busy || cannotComplete} onClick={() => c.act(values, 'finish')}>
        {t('task.bulkComplete')}
      </button>
      <button disabled={c.busy} onClick={() => c.act(values, readOnly ? 'restore' : 'archive')}>
        {t(readOnly ? 'common.restore' : 'common.archive')}
      </button>
      {c.query.view !== 'trash' && (
        <button disabled={c.busy} onClick={() => c.act(values, 'trash')}>
          {t('common.trash')}
        </button>
      )}
    </div>
  );
}

function emptyCopy(c: WorkspaceController): ContentKey {
  const query = c.query;
  if (query.search || query.project || query.tag || query.priority) return 'common.emptyFiltered';
  if (query.view === 'trash') return 'common.emptyTrash';
  return query.view === 'archive' ? 'common.emptyArchive' : 'common.emptyBody';
}

function Empty({ controller: c }: { controller: WorkspaceController }) {
  const t = useText();
  const copy = emptyCopy(c);
  const notes = c.query.view === 'notes';
  return (
    <div className="empty-state">
      <span className="empty-symbol">
        <Sparkles size={28} />
      </span>
      <h2>{t('common.emptyTitle')}</h2>
      <p>{t(copy)}</p>
      {copy === 'common.emptyBody' && (
        <button className="text-button" onClick={notes ? c.newNoteEditor : c.newTaskEditor}>
          <Plus size={17} />
          {t(notes ? 'note.new' : 'task.new')}
        </button>
      )}
    </div>
  );
}
