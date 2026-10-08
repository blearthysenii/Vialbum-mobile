import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Moment } from './types';
import { journeyTransition } from './journeyTravel';

export function JourneyTravelOverlay({ item, visible, blocked }: { item: Moment | undefined; visible: boolean; blocked: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const itemRef = useRef(item); itemRef.current = item;
  const previous = useRef<Moment | undefined>(undefined);
  const [transition, setTransition] = useState<ReturnType<typeof journeyTransition>>(null);
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const item = itemRef.current;
    if (!visible || !item) { previous.current = undefined; setTransition(null); return; }
    const next = journeyTransition(previous.current, item);
    previous.current = item;
    setTransition(next);
    if (!next) return;
    opacity.setValue(0); motion.setValue(0);
    const entrance = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 110, useNativeDriver: true }),
      Animated.timing(motion, { toValue: 1, duration: reduced ? 0 : 400, useNativeDriver: true }),
    ]);
    entrance.start();
    const timer = setTimeout(() => { Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => { setTransition(null); }); }, 480);
    return () => { clearTimeout(timer); entrance.stop(); opacity.stopAnimation(); motion.stopAnimation(); };
  // Travel context is triggered by a new item, not signed URL refreshes or playback ticks.
  }, [item?.id, visible, reduced, opacity, motion]);
  if (!transition || blocked) return null;
  return <Animated.View pointerEvents="none" style={[styles.position, { opacity }]}>
    <View style={styles.glass}><BlurView intensity={48} tint={presentationBlurTint("systemThinMaterialDark")} style={StyleSheet.absoluteFill} />
      {transition ? <><View style={styles.travel}><Text numberOfLines={1} style={presentationTextStyle(styles.label)}>{transition.from.label}</Text><Animated.View style={{ transform: [{ translateX: reduced ? 0 : motion.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] }) }] }}><Ionicons name="airplane" color={resolvePresentationColor("white", 'color', 'content')} size={17} /></Animated.View><Text numberOfLines={1} style={presentationTextStyle(styles.label)}>{transition.to.label}</Text></View>
        {transition.distance !== null ? <Text style={presentationTextStyle(styles.secondary)}>{transition.distance < 1 ? `${Math.round(transition.distance * 1000)} m` : `${Math.round(transition.distance)} km`}</Text> : null}
        <View style={styles.pulse}>{transition.stops.slice(Math.max(0, transition.stops.findIndex(stop => stop.id === transition.to.id) - 1), transition.stops.findIndex(stop => stop.id === transition.to.id) + 2).map(stop => <View key={stop.id} style={styles.pulseStop}><View style={[styles.dot, { opacity: stop.id === transition.to.id ? 1 : 0.35 }]} /><Text numberOfLines={1} style={presentationTextStyle([styles.pulseLabel, { opacity: stop.id === transition.to.id ? 1 : 0.6 }])}>{stop.label}</Text></View>)}</View>
      </> : null}
    </View>
  </Animated.View>;
}
const styles = StyleSheet.create({ position: { position: 'absolute', top: '29%', left: 28, right: 28, alignItems: 'center' }, glass: { maxWidth: 360, width: '100%', alignItems: 'center', gap: 9, padding: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(10,10,14,0.22)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' }, travel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }, label: { color: 'white', fontSize: 14, fontWeight: '600', flexShrink: 1 }, secondary: { color: 'rgba(255,255,255,0.75)', fontSize: 11 }, pulse: { flexDirection: 'row', gap: 14 }, pulseStop: { flex: 1, alignItems: 'center', gap: 5 }, dot: { width: 5, height: 5, backgroundColor: 'white', borderRadius: 3 }, pulseLabel: { color: 'white', fontSize: 10 } });
const presentationBaselineStyles = styles;
