import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { z } from 'zod';
import bundled from '../public/tasksandnotes.model.json';

export type ContentKey = keyof typeof bundled.locales.en;
export type Locale = 'en' | 'es';
const ContentContext = createContext<{ locale: Locale; model: typeof bundled }>({ locale: 'en', model: bundled });
const schema = z
  .object({
    schemaVersion: z.literal(1),
    defaultLocale: z.literal('en'),
    locales: z.object({ en: z.record(z.string(), z.string()), es: z.record(z.string(), z.string()) }).strict(),
  })
  .strict();

export function validateContent(value: unknown): typeof bundled {
  const parsed = schema.parse(value);
  const keys = Object.keys(bundled.locales.en);
  for (const dictionary of Object.values(parsed.locales)) {
    if (Object.keys(dictionary).length !== keys.length) throw new Error('Content key parity');
    for (const key of keys) {
      const reference = Reflect.get(bundled.locales.en, key);
      const text = dictionary[key];
      if (!text || placeholders(text) !== placeholders(reference)) throw new Error('Invalid content placeholders');
    }
  }
  // Every key is checked above against the generated bundled contract.
  return parsed as typeof bundled;
}

function placeholders(value: string): string {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
}

export function resolveLocale(saved?: string, device = navigator.language): Locale {
  const candidate = saved ?? device.split('-')[0];
  return candidate === 'es' ? 'es' : 'en';
}

export function t(
  key: ContentKey,
  params: Record<string, string | number> = {},
  locale = 'en',
  model = bundled,
): string {
  const language = locale === 'es' ? 'es' : 'en';
  const dictionary = model.locales[language];
  const variant =
    typeof params.count === 'number'
      ? Reflect.get(dictionary, `${key}.${new Intl.PluralRules(language).select(params.count)}`)
      : undefined;
  const template = typeof variant === 'string' ? variant : dictionary[key] || bundled.locales.en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return typeof value === 'number' ? new Intl.NumberFormat(language).format(value) : String(value ?? '');
  });
}

export function useText() {
  const { locale, model } = useContext(ContentContext);
  return (key: ContentKey, params?: Record<string, string | number>) => t(key, params, locale, model);
}

export function ContentProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [model, setModel] = useState(bundled);
  const [failed, setFailed] = useState(false);
  async function load() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}tasksandnotes.model.json`, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Content unavailable');
      setModel(validateContent(await response.json()));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
    document.title = t('app.name', {}, locale, model);
  }, [locale, model]);
  return (
    <ContentContext.Provider value={{ locale, model }}>
      {failed && (
        <div className="banner" role="status">
          {t('content.fallback', {}, locale)}
          <button onClick={() => void load()}>{t('common.retry', {}, locale)}</button>
        </div>
      )}
      {children}
    </ContentContext.Provider>
  );
}
