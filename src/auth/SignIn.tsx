import { useState, type FormEvent } from 'react';
import { useI18n, type MessageKey } from '../i18n';
import {
  AuthFailure,
  CODE_LENGTH,
  cleanCode,
  isValidEmail,
  type AuthFailureKind,
  type AuthService,
} from './authService';
import { AuthShell } from './AuthShell';

type Problem = AuthFailureKind | 'code_format';

const PROBLEM_TEXT: Record<Problem, MessageKey> = {
  invalid_email: 'auth.errInvalidEmail',
  no_account: 'auth.errNoAccount',
  code_format: 'auth.errCodeFormat',
  invalid_code: 'auth.errBadCode',
  rate_limited: 'auth.errRateLimit',
  network: 'auth.errNetwork',
  unknown: 'auth.errUnknown',
};

const kindOf = (err: unknown): AuthFailureKind => (err instanceof AuthFailure ? err.kind : 'unknown');

/** Email, then the 6-digit code from the e-mail, then in. No password, no link. */
export function SignIn({ auth }: { auth: AuthService }) {
  const { t } = useI18n();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [resent, setResent] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    setResent(false);
    try {
      await action();
    } catch (err) {
      setProblem(kindOf(err));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e: FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return setProblem('invalid_email');
    void run(async () => {
      await auth.sendCode(email);
      setStep('code');
    });
  };

  const verify = (value: string) => {
    if (value.length !== CODE_LENGTH) return setProblem('code_format');
    // On success the auth listener swaps this screen for the app; nothing else to do here.
    void run(() => auth.verifyCode(email, value));
  };

  const resend = () =>
    void run(async () => {
      await auth.sendCode(email);
      setCode('');
      setResent(true);
    });

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setProblem(null);
    setResent(false);
  };

  const message = problem && (
    <p className="auth__error" role="alert">
      {t(PROBLEM_TEXT[problem])}
    </p>
  );

  return (
    <AuthShell>
      <section className="auth__card" aria-labelledby="auth-title">
        <h2 id="auth-title" className="auth__title">
          {t('auth.title')}
        </h2>
        {step === 'email' ? (
          <form onSubmit={sendCode} noValidate>
            <p className="auth__text">{t('auth.emailIntro')}</p>
            <label className="auth__label">
              {t('auth.emailLabel')}
              <input
                className="auth__input"
                type="email"
                name="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={problem === 'invalid_email' || problem === 'no_account'}
              />
            </label>
            {message}
            <button type="submit" className="auth__primary" disabled={busy}>
              {busy ? t('auth.sending') : t('auth.sendCode')}
            </button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verify(code);
            }}
            noValidate
          >
            <p className="auth__text">{t('auth.codeIntro').replace('{email}', email.trim())}</p>
            <label className="auth__label">
              {t('auth.codeLabel')}
              <input
                className="auth__input auth__input--code"
                type="text"
                name="code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={CODE_LENGTH + 2}
                autoFocus
                value={code}
                onChange={(e) => {
                  const next = cleanCode(e.target.value);
                  setCode(next);
                  // A pasted or autofilled code signs in straight away.
                  if (next.length === CODE_LENGTH && !busy) verify(next);
                }}
                aria-invalid={problem === 'invalid_code' || problem === 'code_format'}
              />
            </label>
            {message}
            {resent && (
              <p className="auth__info" role="status">
                {t('auth.resent')}
              </p>
            )}
            <button type="submit" className="auth__primary" disabled={busy}>
              {busy ? t('auth.checking') : t('auth.verify')}
            </button>
            <div className="auth__secondary">
              <button type="button" className="auth__ghost" onClick={resend} disabled={busy}>
                {t('auth.resend')}
              </button>
              <button type="button" className="auth__ghost" onClick={changeEmail} disabled={busy}>
                {t('auth.changeEmail')}
              </button>
            </div>
          </form>
        )}
      </section>
    </AuthShell>
  );
}
