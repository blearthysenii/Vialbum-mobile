import { usePresentationStyles, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { JourneyContext } from './types';
import { countryFlag } from './api';
import { journeyDateRange } from './completionDates';

export function JourneyCompletion({ visible, context, onOpen }: { visible: boolean; context: JourneyContext; onOpen: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const reduced = useReducedMotion();
  const dim = useRef(new Animated.Value(0)).current;
  const blur = useRef(new Animated.Value(0)).current;
  const content = useRef(new Animated.Value(0)).current;
  const route = useRef(new Animated.Value(0)).current;
  const arrow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let live = true;
    route.setValue(0); arrow.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(dim, { toValue: visible ? 1 : 0, duration: visible ? 350 : 180, useNativeDriver: true }),
      Animated.timing(blur, { toValue: visible ? 1 : 0, delay: visible && !reduced ? 100 : 0, duration: visible ? 400 : 180, useNativeDriver: true }),
      Animated.timing(content, { toValue: visible ? 1 : 0, delay: visible && !reduced ? 300 : 0, duration: visible ? 350 : 150, useNativeDriver: true }),
      Animated.timing(route, { toValue: visible ? 1 : 0, delay: visible && !reduced ? 600 : 0, duration: reduced ? 0 : 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(arrow, { toValue: visible ? 1 : 0, delay: visible && !reduced ? 650 : 0, duration: reduced ? 0 : 300, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (live && finished && visible && !reduced && context.stops.length > 1) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); });
    return () => { live = false; animation.stop(); };
  }, [visible, reduced, dim, blur, content, route, arrow, context.stops.length]);
  const stops = context.stops.length <= 7 ? context.stops : Array.from({ length: 7 }, (_, index) => context.stops[Math.round(index / 6 * (context.stops.length - 1))]);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} accessibilityElementsHidden={!visible}>
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: blur }]}><BlurView intensity={22} tint={presentationBlurTint("dark")} style={StyleSheet.absoluteFill} /></Animated.View>
    <Animated.View pointerEvents="none" style={[styles.dim, { opacity: dim }]} />
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[styles.center, { opacity: content }]}>
      <Text style={presentationTextStyle(styles.flag)}>{countryFlag(context.country_code ?? '')}</Text>
      <Text style={presentationTextStyle(styles.title)}>{context.title}</Text>
      <Text style={presentationTextStyle(styles.date)}>{journeyDateRange(context.start_date, context.end_date)}</Text>
      <Text style={presentationTextStyle(styles.stats)}>{context.days} {context.days === 1 ? 'day' : 'days'} · {context.place_count} {context.place_count === 1 ? 'place' : 'places'} · {context.moment_count} {context.moment_count === 1 ? 'moment' : 'moments'}</Text>
      {context.stops.length > 0 ? <View style={styles.route}>
        {context.stops.length > 1 ? <View style={styles.line}><Animated.View style={[styles.drawn, { width: route.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} /></View> : null}
        <View style={styles.stops}>{stops.map((stop, index) => <View key={stop.id} style={[styles.stop, context.stops.length === 1 ? { flex: 1 } : { position: 'absolute', left: `${index / (stops.length - 1) * 100}%`, marginLeft: -3 }]}>
          <Animated.View style={[styles.dot, { opacity: index === 0 ? content : route.interpolate({ inputRange: [Math.max(0, index / (stops.length - 1) - 0.06), index / (stops.length - 1)], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
        </View>)}</View>
        <View style={styles.labels}>{context.stops.length <= 3 ? context.stops.map(stop => <Text key={stop.id} numberOfLines={1} style={presentationTextStyle(styles.stopLabel)}>{stop.label}</Text>) : <><Text numberOfLines={1} style={presentationTextStyle(styles.stopLabel)}>{context.stops[0].label}</Text><Text numberOfLines={1} style={presentationTextStyle(styles.stopLabel)}>{context.stops[context.stops.length - 1].label}</Text></>}</View>
      </View> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="View completed journey" onPress={onOpen} style={styles.open}><Text style={presentationTextStyle(styles.action)}>View journey</Text><Animated.Text style={presentationTextStyle([styles.action, { transform: [{ translateX: arrow.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 4, 0] }) }] }])}>→</Animated.Text></Pressable>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.28)' }, center: { position: 'absolute', top: '30%', left: 32, right: 32, alignItems: 'center', gap: 14 }, flag: { fontSize: 24 }, title: { color: 'white', fontSize: 30, fontWeight: '600', textAlign: 'center' }, date: { color: 'rgba(255,255,255,0.82)', fontSize: 12, letterSpacing: 0.6, textAlign: 'center' }, stats: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center' }, route: { width: '80%', maxWidth: 300, marginVertical: 16 }, line: { position: 'absolute', top: 3, height: 1, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.16)' }, drawn: { height: 1, backgroundColor: 'rgba(255,255,255,0.75)' }, stops: { height: 7, alignItems: 'center' }, stop: { alignItems: 'center' }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'white' }, labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 10 }, stopLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, flexShrink: 1, maxWidth: '45%' }, open: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }, action: { color: 'white', fontSize: 14, fontWeight: '500' } });
const presentationBaselineStyles = styles;
