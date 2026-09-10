import { ApiError } from '@/api/client';

export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.status === 0) return error.message;
  if (error.code === 'USERNAME_TAKEN') return 'This username is already taken. Try another.';
  if (error.code === 'EMAIL_ALREADY_REGISTERED') return 'This email is already registered with Vialbum.';
  if (error.status === 409) return error.message;
  if (error.status === 401) return 'The email, username, or password is incorrect.';
  if (error.status === 422) return 'Please check your details and try again.';
  return 'Vialbum could not complete the request. Please try again.';
}
