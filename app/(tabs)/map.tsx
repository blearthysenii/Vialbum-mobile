import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';

export default function MapScreen() { return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.eyebrow}>PLACES</Text><Text style={styles.title}>Your world, remembered.</Text><View style={styles.map}><Text style={styles.pin}>⌖</Text><Text style={styles.copy}>Journey locations will gather here.</Text></View></View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { flex: 1, padding: 24 }, eyebrow: { marginTop: 20, fontSize: 11, letterSpacing: 2, fontWeight: '700', color: colors.accent }, title: { marginTop: 10, fontSize: 38, lineHeight: 42, fontWeight: '800', letterSpacing: -1.5, color: colors.ink }, map: { flex: 1, marginTop: 30, borderRadius: 30, backgroundColor: '#DDE2D8', alignItems: 'center', justifyContent: 'center' }, pin: { fontSize: 38, color: colors.ink }, copy: { marginTop: 12, color: colors.muted } });
