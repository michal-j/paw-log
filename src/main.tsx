import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/global.css';
import { createRepository, isDemoMode } from './data';
import { I18nProvider } from './i18n';
import { App } from './App';

registerSW({ immediate: true });

// The real app (sign-in, Supabase) is a separate chunk: the demo never loads it.
const RealApp = lazy(() => import('./auth/RealApp'));
const demo = isDemoMode();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      {demo ? (
        <App repository={createRepository(true)} />
      ) : (
        <Suspense fallback={null}>
          <RealApp />
        </Suspense>
      )}
    </I18nProvider>
  </StrictMode>,
);
