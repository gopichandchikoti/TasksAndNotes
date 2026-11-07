import { useCallback, useState } from 'react';
import { useText, type ContentKey } from '../../content';
import { priorities, statuses, parseTags, type Project, type Task } from '../../models/task';
import { localInput, utcInput } from '../../domain/dates';
import { errorKey } from '../../domain/errors';
import { Repository } from '../../db/repository';
import { useDraft } from '../../hooks/useDraft';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Checklist } from './Checklist';

export function TaskEditor({
  task,
  projects,
  repository,
  existing,
  close,
}: {
  task: Task;
  projects: Project[];
  repository: Repository;
  existing: boolean;
  close: () => void;
}) {
  const t = useText();
  const persist = useCallback(
    async (entry: Parameters<Repository['save']>[1], expected?: string) => repository.save('tasks', entry, expected),
    [repository],
  );
  const state = useDraft(task, persist, false, existing);
  const { draft, change } = state;
  const [tags, setTags] = useState(draft.tags.join(', '));
  const [dateError, setDateError] = useState<ContentKey>();
  function requestClose() {
    if (!state.dirty || window.confirm(t('common.discard'))) close();
  }
  function setDate(key: 'dueAt' | 'reminderAt', value: string) {
    try {
      change({ ...draft, [key]: utcInput(value), notifiedAt: undefined });
      setDateError(undefined);
    } catch (error) {
      setDateError(errorKey(error));
    }
  }
  async function submit() {
    if (!dateError && (await state.save())) close();
  }
  return (
    <Modal title={existing ? t('task.details') : t('task.new')} close={requestClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field label={t('task.title')}>
          {(id) => (
            <input
              id={id}
              value={draft.title}
              autoFocus
              required
              maxLength={240}
              onChange={(event) => change({ ...draft, title: event.target.value })}
            />
          )}
        </Field>
        <Field label={t('task.description')}>
          {(id) => (
            <textarea
              id={id}
              rows={3}
              value={draft.description ?? ''}
              maxLength={100000}
              onChange={(event) => change({ ...draft, description: event.target.value })}
            />
          )}
        </Field>
        <div className="field-grid">
          <Field label={t('task.priority')}>
            {(id) => (
              <select
                id={id}
                value={draft.priority}
                onChange={(event) => {
                  const value = priorities.find((priority) => priority === event.target.value);
                  if (value) change({ ...draft, priority: value });
                }}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {t(`priority.${priority}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t('task.status')}>
            {(id) => (
              <select
                id={id}
                value={draft.status}
                onChange={(event) => {
                  const value = statuses.find((status) => status === event.target.value);
                  if (value) change({ ...draft, status: value });
                }}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field label={t('task.project')}>
          {(id) => (
            <select
              id={id}
              value={draft.projectId ?? ''}
              onChange={(event) => change({ ...draft, projectId: event.target.value || undefined })}
            >
              <option value="">{t('task.noProject')}</option>
              {projects.map((project) => (
                <option value={project.id} key={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="field-grid">
          {(['dueAt', 'reminderAt'] as const).map((key) => (
            <Field key={key} label={t(key === 'dueAt' ? 'task.due' : 'task.reminder')}>
              {(id) => (
                <input
                  id={id}
                  type="datetime-local"
                  defaultValue={localInput(draft[key])}
                  onChange={(event) => setDate(key, event.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
        <p className="muted small">{t('task.dateHelp')}</p>
        <Field label={t('tag.label')}>
          {(id) => (
            <input
              id={id}
              value={tags}
              onChange={(event) => {
                setTags(event.target.value);
                change({ ...draft, tags: parseTags(event.target.value) });
              }}
            />
          )}
        </Field>
        <Checklist items={draft.subtasks} change={(subtasks) => change({ ...draft, subtasks })} />
        {(state.error || dateError) && (
          <p className="error" role="alert">
            {t(dateError ?? state.error ?? 'error.generic')}
          </p>
        )}
        <footer className="editor-footer">
          <button type="button" onClick={requestClose}>
            {t('common.cancel')}
          </button>
          <button className="primary" disabled={state.status === 'common.saving' || Boolean(dateError)}>
            {t(state.status === 'common.saving' ? state.status : 'common.save')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
