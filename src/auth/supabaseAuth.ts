import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthFailure, normaliseEmail, type AuthFailureKind, type AuthService, type AuthUser } from './authService';

interface AuthErrorLike {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

/** Turn a Supabase auth error into one of the few cases the sign-in screen explains. */
export function classifyAuthError(error: AuthErrorLike): AuthFailureKind {
  const code = error.code ?? '';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  if (error.status === 429 || code.startsWith('over_')) return 'rate_limited';
  if (code === 'email_address_invalid') return 'invalid_email';
  // Wrong password and unknown e-mail look the same on purpose (Supabase does not say which).
  if (code === 'invalid_credentials' || code === 'user_not_found' || error.status === 400) return 'invalid_credentials';
  return 'unknown';
}

/**
 * E-mail + password sign-in for the two accounts the CEO created in the Supabase dashboard.
 * Sign-ups are disabled there, and the app has no sign-up or password-reset screen.
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

    async signIn(email, password) {
      const { error } = await client.auth.signInWithPassword({ email: normaliseEmail(email), password });
      if (error) throw new AuthFailure(classifyAuthError(error), error.message);
    },

    async signOut() {
      // 'local' ends this device's session only; the other member's phone stays signed in.
      await client.auth.signOut({ scope: 'local' });
    },
  };
}
