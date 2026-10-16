import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthFailure, normaliseEmail, type AuthFailureKind, type AuthService, type AuthUser } from './authService';

interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

/** Turn a Supabase auth error into one of the few cases the sign-in screen explains. */
export function classifyAuthError(error: AuthErrorLike, step: 'send' | 'verify'): AuthFailureKind {
  const code = error.code ?? '';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  if (error.status === 429 || code.startsWith('over_')) return 'rate_limited';
  if (code === 'email_address_invalid') return 'invalid_email';
  if (step === 'send' && ['otp_disabled', 'signup_disabled', 'user_not_found'].includes(code)) return 'no_account';
  if (step === 'verify' && (code === 'otp_expired' || code === 'invalid_credentials' || error.status === 403)) {
    return 'invalid_code';
  }
  return 'unknown';
}

const fail = (error: AuthErrorLike, step: 'send' | 'verify') =>
  new AuthFailure(classifyAuthError(error, step), error.message);

/**
 * Email + one-time code sign-in. No magic link: a link opens Safari, not the installed iPhone PWA.
 * `shouldCreateUser: false` means only accounts the CEO created can sign in.
 */
export function createSupabaseAuth(client: SupabaseClient): AuthService {
  return {
    subscribe(listener) {
      // Fires INITIAL_SESSION with the session restored from storage, then every change.
      // Keep the callback synchronous: calling other auth methods inside it can deadlock supabase-js.
      const { data } = client.auth.onAuthStateChange((_event, session) => {
        const user = session?.user;
        listener(user ? ({ id: user.id, email: user.email ?? '' } satisfies AuthUser) : null);
      });
      return () => data.subscription.unsubscribe();
    },

    async sendCode(email) {
      const { error } = await client.auth.signInWithOtp({
        email: normaliseEmail(email),
        options: { shouldCreateUser: false },
      });
      if (error) throw fail(error, 'send');
    },

    async verifyCode(email, code) {
      const { error } = await client.auth.verifyOtp({ email: normaliseEmail(email), token: code, type: 'email' });
      if (error) throw fail(error, 'verify');
    },

    async signOut() {
      // 'local' ends this device's session only; the other member's phone stays signed in.
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
