# Interface languages

The director supports Simplified Chinese (`zh-CN`) and English (`en`). The language selector is available in the top bar and connection/loading screen. The initial language follows the browser's preferred language: Chinese variants use `zh-CN`, and other languages fall back to English. A user selection is saved under `hengdian.locale` in localStorage and synchronizes across tabs on the same origin. If storage is unavailable, the selection still works for the current session.

Changing language updates interface text, accessible labels, dialog copy, status messages, built-in catalog metadata, and the document language/title. It does not make API calls, change the project revision, rename existing objects/shots, rewrite shot intent, or translate notes and asset provenance. A newly added object or recipe may use a localized default name; once saved, that name is creator-owned data.

## Add interface text

Use `src/ui/i18n.tsx` in React components:

```tsx
import { useI18n } from '../i18n';

const { t, locale, setLocale } = useI18n();
const label = t('保存姿态关键帧');
const message = t('在 {time} 秒设关键帧', { time: 1.25 });
```

Add a Chinese source key and English translation to `src/ui/locales/en.ts`. Source keys are the Chinese dictionary, and `MessageKey` derives from those keys. The translator enforces recognized keys and required placeholder names in TypeScript. Keep complete phrases together rather than stitching translated fragments around numbers. The unit test checks matching placeholder sets across languages.

Use `t` for visible labels and `aria-label`, `title`, placeholders, confirmations, errors owned by the interface, and operation descriptions. Keep model IDs, schema keys, file paths, API URLs and enum values unchanged. Never pass a creator's name or note through a translation lookup. `catalogText` is only for trusted legacy built-in catalog metadata; new assets should use explicit bilingual metadata.

## Assets and joints

`src/core/library.ts` exposes `name` and `description` as `{ zh, en }`. The asset explorer chooses `locale === 'en' ? 'en' : 'zh'`, searches both languages, and preserves externally installed pack names. Asset IDs and categories remain stable. Category display labels belong in the interface dictionary.

Joint definitions and pose presets expose Chinese labels plus `englishName`. The actor inspector selects the appropriate display field; joint IDs remain stable in pose data. Action values such as `walk`, `run`, and `wave` stay unchanged, while their option labels use the dictionary. A new joint or action must add both languages before release.

## Add a locale

1. Add its BCP 47 identifier to `supportedLocales`.
2. Add a complete dictionary satisfying `Dictionary` to the `dictionaries` registry. TypeScript rejects missing keys. Preserve the source placeholder names.
3. Extend browser-language detection and the language selector.
4. Extend explicit metadata selection for assets, joints and presets; until a translation exists, fall back to English instead of translating creator data.
5. Check long labels, narrow screens, keyboard navigation, and the document `lang` attribute in the browser.

The initial two-language registry is intentionally small and synchronous. It has no translation service or runtime network dependency. This version does not claim right-to-left layout support.

## Errors and verification

`localizeError` translates known local-service messages, including revision conflicts, while preserving version numbers and model hashes. Unknown third-party/WebGL/OS diagnostics remain verbatim so debugging information is not lost. Future server operations should expose stable error codes with parameters; do not infer translations by rewriting arbitrary user strings.

Run the i18n unit suite and TypeScript checks, then test both languages in the actual browser. Confirm switching language leaves the project revision and creator text unchanged, refresh preserves the selection, and imported/custom names remain literal. New actor and asset controls are included in the same locale subscription; no separate store is needed.
