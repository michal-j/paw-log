import { useCallback, useEffect, useMemo, useState } from 'react';
import { App } from '../App';
import { NoDogError, type Repository } from '../data';
import { useI18n } from '../i18n';
import type { AuthService, AuthUser } from './authService';
import { AuthShell } from './AuthShell';
import { SignIn } from './SignIn';
import { useAuthUser } from './useAuthUser';

interface Props {
  auth: AuthService;
  /** A fresh repository per signed-in user, so nothing cached survives a sign-out. */
  createRepository: (user: AuthUser) => Repository;
  /** Asks before signing out; replaceable in tests. */
  confirm?: (message: string) => boolean;
}

/** Real (non-demo) app: restore the session, sign in if needed, then show the timeline. */
export function AuthGate({ auth, createRepository, confirm = (m) => window.confirm(m) }: Props) {
  const { t } = useI18n();
  const user = useAuthUser(auth);
  const userId = user?.id;
  // Keyed on the user id only: token refreshes re-emit the same user and must not reload the data.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const repository = useMemo(() => (user ? createRepository(user) : null), [userId, createRepository]);
  const signOut = useCallback(() => {
    if (confirm(t('auth.signOutConfirm'))) void auth.signOut();
  }, [auth, confirm, t]);

  if (user === undefined) return <Loading />;
  if (!user || !repository) return <SignIn auth={auth} />;
  return <SignedIn key={user.id} repository={repository} onSignOut={signOut} />;
}

function Loading() {
  const { t } = useI18n();
  return (
    <AuthShell loading>
      <p className="auth__text auth__loading" role="status">
        {t('auth.loading')}
      </p>
    </AuthShell>
  );
}

/** Checks the account can see a dog before showing the timeline, so a missing bootstrap is explained, not an empty screen. */
function SignedIn({ repository, onSignOut }: { repository: Repository; onSignOut: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<'checking' | 'ready' | 'no-dog'>('checking');

  useEffect(() => {
    let live = true;
    repository.getDog().then(
      () => live && setState('ready'),
      // Other failures (offline, server) fall through to the timeline, which shows what it can.
      (err: unknown) => live && setState(err instanceof NoDogError ? 'no-dog' : 'ready'),
    );
    return () => {
      live = false;
    };
  }, [repository]);

  if (state === 'checking') return <Loading />;
  if (state === 'ready') return <App repository={repository} onSignOut={onSignOut} />;
  return (
    <AuthShell>
      <section className="auth__card">
        <p className="auth__text">{t('auth.noHousehold')}</p>
        <button type="button" className="auth__ghost auth__ghost--wide" onClick={onSignOut}>
          {t('auth.signOut')}
        </button>
      </section>
    </AuthShell>
  );
}
