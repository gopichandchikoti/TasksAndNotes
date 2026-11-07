import { useCallback, useRef, useState } from 'react';
import { Bold, Heading, ListChecks, Link, Download, Pin } from 'lucide-react';
import { useText } from '../../content';
import { parseTags, type Note } from '../../models/task';
import { Repository } from '../../db/repository';
import { useDraft } from '../../hooks/useDraft';
import { Field } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { download } from '../../platform/download';
import { Markdown } from './Markdown';

export function NoteEditor({
  note,
  repository,
  existing,
  close,
}: {
  note: Note;
  repository: Repository;
  existing: boolean;
  close: () => void;
}) {
  const t = useText();
  const persist = useCallback(
    async (value: Parameters<Repository['save']>[1], expected?: string) => repository.save('notes', value, expected),
    [repository],
  );
  const state = useDraft(note, persist, true, existing);
  const { draft, change } = state;
  const [preview, setPreview] = useState(false);
  const [tags, setTags] = useState(note.tags.join(', '));
  const textarea = useRef<HTMLTextAreaElement>(null);
  async function requestClose() {
    if (!state.dirty || (await state.save())) close();
  }
  function format(prefix: string, suffix = '') {
    const input = textarea.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = draft.body.slice(start, end);
    change({ ...draft, body: draft.body.slice(0, start) + prefix + selected + suffix + draft.body.slice(end) });
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + prefix.length, end + prefix.length);
    });
  }
  return (
    <Modal title={existing ? note.title : t('note.new')} close={() => void requestClose()} wide>
      <form
        className="editor-form note-editor"
        onSubmit={(event) => {
          event.preventDefault();
          void state.save();
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            void state.save();
          }
        }}
      >
        <Field label={t('note.title')}>
          {(id) => (
            <input
              id={id}
              className="note-title"
              value={draft.title}
              required
              maxLength={240}
              autoFocus
              onChange={(event) => change({ ...draft, title: event.target.value })}
            />
          )}
        </Field>
        <div className="note-tools">
          <div className="segmented" aria-label={t('note.body')}>
            <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
              {t('note.write')}
            </button>
            <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
              {t('note.preview')}
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={t(draft.pinned ? 'note.unpin' : 'note.pin')}
            aria-pressed={draft.pinned}
            onClick={() => change({ ...draft, pinned: !draft.pinned })}
          >
            <Pin size={18} />
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t('note.export')}
            onClick={() => download(`# ${draft.title}\n\n${draft.body}\n`, `${draft.title}.md`, 'text/markdown')}
          >
            <Download size={18} />
          </button>
        </div>
        {!preview && (
          <div className="format-tools">
            <button type="button" aria-label={t('note.bold')} onClick={() => format('**', '**')}>
              <Bold size={17} />
            </button>
            <button type="button" aria-label={t('note.heading')} onClick={() => format('\n## ')}>
              <Heading size={17} />
            </button>
            <button type="button" aria-label={t('note.checklist')} onClick={() => format('\n- [ ] ')}>
              <ListChecks size={17} />
            </button>
            <button type="button" aria-label={t('note.link')} onClick={() => format('[', '](https://)')}>
              <Link size={17} />
            </button>
          </div>
        )}
        {preview ? (
          <section className="note-preview" aria-label={t('note.preview')}>
            {draft.body ? <Markdown body={draft.body} /> : <p className="muted">{t('note.noPreview')}</p>}
          </section>
        ) : (
          <textarea
            ref={textarea}
            className="markdown-input"
            aria-label={t('note.body')}
            placeholder={t('note.placeholder')}
            value={draft.body}
            maxLength={1000000}
            onChange={(event) => change({ ...draft, body: event.target.value })}
          />
        )}
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
        <p className="small muted">{t('note.autosave')}</p>
        {state.error && (
          <p className="error" role="alert">
            {t(state.error)}
            <button type="button" onClick={() => void state.save()}>
              {t('common.retry')}
            </button>
          </p>
        )}
        <footer className="editor-footer">
          <span className="save-state" role="status">
            {t(state.status)}
          </span>
          <button
            type="button"
            onClick={() => {
              if (!state.dirty || window.confirm(t('common.discard'))) close();
            }}
          >
            {t('common.cancel')}
          </button>
          <button type="button" onClick={() => void requestClose()}>
            {t('common.close')}
          </button>
          <button className="primary" disabled={state.status === 'common.saving'}>
            {t('common.save')}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
