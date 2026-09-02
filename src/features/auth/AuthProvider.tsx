import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setUnauthorizedHandler } from '@/api/client';
import { authApi } from '@/features/auth/api';
import { tokenStorage } from '@/features/auth/storage';
import { clearPrivateLocalData } from '@/features/auth/cleanup';
import type { AuthUser, SignUpInput } from '@/features/auth/types';

type AuthContextValue = {
  user: AuthUser | null;
  isRestoring: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const establishSession = useCallback(async (email: string, password: string) => {
    const token = await authApi.login(email.trim(), password);
    await tokenStorage.set(token.access_token);
    try {
      setUser(await authApi.me(token.access_token));
    } catch (error) {
      await tokenStorage.remove();
      throw error;
    }
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => establishSession(email, password),
    [establishSession],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      await authApi.register({ ...input, email: input.email.trim() });
      await establishSession(input.email, input.password);
    },
    [establishSession],
  );

  const signOut = useCallback(async () => {
    await tokenStorage.remove();
    await clearPrivateLocalData();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async (password: string) => {
    await authApi.deleteAccount(password);
    await tokenStorage.remove();
    await clearPrivateLocalData();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const token = await tokenStorage.get();
        if (!token) return;
        const restoredUser = await authApi.me(token);
        if (active) setUser(restoredUser);
      } catch {
        await tokenStorage.remove();
      } finally {
        if (active) setIsRestoring(false);
      }
    }
    void restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({ user, isRestoring, signIn, signUp, signOut, deleteAccount }),
    [deleteAccount, isRestoring, signIn, signOut, signUp, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
