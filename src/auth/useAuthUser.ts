import { useEffect, useState } from 'react';
import type { AuthService, AuthUser } from './authService';

/** `undefined` while the stored session is being restored, then the user or null. */
export function useAuthUser(auth: AuthService): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => auth.subscribe(setUser), [auth]);
  return user;
}
