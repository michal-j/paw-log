/** What the UI needs from sign-in. The Supabase implementation is in supabaseAuth.ts; tests use a fake. */
export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthService {
  /** Called with the restored session first (or null), then on every sign-in, sign-out and refresh. */
  subscribe(listener: (user: AuthUser | null) => void): () => void;
  /** E-mail a one-time code to an existing account. Never creates an account. */
  sendCode(email: string): Promise<void>;
  /** Check the code; on success the session is stored and `subscribe` listeners hear about it. */
  verifyCode(email: string, code: string): Promise<void>;
  /** Forget the session on this device only. */
  signOut(): Promise<void>;
}

export type AuthFailureKind = 'invalid_email' | 'no_account' | 'invalid_code' | 'rate_limited' | 'network' | 'unknown';

export class AuthFailure extends Error {
  constructor(
    readonly kind: AuthFailureKind,
    message: string = kind,
  ) {
    super(message);
    this.name = 'AuthFailure';
  }
}

export const CODE_LENGTH = 6;

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
/** Keep digits only (pasted codes often carry spaces) and cap at the code length. */
export const cleanCode = (code: string) => code.replace(/\D/g, '').slice(0, CODE_LENGTH);
