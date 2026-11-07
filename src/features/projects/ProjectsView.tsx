import { useState } from 'react';
import { ArrowUpRight, Folder, Pencil, Plus } from 'lucide-react';
import { useText, type ContentKey } from '../../content';
import { Repository } from '../../db/repository';
import { errorKey } from '../../domain/errors';
import type { Project } from '../../models/task';
import { Field } from '../../ui/Field';

export function ProjectsView({
  projects,
  repository,
  open,
}: {
  projects: Project[];
  repository: Repository;
  open: (id: string) => void;
}) {
  const t = useText();
  const [draft, setDraft] = useState<Project>({ id: crypto.randomUUID(), name: '', color: '#1d5945' });
  const [error, setError] = useState<ContentKey>();
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await repository.saveProject(draft);
      setDraft({ id: crypto.randomUUID(), name: '', color: '#1d5945' });
      setError(undefined);
    } catch (failure) {
      setError(errorKey(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="projects-view">
      <form
        className="project-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Field label={t('project.name')}>
          {(id) => (
            <input
              id={id}
              value={draft.name}
              required
              maxLength={80}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('project.color')}>
          {(id) => (
            <input
              id={id}
              type="color"
              value={draft.color}
              onChange={(event) => setDraft({ ...draft, color: event.target.value })}
            />
          )}
        </Field>
        <button className="primary" disabled={busy}>
          <Plus size={17} />
          {t('common.save')}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {t(error)}
        </p>
      )}
      {!projects.length && <p className="muted">{t('project.empty')}</p>}
      <ul className="project-list">
        {projects.map((project) => (
          <li key={project.id}>
            <Folder style={{ color: project.color }} size={24} />
            <button
              className="entry-title"
              onClick={() => open(project.id)}
              aria-label={t('project.open', { name: project.name })}
            >
              {project.name}
              <ArrowUpRight size={17} />
            </button>
            <button className="icon-button" aria-label={t('common.edit')} onClick={() => setDraft(project)}>
              <Pencil size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
