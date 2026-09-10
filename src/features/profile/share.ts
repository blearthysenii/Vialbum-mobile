import { Share } from 'react-native';

// TODO: Replace this app route with the public Vialbum profile deep link once one is configured.
export function profileShareMessage(username: string) {
  return `Find @${username} on Vialbum.`;
}

export function shareProfile(username: string) {
  return Share.share({ message: profileShareMessage(username) });
}
