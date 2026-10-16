import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './styles/tokens.css';
import './styles/global.css';
import { createRepository } from './data';
import { I18nProvider } from './i18n';
import { App } from './App';

registerSW({ immediate: true });

const repository = createRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App repository={repository} />
    </I18nProvider>
  </StrictMode>,
);
