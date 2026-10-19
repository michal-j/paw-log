// Dev-only (JCB-86): the real app on the fictional stress log (tests/fixtures/stressLog.ts), fully
// client-side. Open http://localhost:<port>/stress.html?lanes=17 and resize to 320 to 1280. Never part of the build.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/tokens.css';
import '../../src/styles/global.css';
import { App } from '../../src/App';
import { I18nProvider } from '../../src/i18n';
import { StressRepository, layoutOf } from '../fixtures/stressLog';

// ?lanes=17 (default 17; 8 to 24) and ?foods=3 set the lane mix.
const params = new URLSearchParams(location.search);
const layout = layoutOf(Number(params.get('lanes') ?? 17), Number(params.get('foods') ?? 3));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App repository={new StressRepository(layout)} />
    </I18nProvider>
  </StrictMode>,
);
