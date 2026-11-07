import { Archive, CalendarDays, CheckCheck, FileText, FolderOpen, Inbox, Settings, Sun, Trash2 } from 'lucide-react';
import { useText } from '../content';
import type { View } from '../domain/query';
import type { Project } from '../models/task';

const navigation = [
  ['inbox', Inbox],
  ['today', Sun],
  ['upcoming', CalendarDays],
  ['all', CheckCheck],
  ['notes', FileText],
  ['projects', FolderOpen],
  ['archive', Archive],
  ['trash', Trash2],
  ['settings', Settings],
] as const;

export function Sidebar({
  view,
  navigate,
  projects,
  project,
  chooseProject,
  open,
}: {
  view: View;
  navigate: (view: View) => void;
  projects: Project[];
  project: string;
  chooseProject: (id: string) => void;
  open: boolean;
}) {
  const t = useText();
  return (
    <aside id="workspace-nav" className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark">
          <CheckCheck size={25} />
        </span>
        <div>
          <strong>{t('app.name')}</strong>
          <span>{t('app.workspace')}</span>
        </div>
      </div>
      <nav aria-label={t('nav.label')}>
        {navigation.map(([key, Icon], index) => (
          <div key={key}>
            {index === 5 && <p className="nav-caption">{t('nav.organize')}</p>}
            <button
              className={`nav-item ${view === key && !project ? 'active' : ''}`}
              aria-current={view === key && !project ? 'page' : undefined}
              onClick={() => navigate(key)}
            >
              <Icon size={18} />
              <span>{t(`nav.${key}`)}</span>
            </button>
          </div>
        ))}
        {projects.length > 0 && (
          <div className="sidebar-projects">
            {projects.map((item) => (
              <button
                className={`nav-item ${project === item.id ? 'active' : ''}`}
                key={item.id}
                aria-current={project === item.id ? 'page' : undefined}
                onClick={() => chooseProject(item.id)}
              >
                <span className="project-dot" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>
      <div className="sidebar-footer">
        <span className="local-dot" />
        {t('app.local')}
      </div>
    </aside>
  );
}
