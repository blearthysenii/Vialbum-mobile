export const accountLinks = {
  privacy: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() || null,
  terms: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || null,
};

export function validPublicUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function canDeleteAccount(confirmation: string, password: string, pending: boolean) {
  return !pending && confirmation.trim() === 'DELETE' && password.length > 0;
}

export function accountDeletionError(error: unknown) {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number(error.status) : null;
  if (status === 0) return 'Vialbum could not be reached. Check your connection and try again.';
  if (status === 401) return 'Your current password is incorrect.';
  if (status === 503) return 'Private media cleanup is unavailable. Your account remains active; please try again.';
  return 'Your account could not be deleted. Your account remains active.';
}
