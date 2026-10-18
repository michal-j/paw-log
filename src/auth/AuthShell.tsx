import { useEffect, type ReactNode } from 'react';
import { Brand } from '../components/Brand';
import { LangSwitch } from '../components/LangSwitch';
import { dismissLaunch } from '../launch';
import './auth.css';

/**
 * Frame for the screens before the timeline: sign-in, loading, setup messages.
 * Every screen but the loading one is final, so the launch cover (JCB-82) goes when it shows.
 */
export function AuthShell({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  useEffect(() => {
    if (!loading) dismissLaunch();
  }, [loading]);
  return (
    <main className="app">
      <header className="bar">
        <Brand />
        <LangSwitch />
      </header>
      <div className="auth">{children}</div>
    </main>
  );
}
