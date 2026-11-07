import { ArrowDown, ArrowUp, Archive, Check, FileText, Pin, RotateCcw, Trash2 } from 'lucide-react';
import { useText } from '../content';
import { formatDate } from '../domain/dates';
import { isTask, type Entry, type Project, type Task } from '../models/task';
import type { Action } from '../db/repository';

interface Props {
  entries: Entry[];
  projects: Project[];
  locale: string;
  selected: Set<string>;
  select: (id: string) => void;
  edit: (entry: Entry) => void;
  act: (entries: Entry[], action: Action) => void;
  move: (first: string, second: string) => void;
  readOnly: boolean;
}

export function EntryList(props: Props) {
  return (
    <ul className="entry-list">
      {props.entries.map((entry, index) => (
        <EntryRow {...props} entry={entry} index={index} key={entry.id} />
      ))}
    </ul>
  );
}

function EntryRow(props: Props & { entry: Entry; index: number }) {
  const { entry, selected, select, edit, act, readOnly } = props;
  const t = useText();
  const task = isTask(entry) ? entry : undefined;
  const done = task?.status === 'completed';
  return (
    <li className={`entry ${done ? 'completed' : ''} ${!task ? 'note-entry' : ''}`}>
      <input
        className="select-entry"
        type="checkbox"
        checked={selected.has(entry.id)}
        aria-label={t('common.select', { title: entry.title })}
        onChange={() => select(entry.id)}
      />
      <EntryMarker entry={entry} readOnly={readOnly} act={act} />
      <div className="entry-body">
        <button className="entry-title" onClick={() => edit(entry)} disabled={readOnly}>
          {entry.title}
        </button>
        <EntryMeta entry={entry} projects={props.projects} locale={props.locale} />
        {!isTask(entry) && <p className="note-excerpt">{entry.body.slice(0, 160)}</p>}
      </div>
      <EntryActions {...props} />
    </li>
  );
}

function EntryMarker({ entry, readOnly, act }: Pick<Props, 'readOnly' | 'act'> & { entry: Entry }) {
  const t = useText();
  if (!isTask(entry)) return <FileText className="note-glyph" size={22} aria-hidden="true" />;
  const done = entry.status === 'completed';
  return (
    <button
      className={`task-check ${done ? 'checked' : ''}`}
      disabled={readOnly}
      aria-label={t('task.complete', { title: entry.title })}
      aria-pressed={done}
      onClick={() => act([entry], 'complete')}
    >
      {done && <Check size={16} />}
    </button>
  );
}

function EntryActions(props: Props & { entry: Entry; index: number }) {
  const { entry, act, readOnly } = props;
  const t = useText();
  const archived = isTask(entry) ? entry.status === 'archived' : entry.archived;
  return (
    <div className="entry-actions" role="group" aria-label={t('common.actions', { title: entry.title })}>
      {isTask(entry) && !readOnly && <Reorder {...props} />}
      {entry.deletedAt || archived ? (
        <button
          className="icon-button"
          aria-label={t('common.restore')}
          title={t('common.restore')}
          onClick={() => act([entry], 'restore')}
        >
          <RotateCcw size={17} />
        </button>
      ) : (
        <button
          className="icon-button"
          aria-label={t('common.archive')}
          title={t('common.archive')}
          onClick={() => act([entry], 'archive')}
        >
          <Archive size={17} />
        </button>
      )}
      {!entry.deletedAt && (
        <button
          className="icon-button"
          aria-label={t('common.trash')}
          title={t('common.trash')}
          onClick={() => act([entry], 'trash')}
        >
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}

function EntryMeta({ entry, projects, locale }: { entry: Entry; projects: Project[]; locale: string }) {
  const t = useText();
  return (
    <div className="entry-meta">
      {isTask(entry) ? (
        <TaskMeta task={entry} projects={projects} locale={locale} />
      ) : (
        entry.pinned && (
          <span>
            <Pin size={12} />
            {t('note.pinned')}
          </span>
        )
      )}
      {entry.tags.map((tag) => (
        <span className="tag" key={tag}>
          #{tag}
        </span>
      ))}
    </div>
  );
}

function TaskMeta({ task, projects, locale }: { task: Task; projects: Project[]; locale: string }) {
  const t = useText();
  const project = projects.find((value) => value.id === task.projectId);
  return (
    <>
      <span className={`priority ${task.priority}`}>
        <i />
        {t(`priority.${task.priority}`)}
      </span>
      {task.status === 'in_progress' && <span>{t('status.in_progress')}</span>}
      {task.dueAt && <time dateTime={task.dueAt}>{formatDate(task.dueAt, locale)}</time>}
      {project && <span className="project-name">{project.name}</span>}
      {task.subtasks.length > 0 && (
        <span>
          {t('task.progress', {
            done: task.subtasks.filter((item) => item.completed).length,
            total: task.subtasks.length,
          })}
        </span>
      )}
    </>
  );
}

function Reorder({ entry, entries, index, move }: Props & { entry: Entry; index: number }) {
  const t = useText();
  const previous = entries[index - 1];
  const next = entries[index + 1];
  return (
    <span className="reorder">
      <button
        className="icon-button"
        disabled={!previous || !isTask(previous)}
        aria-label={t('task.up', { title: entry.title })}
        onClick={() => previous && move(entry.id, previous.id)}
      >
        <ArrowUp size={14} />
      </button>
      <button
        className="icon-button"
        disabled={!next || !isTask(next)}
        aria-label={t('task.down', { title: entry.title })}
        onClick={() => next && move(entry.id, next.id)}
      >
        <ArrowDown size={14} />
      </button>
    </span>
  );
}
