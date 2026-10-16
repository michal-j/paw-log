import { Component, type ReactNode } from 'react';
import { useI18n } from '../i18n';

/**
 * Last line of defence: a rendering error shows a short message with Reload instead of a blank
 * screen (an installed iPhone app has no address bar to reload from).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    return this.state.failed ? <Crashed /> : this.props.children;
  }
}

function Crashed() {
  const { t } = useI18n();
  return (
    <main className="app">
      <div className="app-status" role="alert">
        <p className="app-status__text">{t('crashed')}</p>
        <button type="button" className="btn btn--primary btn--md" onClick={() => window.location.reload()}>
          {t('reloadApp')}
        </button>
      </div>
    </main>
  );
}
