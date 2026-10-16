import type { ReactNode } from 'react';
import { Brand } from '../components/Brand';
import { LangSwitch } from '../components/LangSwitch';
import './auth.css';

/** Frame for the screens before the timeline: sign-in, loading, setup messages. */
export function AuthShell({ children }: { children: ReactNode }) {
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
