import { darkPalette as p } from './palette';
// Google Maps honors customMapStyle; Apple Maps honors userInterfaceStyle.
// Preserve existing map marker and route colors.
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: p.canvas }] },
  { elementType: 'labels.text.fill', stylers: [{ color: p.muted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: p.canvas }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: p.surface }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: p.surface }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: p.control }] },
];
