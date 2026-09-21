import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from './types';

export type SavedAccount = Pick<AuthUser, 'id' | 'email' | 'username' | 'first_name' | 'last_name' | 'profile_photo_url'>;
const KEY = 'vialbum.saved_accounts.v1';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const sessionKey = (id: string) => `vialbum.saved_session.${encodeURIComponent(id).replace(/%/g, '_')}`;
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.then(operation);
  queue = result.catch(() => undefined);
  return result;
}
function profile(user: SavedAccount): SavedAccount {
  return { id: user.id, email: user.email, username: user.username, first_name: user.first_name,
    last_name: user.last_name, profile_photo_url: user.profile_photo_url };
}
async function list(): Promise<SavedAccount[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return [];
  const data: unknown = JSON.parse(raw);
  if (!Array.isArray(data) || !data.every((item) => item &&
    ['id', 'email', 'username', 'first_name', 'last_name'].every((key) => typeof item[key] === 'string') &&
    (item.profile_photo_url === null || typeof item.profile_photo_url === 'string'))) {
    throw new Error('Saved accounts could not be read.');
  }
  return data.map(profile);
}
export const savedAccountStorage = {
  list,
  token: (id: string) => SecureStore.getItemAsync(sessionKey(id)),
  forgetSession: (id: string) => serialize(() => SecureStore.deleteItemAsync(sessionKey(id))),
  save: (user: SavedAccount, token: string) => serialize(async () => {
    const accounts = await list();
    // Write metadata first: a failed token write can only require password login.
    await SecureStore.setItemAsync(KEY, JSON.stringify([profile(user), ...accounts.filter((a) => a.id !== user.id)]), options);
    await SecureStore.setItemAsync(sessionKey(user.id), token, options);
  }),
  remove: (id: string) => serialize(async () => {
    const accounts = await list();
    await SecureStore.deleteItemAsync(sessionKey(id));
    await SecureStore.setItemAsync(KEY, JSON.stringify(accounts.filter((a) => a.id !== id)), options);
  }),
};
