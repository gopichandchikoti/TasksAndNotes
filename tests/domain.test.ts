import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import model from '../public/tasksandnotes.model.json';
import { resolveLocale, t, validateContent } from '../src/content';
import { parseTags, taskSchema } from '../src/models/task';
import { newNote, newTask } from '../src/domain/factory';
import { dayKey, formatDate, localInput, utcInput } from '../src/domain/dates';
import { errorKey } from '../src/domain/errors';
import { compareEntries, matchesSearch, matchesView, selectEntries, type Query } from '../src/domain/query';
import { transition, nextTimestamp } from '../src/db/repository';

const task = { ...newTask(1), title: 'Draft garden plan', description: 'Bird habitat', tags: ['home'] };
const note = { ...newNote(), title: 'Journal', body: 'A quiet garden', tags: ['ideas'] };
const now = new Date().toISOString();
const past = new Date(Date.now() - 86400000 * 2).toISOString();
const future = new Date(Date.now() + 86400000 * 2).toISOString();
const query: Query = { view: 'all', search: '', project: '', tag: '', priority: '', showCompleted: true };

describe('content contracts', () => {
  it('validates both languages, resolves device/saved language and interpolates named values', () => {
    expect(validateContent(model)).toEqual(model);
    expect(resolveLocale(undefined, 'es-MX')).toBe('es');
    expect(resolveLocale('en', 'es')).toBe('en');
    expect(resolveLocale('unknown', 'es')).toBe('en');
    expect(resolveLocale()).toBe('en');
    expect(t('common.selected', { count: 2 }, 'es')).toBe('2 seleccionados');
    expect(t('common.selected')).toBe(' selected');
    expect(t('nav.inbox', {}, 'unknown')).toBe('Inbox');
  });
  it('rejects missing keys, invalid JSON structure and mismatched message placeholders', () => {
    const missing = structuredClone(model);
    Reflect.deleteProperty(missing.locales.es, 'app.name');
    expect(() => validateContent(missing)).toThrow();
    const mismatch = structuredClone(model);
    mismatch.locales.es['common.selected'] = '{total}';
    expect(() => validateContent(mismatch)).toThrow();
    expect(() => validateContent({})).toThrow();
    const fallback = structuredClone(model);
    fallback.locales.es['nav.inbox'] = '';
    expect(t('nav.inbox', {}, 'es', fallback)).toBe('Inbox');
  });
});

describe('dates and input boundaries', () => {
  it('round-trips local times to UTC and rejects impossible and invalid dates', () => {
    expect(localInput()).toBe('');
    expect(utcInput('')).toBeUndefined();
    const valid = '2026-11-06T10:15';
    expect(localInput(utcInput(valid))).toBe(valid);
    expect(dayKey(now)).toHaveLength(10);
    expect(formatDate(now, 'en')).toBeTruthy();
    expect(() => utcInput('not-a-date')).toThrow();
    expect(() => utcInput('2026-02-30T10:00')).toThrow();
    expect(() => utcInput('2026-11-06')).toThrow();
    expect(() => utcInput('2026-03-08T02:30')).toThrow();
    expect(localInput(utcInput('2026-11-01T01:30'))).toBe('2026-11-01T01:30');
    expect(t('common.items', { count: 1 })).toBe('1 item');
    expect(t('common.items', { count: 2 }, 'es')).toBe('2 elementos');
  });
  it('validates tags, limits, UUIDs, enums, timestamps, and note-independent task fields', () => {
    expect(parseTags('home, home, work, ,')).toEqual(['home', 'work']);
    for (const patch of [
      { title: '' },
      { title: 'x'.repeat(241) },
      { id: 'bad' },
      { dueAt: 'bad' },
      { priority: 'bad' },
      { tags: ['x'.repeat(41)] },
      { order: -1 },
      { order: Infinity },
    ]) {
      expect(() => taskSchema.parse({ ...task, ...patch })).toThrow();
    }
    expect(taskSchema.parse(task)).toMatchObject({ title: task.title });
  });
  it('maps errors to safe localized messages', () => {
    expect(errorKey(new ZodError([]))).toBe('error.validation');
    expect(errorKey(new DOMException('', 'QuotaExceededError'))).toBe('error.quota');
    expect(errorKey(new Error(t('error.conflict')))).toBe('error.conflict');
    expect(errorKey(new Error('private internal stack'))).toBe('error.generic');
    expect(errorKey(null)).toBe('error.generic');
  });
});

