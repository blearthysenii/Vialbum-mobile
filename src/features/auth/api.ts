import { apiRequest, apiUpload } from '@/api/client';
import type { AccessToken, AuthUser, ProfileUpdateInput, SignUpInput } from '@/features/auth/types';

export const authApi = {
  register: (input: SignUpInput) =>
    apiRequest<AuthUser>('/auth/register', { method: 'POST', body: input }),
  emailExists: (email: string) =>
    apiRequest<{ exists: boolean }>('/auth/email-exists', { method: 'POST', body: { email } }),
  usernameExists: (username: string) =>
    apiRequest<{ exists: boolean }>('/auth/username-exists', { method: 'POST', body: { username } }),
  accountExists: (identifier: string) =>
    apiRequest<{ exists: boolean }>('/auth/account-exists', { method: 'POST', body: { identifier } }),
  login: (identifier: string, password: string) =>
    apiRequest<AccessToken>('/auth/login', { method: 'POST', body: { identifier, password } }),
  me: (token?: string) => apiRequest<AuthUser>('/auth/me', token ? { token } : { authenticated: true }),
  updateProfile: (body: ProfileUpdateInput) => apiRequest<AuthUser>('/users/me', { method: 'PATCH', body, authenticated: true }),
  uploadProfilePhoto: (file: { uri: string; name: string; type: string }, onProgress: (value: number) => void) => apiUpload<AuthUser>('/users/me/profile-photo', file, {}, onProgress),
  removeProfilePhoto: () => apiRequest<void>('/users/me/profile-photo', { method: 'DELETE', authenticated: true }),
  deleteAccount: (password: string) => apiRequest<void>('/auth/account', {
    method: 'DELETE', authenticated: true, body: { confirmation: 'DELETE', password },
  }),
};
