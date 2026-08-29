import { ApiError } from '@/api/client';

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.status === 0) return error.message;
  if (error.status === 409) return 'An account with this email already exists.';
  if (error.status === 401) return 'The email or password is incorrect.';
  if (error.status === 422) return 'Please check your details and try again.';
  return 'Vialbum could not complete the request. Please try again.';
}
