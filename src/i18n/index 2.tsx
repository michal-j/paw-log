import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import catalogues from './catalogues.generated.json';

export type Lang = 'en' | 'pl';
export const LANGS: readonly Lang[] = ['en', 'pl'];
export type Catalogue = Record<string, string>;
export type MessageKey = keyof typeof catalogues.en;

const STORAGE_KEY = 'pawlog.lang';
const all: Record<Lang, Catalogue> = catalogues;

/** Look up a key; falls back to English, then to the key itself, so a gap is visible but never crashes. */
export function translate(lang: Lang, key: string): string {
  return all[lang][key] ?? all.en[key] ?? key;
}

export function detectLang(saved: string | null, navigatorLang: string | undefined): Lang {
  if (saved === 'en' || saved === 'pl') return saved;
  return navigatorLang?.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

function initialLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  return detectLang(saved, globalThis.navigator?.language);
}

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
}

const Context = createContext<I18n | null>(null);

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(initial ?? initialLang());
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.documentElement.lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const value = useMemo<I18n>(() => ({ lang, setLang, t: (key) => translate(lang, key) }), [lang, setLang]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
