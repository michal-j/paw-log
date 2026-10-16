/** What the UI needs from sign-in. The Supabase implementation is in supabaseAuth.ts; tests use a fake. */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthService {
  /** Called with the restored session first (or null), then on every sign-in, sign-out and refresh. */
  subscribe(listener: (user: AuthUser | null) => void): () => void;
  /** E-mail and password of an account the CEO created. On success the session is stored and listeners hear about it. */
  signIn(email: string, password: string): Promise<void>;
  /** Forget the session on this device only. */
  signOut(): Promise<void>;
}

export type AuthFailureKind = 'invalid_email' | 'invalid_credentials' | 'rate_limited' | 'network' | 'unknown';

export class AuthFailure extends Error {
  constructor(
    readonly kind: AuthFailureKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
