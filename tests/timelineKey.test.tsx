import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { DemoRepository } from '../src/data';
import { I18nProvider, translate } from '../src/i18n';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const keyLabels = () => [...document.querySelectorAll('.tl-key__label')].map((el) => el.textContent ?? '');

describe('Timeline Key labels (JCB-87)', () => {
  it.each(['en', 'pl'] as const)('names the foods, not the day parts (%s)', async (lang) => {
    render(
      <I18nProvider initial={lang}>
        <App repository={new DemoRepository(null)} />
      </I18nProvider>,
    );
    await screen.findByRole('button', { name: lang === 'en' ? /Key for the day below/ : /Klucz dla dnia poniżej/ });
    const labels = keyLabels().filter((l) => l !== translate(lang, 'events'));
    expect(labels.length).toBeGreaterThan(0);
    for (const key of ['copy.48', 'copy.49', 'copy.50', 'copy.51', 'copy.52', 'copy.53', 'copy.54'] as const) {
      expect(labels).not.toContain(translate(lang, key));
    }
  });
});
