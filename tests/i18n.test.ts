import { afterEach, describe, expect, it } from 'vitest';
import { catalogText, detectLocale, localizeError, setLocale, translate } from '../src/ui/i18n';
import { en } from '../src/ui/locales/en';

afterEach(() => setLocale('zh-CN'));
describe('interface languages', () => {
  it('detects the preferred browser language with a stable English fallback', () => {
    expect(detectLocale(['zh-TW', 'en-US'])).toBe('zh-CN');
    expect(detectLocale(['en-GB', 'zh-CN'])).toBe('en');
    expect(detectLocale(['fr-FR'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
  it('preserves interpolation values instead of translating user content', () => {
    setLocale('en');
    expect(translate('已选择 {name}', { name: '演员 Alice' })).toBe('Selected 演员 Alice');
    expect(translate('在 {time} 秒设关键帧', { time: 1.25 })).toBe('Set keyframe at 1.25s');
    expect(catalogText('我的剧本 · 第一天')).toBe('我的剧本 · 第一天');
    setLocale('zh-CN');
    expect(translate('已选择 {name}', { name: 'Alice' })).toBe('已选择 Alice');
  });
  it('keeps the same placeholders in both languages', () => {
    const params = (text: string) =>
      [...text.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]).sort();
    for (const [source, english] of Object.entries(en)) {
      expect(english.trim().length).toBeGreaterThan(0);
      expect(params(english), source).toEqual(params(source));
    }
  });
  it('localizes a stale revision without losing the observed versions', () => {
    setLocale('en');
    expect(localizeError('工程已更新：当前版本 8，提交版本 7。请重新读取后修改。')).toBe(
      'The project changed (current revision 8, submitted 7). Read it again before editing.',
    );
    expect(localizeError('WebGL context lost')).toBe('WebGL context lost');
  });
});
