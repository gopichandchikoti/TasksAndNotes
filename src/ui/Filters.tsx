import { useText } from '../content';
import type { Query } from '../domain/query';
import { priorities, type Project } from '../models/task';

export function Filters({
  query,
  change,
  tags,
  projects,
}: {
  query: Query;
  change: (query: Query) => void;
  tags: string[];
  projects: Project[];
}) {
  const t = useText();
  return (
    <div className="filters">
      <select
        aria-label={t('task.project')}
        value={query.project}
        onChange={(event) => change({ ...query, project: event.target.value })}
      >
        <option value="">{t('project.any')}</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </select>
      <select
        aria-label={t('task.priority')}
        value={query.priority}
        onChange={(event) => change({ ...query, priority: event.target.value })}
      >
        <option value="">{t('priority.any')}</option>
        {priorities.map((priority) => (
          <option key={priority} value={priority}>
            {t(`priority.${priority}`)}
          </option>
        ))}
      </select>
      <select
        aria-label={t('tag.label')}
        value={query.tag}
        onChange={(event) => change({ ...query, tag: event.target.value })}
      >
        <option value="">{t('tag.any')}</option>
        {tags.map((tag) => (
          <option key={tag} value={tag}>
            {tag}
          </option>
        ))}
      </select>
      {(query.tag || query.priority || query.project || query.search) && (
        <button
          className="text-button"
          onClick={() => change({ ...query, tag: '', priority: '', project: '', search: '' })}
        >
          {t('common.clear')}
        </button>
      )}
    </div>
  );
}
