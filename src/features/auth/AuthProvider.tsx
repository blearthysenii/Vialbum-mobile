import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, setUnauthorizedHandler } from '@/api/client';
import { authApi } from '@/features/auth/api';
import { tokenStorage } from '@/features/auth/storage';
import { clearPrivateLocalData } from '@/features/auth/cleanup';
import type { AuthUser, ProfileUpdateInput, SignUpInput } from '@/features/auth/types';

import { savedAccountStorage, type SavedAccount } from './savedAccounts';

type AuthContextValue = {
  user: AuthUser | null;
  isRestoring: boolean;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  savedAccounts: SavedAccount[];
  savedAccountsError: string | null;
  activeAccount: AuthUser | null;
  reloadSavedAccounts: () => Promise<void>;
  removeSavedAccount: (id: string) => Promise<void>;
  quickSignIn: (id: string) => Promise<boolean>;
  signOut: (saveAccount?: boolean) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  updateProfile: (input: ProfileUpdateInput) => Promise<AuthUser>;
  refreshUser: () => Promise<void>;
  applyProfile: (updated: AuthUser) => void;
  removeProfileCover: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const sessionVersion = useRef(0);
  const profileRevision = useRef(0);
  const userRequest = useRef<{ session: number; revision: number; promise: Promise<void> } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [savedAccountsError, setSavedAccountsError] = useState<string | null>(null);
  const reloadSavedAccounts = useCallback(async () => {
    try {
      setSavedAccounts(await savedAccountStorage.list());
      setSavedAccountsError(null);
    } catch {
      setSavedAccountsError('Saved accounts could not be loaded. Please try again.');
    }
  }, []);
  const removeSavedAccount = useCallback(async (id: string) => {
    await savedAccountStorage.remove(id);
    await reloadSavedAccounts();
  }, [reloadSavedAccounts]);
  const quickSignIn = useCallback(async (id: string) => {
    const token = await savedAccountStorage.token(id);
    if (!token) return false;
    let restored: AuthUser;
    try {
      restored = await authApi.me(token);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await savedAccountStorage.forgetSession(id);
        return false;
      }
      throw error;
    }
    if (restored.id !== id) {
      await savedAccountStorage.forgetSession(id);
      return false;
    }
    sessionVersion.current++;
    await clearPrivateLocalData();
    await tokenStorage.set(token);
    setUser(restored);
    return true;
  }, []);

  const establishSession = useCallback(async (identifier: string, password: string) => {
    sessionVersion.current++;
    await clearPrivateLocalData();
    const token = await authApi.login(identifier.trim().toLowerCase(), password);
    await tokenStorage.set(token.access_token);
    try {
      setUser(await authApi.me(token.access_token));
    } catch (error) {
      await tokenStorage.remove();
      throw error;
    }
  }, []);

  const signIn = useCallback(
    async (identifier: string, password: string) => establishSession(identifier, password),
    [establishSession],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      await authApi.register({ ...input, email: input.email.trim() });
      await establishSession(input.email, input.password);
    },
    [establishSession],
  );

  const signOut = useCallback(async (saveAccount = false) => {
    sessionVersion.current += 1;
    if (user) {
      if (saveAccount) {
        const token = await tokenStorage.get();
        if (!token) throw new Error('Session unavailable. Choose Don’t Save to sign out.');
        await savedAccountStorage.save(user, token);
      } else {
        // Revoking quick access is required; broken card metadata must not block logout.
        await savedAccountStorage.forgetSession(user.id);
        try { await savedAccountStorage.remove(user.id); } catch {
          setSavedAccountsError('Account details could not be removed. Quick login has been disabled.');
        }
      }
      await reloadSavedAccounts();
    }
    await tokenStorage.remove();
    await clearPrivateLocalData();
    setUser(null);
  }, [reloadSavedAccounts, user]);

  const deleteAccount = useCallback(async (password: string) => {
    sessionVersion.current += 1;
    // Remove remembered credentials before deleting the server account.
    if (user) await removeSavedAccount(user.id);
    await authApi.deleteAccount(password);
    await tokenStorage.remove();
    await clearPrivateLocalData();
    setUser(null);
  }, [removeSavedAccount, user]);

  const updateProfile = useCallback(async (input: ProfileUpdateInput) => {
    const version = sessionVersion.current;
    const revision = ++profileRevision.current;
    userRequest.current = null;
    const updated = await authApi.updateProfile(input);
    if (version === sessionVersion.current && revision === profileRevision.current) {
      profileRevision.current++;
      userRequest.current = null;
      setUser(current => JSON.stringify(current) === JSON.stringify(updated) ? current : updated);
    }
    return updated;
  }, []);

  const removeProfileCover = useCallback(async () => {
    const version = sessionVersion.current;
    const revision = ++profileRevision.current;
    userRequest.current = null;
    await authApi.removeProfileCover();
    if (version !== sessionVersion.current || revision !== profileRevision.current) return;
    // Reject profile responses started before deletion, including pull refreshes.
    sessionVersion.current += 1;
    setUser(current => current ? { ...current, profile_cover_url: null } : current);
  }, []);

  const applyProfile = useCallback((updated: AuthUser) => {
    profileRevision.current++;
    userRequest.current = null;
    setUser(current => current?.id === updated.id ? (JSON.stringify(current) === JSON.stringify(updated) ? current : updated) : current);
  }, []);

  const refreshUser = useCallback(() => {
    const version = sessionVersion.current;
    const revision = profileRevision.current;
    if (userRequest.current?.session === version && userRequest.current.revision === revision) return userRequest.current.promise;
    if (__DEV__) console.debug('[Profile lifecycle] request', 'auth/me', 'explicit');
    const promise = authApi.me().then(updated => {
      if (version === sessionVersion.current && revision === profileRevision.current) setUser(current => JSON.stringify(current) === JSON.stringify(updated) ? current : updated);
    }).finally(() => { if (userRequest.current?.promise === promise) userRequest.current = null; });
    userRequest.current = { session: version, revision, promise };
    return promise;
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { sessionVersion.current += 1; setUser(null); void clearPrivateLocalData(); });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        await reloadSavedAccounts();
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
  }, [reloadSavedAccounts]);

  const value = useMemo(
    () => ({ user, activeAccount: user, savedAccounts, savedAccountsError, reloadSavedAccounts, removeSavedAccount, quickSignIn, isRestoring, signIn, signUp, signOut, deleteAccount, updateProfile, refreshUser, removeProfileCover, applyProfile }),
    [applyProfile, removeProfileCover, savedAccounts, savedAccountsError, reloadSavedAccounts, removeSavedAccount, quickSignIn, deleteAccount, isRestoring, refreshUser, signIn, signOut, signUp, updateProfile, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
