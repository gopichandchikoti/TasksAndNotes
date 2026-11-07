import { ZodError } from 'zod';
import { t, type ContentKey } from '../content';

export function errorKey(error: unknown): ContentKey {
  if (error instanceof ZodError) return 'error.validation';
  if (error instanceof Error) {
    if (error.name === 'QuotaExceededError' || error.name === 'BulkError') return 'error.quota';
    const keys = [
      'error.date',
      'error.conflict',
      'error.project',
      'error.transition',
      'error.backup',
      'error.size',
      'error.notifications',
    ] as const;
    const key = keys.find((candidate) => error.message === t(candidate));
    if (key) return key;
  }
  return 'error.generic';
}
