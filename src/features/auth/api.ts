import { apiRequest } from '@/api/client';
import type { AccessToken, AuthUser, SignUpInput } from '@/features/auth/types';

export const authApi = {
  register: (input: SignUpInput) =>
    apiRequest<AuthUser>('/auth/register', { method: 'POST', body: input }),
  login: (email: string, password: string) =>
    apiRequest<AccessToken>('/auth/login', { method: 'POST', body: { email, password } }),
  me: (token: string) => apiRequest<AuthUser>('/auth/me', { token }),
  deleteAccount: (password: string) => apiRequest<void>('/auth/account', {
    method: 'DELETE', authenticated: true, body: { confirmation: 'DELETE', password },
  }),
};
