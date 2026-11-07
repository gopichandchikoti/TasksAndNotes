import { lazy, Suspense } from 'react';
import { Menu, Search } from 'lucide-react';
import { ContentProvider, useText } from './content';
import { isTask } from './models/task';
import { useWorkspace, type Workspace } from './hooks/useWorkspace';
import { useWorkspaceController, repository, type WorkspaceController } from './hooks/useWorkspaceController';
import { usePlatform } from './hooks/usePlatform';
import { TaskEditor } from './features/tasks/TaskEditor';
import { ProjectsView } from './features/projects/ProjectsView';
import { SettingsView } from './features/settings/SettingsView';
import { Sidebar } from './ui/Sidebar';
import { PwaNotice } from './ui/PwaNotice';
import { WorkspaceHeader } from './ui/WorkspaceHeader';
import { WorkspaceList } from './ui/WorkspaceList';
import { WorkspaceFeedback } from './ui/WorkspaceFeedback';

const NoteEditor = lazy(() => import('./features/notes/NoteEditor').then((module) => ({ default: module.NoteEditor })));

export function App() {
  const { data, failed, retry } = useWorkspace();
  return (
    <ContentProvider locale={data?.settings.locale ?? 'en'}>
      {failed ? <StorageError retry={retry} /> : data ? <WorkspaceView data={data} /> : <Loading />}
    </ContentProvider>
  );
}

function Loading() {
  const t = useText();
  return (
    <p className="startup" role="status">
      {t('common.loading')}
    </p>
  );
}
function StorageError({ retry }: { retry: () => void }) {
  const t = useText();
  return (
    <main className="startup">
      <h1>{t('app.name')}</h1>
      <p role="alert">{t('error.storage')}</p>
      <button onClick={retry}>{t('common.retry')}</button>
    </main>
  );
}

function WorkspaceView({ data }: { data: Workspace }) {
  const t = useText();
  const c = useWorkspaceController(data);
  const platform = usePlatform(data.settings.theme);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('nav.skip')}
      </a>
      <Sidebar
        view={c.query.view}
        navigate={c.navigate}
        projects={data.projects}
        project={c.query.project}
        chooseProject={c.chooseProject}
        open={c.navOpen}
      />
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={t('nav.toggle')}
            aria-expanded={c.navOpen}
            aria-controls="workspace-nav"
            onClick={() => c.setNavOpen(!c.navOpen)}
          >
            <Menu size={21} />
          </button>
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              ref={c.search}
              type="search"
              aria-label={t('common.searchHint')}
              placeholder={t('common.search')}
              value={c.query.search}
              onChange={(event) => c.changeQuery({ ...c.query, search: event.target.value })}
            />
            <kbd>{t('common.searchKey')}</kbd>
          </div>
          <span className="connection">
            <i className={platform.online ? 'online' : 'offline'} />
            {t(platform.online ? 'app.local' : 'common.offline')}
          </span>
        </header>
        <PwaNotice editing={Boolean(c.editor)} />
        {!platform.online && (
          <p className="banner" role="status">
            {t('common.offline')}
          </p>
        )}
        {platform.error && (
          <p className="error banner" role="alert">
            {t(platform.error)}
          </p>
        )}
        <main id="main" tabIndex={-1} className="main-content">
          <WorkspaceHeader controller={c} data={data} />
          <WorkspaceBody controller={c} data={data} />
          {c.error && (
            <p className="error" role="alert">
              {t(c.error)}
              <button onClick={() => c.setError(undefined)}>{t('common.close')}</button>
            </p>
          )}
          <footer className="workspace-footer">{t('common.shortcut')}</footer>
        </main>
      </div>
      <WorkspaceFeedback controller={c} />
      <EditorHost controller={c} data={data} />
    </div>
  );
}

function WorkspaceBody({ controller: c, data }: { controller: WorkspaceController; data: Workspace }) {
  if (!c.query.search && c.query.view === 'settings') return <SettingsView settings={data.settings} />;
  if (!c.query.search && c.query.view === 'projects') {
    return <ProjectsView projects={data.projects} repository={repository} open={c.chooseProject} />;
  }
  return <WorkspaceList controller={c} data={data} />;
}

function EditorHost({ controller: c, data }: { controller: WorkspaceController; data: Workspace }) {
  const editor = c.editor;
  if (!editor) return null;
  const close = () => c.setEditor(undefined);
  if (isTask(editor.entry))
    return (
      <TaskEditor
        task={editor.entry}
        existing={editor.existing}
        repository={repository}
        projects={data.projects}
        close={close}
      />
    );
  return (
    <Suspense fallback={<Loading />}>
      <NoteEditor note={editor.entry} existing={editor.existing} repository={repository} close={close} />
    </Suspense>
  );
}