describe('view, filter, search and ordering behavior', () => {
  it('handles task and note lifecycle views', () => {
    expect(matchesView(task, 'inbox', now)).toBe(true);
    expect(matchesView({ ...task, projectId: crypto.randomUUID() }, 'inbox', now)).toBe(false);
    expect(matchesView(task, 'notes', now)).toBe(false);
    expect(matchesView(note, 'notes', now)).toBe(true);
    expect(matchesView(note, 'all', now)).toBe(false);
    expect(matchesView({ ...note, archived: true }, 'notes', now)).toBe(false);
    expect(matchesView({ ...task, status: 'archived' }, 'archive', now)).toBe(true);
    expect(matchesView({ ...note, archived: true }, 'archive', now)).toBe(true);
    expect(matchesView({ ...note, deletedAt: now }, 'trash', now)).toBe(true);
    expect(matchesView({ ...task, deletedAt: now }, 'all', now)).toBe(false);
    expect(matchesView(task, 'trash', now)).toBe(false);
    expect(matchesView(task, 'today', now)).toBe(false);
    expect(matchesView({ ...task, dueAt: past }, 'today', now)).toBe(true);
    expect(matchesView({ ...task, dueAt: future }, 'today', now)).toBe(false);
    expect(matchesView({ ...task, dueAt: future }, 'upcoming', now)).toBe(true);
    expect(matchesView(task, 'upcoming', now)).toBe(false);
  });
  it('searches notes, task descriptions, subtasks and project names across views', () => {
    const project = { id: crypto.randomUUID(), name: 'Fieldwork', color: '#123456' };
    const assigned = {
      ...task,
      projectId: project.id,
      subtasks: [{ id: crypto.randomUUID(), title: 'Buy seeds', completed: false }],
    };
    expect(matchesSearch(assigned, 'SEEDS fieldwork', [project])).toBe(true);
    expect(matchesSearch(task, 'missing', [])).toBe(false);
    expect(selectEntries([task, note], { ...query, search: 'garden' }, [], now)).toHaveLength(2);
    expect(selectEntries([{ ...note, deletedAt: now }], { ...query, search: 'garden' }, [], now)).toHaveLength(0);
    expect(selectEntries([task], { ...query, tag: 'missing' }, [], now)).toHaveLength(0);
    expect(selectEntries([task], { ...query, tag: 'home' }, [], now)).toHaveLength(1);
    expect(selectEntries([assigned], { ...query, project: 'missing' }, [], now)).toHaveLength(0);
    expect(selectEntries([assigned], { ...query, project: project.id }, [], now)).toHaveLength(1);
    expect(selectEntries([task], { ...query, priority: 'urgent' }, [], now)).toHaveLength(0);
    expect(selectEntries([task], { ...query, priority: 'medium' }, [], now)).toHaveLength(1);
    expect(selectEntries([{ ...task, status: 'completed' }], { ...query, showCompleted: false }, [], now)).toHaveLength(
      0,
    );
    expect(compareEntries(task, { ...task, order: 2 })).toBeLessThan(0);
    expect(compareEntries(task, { ...task })).toBe(0);
    expect(compareEntries(task, note)).toBe(-1);
    expect(compareEntries(note, task)).toBe(1);
    expect(compareEntries({ ...note, pinned: true }, note)).toBeLessThan(0);
    expect(compareEntries(note, { ...note, updatedAt: future })).toBeGreaterThan(0);
  });
});

it('handles all state transitions and rejects illegal completions', () => {
  expect(transition({ ...task, status: 'completed' }, 'complete')).toMatchObject({ status: 'todo' });
  expect(transition(task, 'archive')).toMatchObject({ status: 'archived' });
  expect(transition({ ...task, status: 'archived' }, 'restore')).toMatchObject({ status: 'todo' });
  expect(() => transition(note, 'complete')).toThrow();
  expect(() => transition({ ...task, deletedAt: now }, 'complete')).toThrow();
  expect(() => transition({ ...task, status: 'archived' }, 'complete')).toThrow();
  expect(nextTimestamp(future) > future).toBe(true);
});
