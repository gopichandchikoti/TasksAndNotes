import { useEffect, type RefObject } from 'react';

export function useShortcuts({
  search,
  newTask,
  newNote,
  editing,
}: {
  search: RefObject<HTMLInputElement>;
  newTask: () => void;
  newNote: () => void;
  editing: boolean;
}) {
  useEffect(() => {
    function handle(event: KeyboardEvent) {
      if (editing) return;
      if (isSearchShortcut(event)) {
        event.preventDefault();
        search.current?.focus();
        return;
      }
      if (isTyping(event.target)) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== 'n') return;
      event.preventDefault();
      if (event.shiftKey) newNote();
      else newTask();
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [search, newTask, newNote, editing]);
}

function isSearchShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
}
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.matches('input,textarea,select') || target.isContentEditable);
}
