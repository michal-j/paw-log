import { useEffect, useState } from 'react';
import { DemoRepository, type Dog, type Entry, type Item, type Repository } from './data';
import { LANGS, useI18n, type MessageKey } from './i18n';

const STATE_LABEL: Record<Entry['state'], MessageKey> = {
  given: 'name.96',
  skipped: 'name.97',
  partial: 'name.98',
};

interface HomeData {
  dog: Dog;
  items: Item[];
  entries: Entry[];
}

async function fetchHome(repository: Repository): Promise<HomeData> {
  const [dog, items, entries] = await Promise.all([
    repository.getDog(),
    repository.listItems(),
    repository.listEntries({ to: repository.today() }),
  ]);
  return { dog, items, entries };
}

/** Placeholder home (slice 1): proves the app renders from the repository. Real screens start in slice 2. */
export function App({ repository }: { repository: Repository }) {
  const { lang, setLang, t } = useI18n();
  const [data, setData] = useState<HomeData | null>(null);
  const isDemo = repository instanceof DemoRepository;

  useEffect(() => {
    let live = true;
    void fetchHome(repository).then((next) => live && setData(next));
    return () => {
      live = false;
    };
  }, [repository]);

  const latest = data?.entries.at(-1)?.date;
  const shown = data?.entries.filter((e) => e.date === latest) ?? [];
  const itemName = (id: string) => data?.items.find((i) => i.id === id)?.name ?? id;

  return (
    <main className="app">
      {isDemo && <p className="banner">{t('demoBanner')}</p>}
      <header className="bar">
        <h1 className="title">PawLog</h1>
        <div className="lang" role="group" aria-label={t('langSwitch')}>
          {LANGS.map((l) => (
            <button key={l} type="button" className="lang-btn" aria-pressed={l === lang} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>
      {data && (
        <section className="card">
          <h2 className="heading">
            {data.dog.name}
            {latest && <span className="muted"> · {latest}</span>}
          </h2>
          <h3 className="caption">{t('latestEntries')}</h3>
          <ul className="list">
            {shown.map((e) => (
              <li key={e.id}>
                <span className="strong">{itemName(e.itemId)}</span>
                <span className="muted">
                  {' '}
                  {e.doseText} · {t(STATE_LABEL[e.state])}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {isDemo && (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            (repository as DemoRepository).reset();
            void fetchHome(repository).then(setData);
          }}
        >
          {t('demoReset')}
        </button>
      )}
    </main>
  );
}
