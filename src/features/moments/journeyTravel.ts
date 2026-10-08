import type { Moment } from './types';
export function travelDistance(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  if (![a.latitude, a.longitude, b.latitude, b.longitude].every(Number.isFinite) || Math.abs(a.latitude) > 90 || Math.abs(b.latitude) > 90 || Math.abs(a.longitude) > 180 || Math.abs(b.longitude) > 180) return null;
  const rad = (value: number) => value * Math.PI / 180;
  const value = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, value)));
}
export function journeyTransition(previous: Moment | undefined, current: Moment | undefined) {
  if (!previous || !current || !current.journey_id || previous.journey_id !== current.journey_id) return null;
  const context = current.journey_context;
  const from = previous.journey_context?.stops.find(stop => stop.id === previous.journey_context?.current_stop_id);
  const to = context?.stops.find(stop => stop.id === context.current_stop_id);
  if (!from || !to || from.id === to.id) return null;
  const distance = travelDistance(from, to);
  if (distance !== null && distance < 0.2) return null;
  return { from, to, distance, stops: context!.stops };
}
