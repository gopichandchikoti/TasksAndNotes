import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useDraft } from '../src/hooks/useDraft';
import { newNote } from '../src/domain/factory';
import type { Entry } from '../src/models/task';

it('retains unsaved drafts after quota failure, warns before unload and supports retry', async () => {
  const initial = { ...newNote(), title: 'Original' };
  const persist = vi
    .fn(async (value: Entry) => value)
    .mockRejectedValueOnce(new DOMException('', 'QuotaExceededError'));
  const { result } = renderHook(() => useDraft(initial, persist, false, true));
  act(() => result.current.change({ ...initial, body: 'Keep this draft' }));
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await act(async () => {
    expect(await result.current.save()).toBe(false);
  });
  expect(result.current.error).toBe('error.quota');
  expect(result.current.draft.body).toBe('Keep this draft');
  await act(async () => {
    expect(await result.current.save()).toBe(true);
  });
  expect(result.current.error).toBeUndefined();
  expect(result.current.dirty).toBe(false);
  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
});

it('serializes saves and preserves typing that arrives during a pending write', async () => {
  const initial = { ...newNote(), title: 'Thought' };
  let release: (entry: Entry) => void = () => {
    throw new Error('Save not started');
  };
  const persist = vi.fn((value: Entry) => Promise.resolve(value));
  persist.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const { result } = renderHook(() => useDraft(initial, persist, false, false));
  act(() => result.current.change({ ...initial, body: 'First' }));
  let saving: Promise<boolean>;
  act(() => {
    saving = result.current.save();
  });
  await waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
  act(() => result.current.change({ ...initial, body: 'Latest' }));
  await act(async () => {
    release(initial);
    await saving;
  });
  expect(result.current.draft.body).toBe('Latest');
  expect(result.current.dirty).toBe(true);
  await act(async () => {
    await result.current.save();
    await result.current.save();
  });
  expect(persist).toHaveBeenCalledTimes(2);
  expect(result.current.dirty).toBe(false);
});
