import { t } from '../content';

export function localInput(instant?: string): string {
  if (!instant) return '';
  const date = new Date(instant);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Reject nonexistent wall times, including spring-forward DST gaps. Fall-back uses the first occurrence.
export function utcInput(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(date.getTime())) {
    throw new Error(t('error.date'));
  }
  const instant = date.toISOString();
  if (localInput(instant) !== value) throw new Error(t('error.date'));
  return instant;
}

export function dayKey(instant: string): string {
  return localInput(instant).slice(0, 10);
}

export function formatDate(instant: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(instant),
  );
}
