import { useState, type FormEvent } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import { AuthFailure, isValidEmail, type AuthFailureKind, type AuthService } from './authService';
import { AuthShell } from './AuthShell';

type Problem = AuthFailureKind | 'missing_password';

const PROBLEM_TEXT: Record<Problem, MessageKey> = {
  invalid_email: 'auth.errInvalidEmail',
  missing_password: 'auth.errMissingPassword',
  invalid_credentials: 'auth.errBadCredentials',
  rate_limited: 'auth.errRateLimit',
  network: 'auth.errNetwork',
  unknown: 'auth.errUnknown',
};

/**
 * E-mail and password, one screen. The autocomplete attributes let iPhone Keychain offer and save
 * the login. No sign-up and no password reset here: the CEO manages both accounts in Supabase.
 */
export function SignIn({ auth }: { auth: AuthService }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setProblem('invalid_email');
    if (!password) return setProblem('missing_password');
    setBusy(true);
    setProblem(null);
    try {
      // On success the auth listener swaps this screen for the app.
      await auth.signIn(email, password);
    } catch (err) {
      setProblem(err instanceof AuthFailure ? err.kind : 'unknown');
    } finally {
      setBusy(false);
    }
  };

  const emailInvalid = problem === 'invalid_email' || problem === 'invalid_credentials';
  const passwordInvalid = problem === 'missing_password' || problem === 'invalid_credentials';

  return (
    <AuthShell>
      <section className="auth__card" aria-labelledby="auth-title">
        <h2 id="auth-title" className="auth__title">
          {t('auth.title')}
        </h2>
        <form onSubmit={submit} noValidate>
          <p className="auth__text">{t('auth.intro')}</p>
          <label className="auth__label">
            {t('auth.emailLabel')}
            <input
              className="auth__input"
              type="email"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailInvalid}
            />
          </label>
          <label className="auth__label" htmlFor="auth-password">
            {t('auth.passwordLabel')}
          </label>
          <div className="auth__password">
            <input
              id="auth-password"
              className="auth__input auth__input--password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={passwordInvalid}
            />
            <button
              type="button"
              className="auth__toggle"
              aria-label={t('auth.showPassword')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? t('auth.hide') : t('auth.show')}
            </button>
          </div>
          {problem && (
            <p className="auth__error" role="alert">
              {t(PROBLEM_TEXT[problem])}
            </p>
          )}
          <button type="submit" className="auth__primary" disabled={busy}>
            {busy ? t('auth.signingIn') : t('auth.signIn')}
          </button>
          <p className="auth__hint">{t('auth.forgot')}</p>
        </form>
      </section>
    </AuthShell>
  );
}
