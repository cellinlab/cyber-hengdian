import { useSyncExternalStore } from 'react';
import { en } from './locales/en';
import { errorMessages } from './locales/errors';

export const supportedLocales = ['zh-CN', 'en'] as const;
export type Locale = (typeof supportedLocales)[number];
export type MessageKey = keyof typeof en;
export type Dictionary = { [K in MessageKey]: string };
type Placeholders<S extends string> = S extends `${string}{${infer P}}${infer Rest}`
  ? P | Placeholders<Rest>
  : never;
type TranslationArgs<K extends MessageKey> = [Placeholders<K>] extends [never]
  ? [values?: never]
  : [values: Record<Placeholders<K>, string | number>];
const dictionaries: Record<Locale, Dictionary> = {
  'zh-CN': Object.fromEntries(Object.keys(en).map((key) => [key, key])) as Dictionary,
  en,
};
export const LOCALE_STORAGE_KEY = 'hengdian.locale';
export function detectLocale(languages: readonly string[]): Locale {
  return languages[0]?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}
function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN';
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (supportedLocales.includes(saved as Locale)) return saved as Locale;
  } catch {
    /* Storage is optional, including private browsing. */
  }
  return detectLocale(navigator.languages?.length ? navigator.languages : [navigator.language]);
}
let locale = initialLocale();
const listeners = new Set<() => void>();
function applyDocumentLocale() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.title = `${dictionaries[locale]['赛博横店']} · ${dictionaries[locale]['导演台']}`;
}
applyDocumentLocale();
export function setLocale(next: Locale) {
  if (!supportedLocales.includes(next) || next === locale) return;
  locale = next;
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* Keep the session choice. */
  }
  applyDocumentLocale();
  listeners.forEach((notify) => notify());
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== LOCALE_STORAGE_KEY) return;
    const next = supportedLocales.includes(event.newValue as Locale)
      ? (event.newValue as Locale)
      : detectLocale(navigator.languages);
    if (next !== locale) {
      locale = next;
      applyDocumentLocale();
      listeners.forEach((fn) => fn());
    }
  });
}
/** Stable function: async callbacks always use the current language. */
export function translate<K extends MessageKey>(key: K, ...args: TranslationArgs<K>): string {
  const values = args[0] as Record<string, string | number> | undefined;
  return dictionaries[locale][key].replace(/\{([^}]+)\}/g, (token, name: string) =>
    values && name in values ? String(values[name]) : token,
  );
}
/** Only for trusted built-in catalog metadata, never user project names or input. */
export function catalogText(value: string): string {
  return Object.hasOwn(en, value) ? dictionaries[locale][value as MessageKey] : value;
}
export function useI18n() {
  const current = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => locale,
    () => 'zh-CN' as Locale,
  );
  return { locale: current, setLocale, t: translate, catalogText };
}
export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select
      className="language-selector"
      aria-label={t('语言')}
      title={t('语言')}
      value={locale}
      onChange={(event) => setLocale(event.target.value as Locale)}
    >
      <option value="zh-CN" lang="zh-CN">
        中文
      </option>
      <option value="en" lang="en">
        English
      </option>
    </select>
  );
}

export function localizeError(value: string): string {
  if (locale !== 'en') return value;
  let text = value.replace(/^Error: /, '');
  text = text.replace(
    /工程已更新：当前版本 (\d+)，提交版本 (\d+)。请重新读取后修改。/g,
    (_, current, submitted) =>
      `The project changed (current revision ${current}, submitted ${submitted}). Read it again before editing.`,
  );
  text = text.replace(
    /缺失模型资产 ([^，]+)，请导入完整工程包/g,
    (_, asset) => `Missing model asset ${asset}. Import the complete project package.`,
  );
  if (Object.hasOwn(errorMessages, text)) return errorMessages[text];
  if (Object.hasOwn(en, text)) return dictionaries[locale][text as MessageKey];
  const prefixes = ['无法启动 WebGL：', '片场加载失败：', '工程包缺少模型：'] as const;
  for (const prefix of prefixes) {
    if (text.startsWith(prefix))
      return translate(prefix) + localizeError(text.slice(prefix.length));
  }

  return text;
}
