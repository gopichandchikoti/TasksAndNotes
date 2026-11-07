import { Plus } from 'lucide-react';
import { useText } from '../content';
import type { WorkspaceController } from '../hooks/useWorkspaceController';
import type { Workspace } from '../hooks/useWorkspace';

export function WorkspaceHeader({ controller: c, data }: { controller: WorkspaceController; data: Workspace }) {
  const t = useText();
  const project = data.projects.find((value) => value.id === c.query.project);
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">
          {new Intl.DateTimeFormat(data.settings.locale, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          }).format(new Date())}
        </p>
        <h1>{c.query.search ? t('common.searchResults') : (project?.name ?? t(`nav.${c.query.view}`))}</h1>
        <p className="page-description">{t(`view.${c.query.view}`)}</p>
      </div>
      <div className="header-actions">
        <button onClick={c.newNoteEditor}>
          <Plus size={16} />
          {t('note.new')}
        </button>
        <button className="primary" onClick={c.newTaskEditor}>
          <Plus size={17} />
          {t('task.new')}
        </button>
      </div>
    </header>
  );
}
