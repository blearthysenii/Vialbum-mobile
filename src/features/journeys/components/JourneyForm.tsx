import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';

import { JourneyLocationPicker } from '@/features/journeys/components/JourneyLocationPicker';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ApiError } from '@/api/client';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import type { JourneyInput } from '@/features/journeys/types';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates } from '@/utils/format';

export type JourneyFormValues = Omit<JourneyInput, 'cover_media_url'>;
type DateField = 'start_date' | 'end_date';

const toDate = (value: string) => new Date(`${value}T12:00:00`);
const toApiDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const displayDate = (value: string) => formatCalendarDate(value, { month: 'long', day: 'numeric', year: 'numeric' });

type CountryOption = {
  code: string;
  name: string;
};

const COUNTRIES: CountryOption[] = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AD', name: 'Andorra' },
  { code: 'AO', name: 'Angola' },
  { code: 'AG', name: 'Antigua and Barbuda' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AM', name: 'Armenia' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'AZ', name: 'Azerbaijan' },
  { code: 'BS', name: 'Bahamas' },
  { code: 'BH', name: 'Bahrain' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BB', name: 'Barbados' },
  { code: 'BY', name: 'Belarus' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BZ', name: 'Belize' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BT', name: 'Bhutan' },
  { code: 'BO', name: 'Bolivia' },
  { code: 'BA', name: 'Bosnia and Herzegovina' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BN', name: 'Brunei' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'KH', name: 'Cambodia' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CA', name: 'Canada' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Congo, Democratic Republic of the' },
  { code: 'CR', name: 'Costa Rica' },
  { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'HR', name: 'Croatia' },
  { code: 'CU', name: 'Cuba' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'DM', name: 'Dominica' },
  { code: 'DO', name: 'Dominican Republic' },
  { code: 'EC', name: 'Ecuador' },
  { code: 'EG', name: 'Egypt' },
  { code: 'SV', name: 'El Salvador' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'EE', name: 'Estonia' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'FJ', name: 'Fiji' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GE', name: 'Georgia' },
  { code: 'DE', name: 'Germany' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GR', name: 'Greece' },
  { code: 'GD', name: 'Grenada' },
  { code: 'GT', name: 'Guatemala' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'GY', name: 'Guyana' },
  { code: 'HT', name: 'Haiti' },
  { code: 'HN', name: 'Honduras' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JM', name: 'Jamaica' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KZ', name: 'Kazakhstan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KI', name: 'Kiribati' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'KG', name: 'Kyrgyzstan' },
  { code: 'LA', name: 'Laos' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MV', name: 'Maldives' },
  { code: 'ML', name: 'Mali' },
  { code: 'MT', name: 'Malta' },
  { code: 'MH', name: 'Marshall Islands' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MX', name: 'Mexico' },
  { code: 'FM', name: 'Micronesia' },
  { code: 'MD', name: 'Moldova' },
  { code: 'MC', name: 'Monaco' },
  { code: 'MN', name: 'Mongolia' },
  { code: 'ME', name: 'Montenegro' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'MM', name: 'Myanmar' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NR', name: 'Nauru' },
  { code: 'NP', name: 'Nepal' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NI', name: 'Nicaragua' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'KP', name: 'North Korea' },
  { code: 'MK', name: 'North Macedonia' },
  { code: 'NO', name: 'Norway' },
  { code: 'OM', name: 'Oman' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PW', name: 'Palau' },
  { code: 'PS', name: 'Palestine' },
  { code: 'PA', name: 'Panama' },
  { code: 'PG', name: 'Papua New Guinea' },
  { code: 'PY', name: 'Paraguay' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'KN', name: 'Saint Kitts and Nevis' },
  { code: 'LC', name: 'Saint Lucia' },
  { code: 'VC', name: 'Saint Vincent and the Grenadines' },
  { code: 'WS', name: 'Samoa' },
  { code: 'SM', name: 'San Marino' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SN', name: 'Senegal' },
  { code: 'RS', name: 'Serbia' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SG', name: 'Singapore' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SB', name: 'Solomon Islands' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'ES', name: 'Spain' },
  { code: 'LK', name: 'Sri Lanka' },
  { code: 'SD', name: 'Sudan' },
  { code: 'SR', name: 'Suriname' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SY', name: 'Syria' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TJ', name: 'Tajikistan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TL', name: 'Timor-Leste' },
  { code: 'TG', name: 'Togo' },
  { code: 'TO', name: 'Tonga' },
  { code: 'TT', name: 'Trinidad and Tobago' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'TR', name: 'Türkiye' },
  { code: 'TM', name: 'Turkmenistan' },
  { code: 'TV', name: 'Tuvalu' },
  { code: 'UG', name: 'Uganda' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'UY', name: 'Uruguay' },
  { code: 'UZ', name: 'Uzbekistan' },
  { code: 'VU', name: 'Vanuatu' },
  { code: 'VA', name: 'Vatican City' },
  { code: 'VE', name: 'Venezuela' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'YE', name: 'Yemen' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
  { code: 'XK', name: 'Kosovo' },
];

const flagEmoji = (countryCode: string) =>
  countryCode
    .toUpperCase()
    .replace(/./g, (character) => String.fromCodePoint(127397 + character.charCodeAt(0)));

export function JourneyForm({ embedded = false, eyebrow, heading, submitLabel, initialValues, onSubmit, onCancel }: { embedded?: boolean; eyebrow: string; heading: string; submitLabel: string; initialValues: JourneyFormValues; onSubmit: (values: JourneyFormValues) => Promise<void>; onCancel?: () => void }) {
  const tabBarScroll = useTabBarScroll();
  const scrollRef = useRef<ScrollView>(null);
  const descriptionRef = useRef<View>(null);
  const scrollOffset = useRef(0);
  const keyboardTop = useRef(Number.POSITIVE_INFINITY);
  const descriptionFocused = useRef(false);
  const [values, setValues] = useState(initialValues);
  const [activeDate, setActiveDate] = useState<DateField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const selectedCountry = COUNTRIES.find((country) => country.name === values.country) ?? null;
  const filteredCountries = COUNTRIES.filter((country) =>
    country.name.toLowerCase().includes(countrySearch.trim().toLowerCase()),
  );

  const fieldGroupScale = useSharedValue(1);
  const fieldGroupShake = useSharedValue(0);
  const locationScale = useSharedValue(1);
  const dateShake = useSharedValue(0);
  const descriptionScale = useSharedValue(1);
  const createScale = useSharedValue(1);

  const fieldGroupAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: fieldGroupShake.value },
      { scale: fieldGroupScale.value },
    ],
  }));

  const locationAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: locationScale.value }],
  }));

  const dateAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dateShake.value }],
  }));

  const descriptionAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: descriptionScale.value }],
  }));

  const createAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createScale.value }],
  }));

  const update = (field: keyof JourneyFormValues) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  const alignDescriptionAboveKeyboard = useCallback(() => {
    requestAnimationFrame(() => {
      descriptionRef.current?.measureInWindow((_x, y, _width, height) => {
        if (!Number.isFinite(keyboardTop.current)) return;

        // Keep a small native-looking breathing space between the field and keyboard.
        const gap = 10;
        const descriptionBottom = y + height;
        const hiddenBy = descriptionBottom + gap - keyboardTop.current;

        if (hiddenBy > 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollOffset.current + hiddenBy),
            animated: true,
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const willShow = Keyboard.addListener('keyboardWillShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;

      if (descriptionFocused.current) {
        // iOS animates the ScrollView inset with the keyboard. Align after that
        // animation has started so the field lands just above the keyboard.
        setTimeout(alignDescriptionAboveKeyboard, 70);
      }
    });

    const willChangeFrame = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;
    });

    const didShow = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTop.current = event.endCoordinates.screenY;

      if (descriptionFocused.current) {
        setTimeout(alignDescriptionAboveKeyboard, 16);
      }
    });

    const didHide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = Number.POSITIVE_INFINITY;
    });

    return () => {
      willShow.remove();
      willChangeFrame.remove();
      didShow.remove();
      didHide.remove();
    };
  }, [alignDescriptionAboveKeyboard]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    tabBarScroll.onScroll(event);
  };

  function changeDate(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setActiveDate(null);
    if (event.type === 'dismissed' || !date || !activeDate) return;
    setValues((current) => ({ ...current, [activeDate]: toApiDate(date) }));
  }

  function shakeRequiredFields() {
    fieldGroupShake.set(withSequence(
      withTiming(-5, { duration: 45 }),
      withTiming(5, { duration: 70 }),
      withTiming(-3, { duration: 55 }),
      withTiming(3, { duration: 55 }),
      withTiming(0, { duration: 45 }),
    ));
  }

  function shakeDates() {
    dateShake.set(withSequence(
      withTiming(-5, { duration: 45 }),
      withTiming(5, { duration: 70 }),
      withTiming(-3, { duration: 55 }),
      withTiming(3, { duration: 55 }),
      withTiming(0, { duration: 45 }),
    ));
  }

  async function submit() {
    const required = [values.title, values.destination, values.country];
    if (required.some((value) => !value.trim())) {
      shakeRequiredFields();
      setError('Add a title, destination, and country.');
      return;
    }
    if (values.end_date < values.start_date) {
      shakeDates();
      setError('End date must be on or after the start date.');
      return;
    }
    setError(null); setIsSubmitting(true);
    try {
      await onSubmit({ ...values, title: values.title.trim(), destination: values.destination.trim(), country: values.country.trim(), description: values.description?.trim() || null });
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'The journey could not be saved. Please try again.');
    } finally { setIsSubmitting(false); }
  }

  return (
    <SafeAreaView style={styles.safe} edges={embedded ? ['top'] : undefined}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'android' ? 'height' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          scrollEventThrottle={tabBarScroll.scrollEventThrottle}
          onScroll={handleScroll}
          contentContainerStyle={[styles.content, embedded && styles.embeddedContent]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
        >
          {!embedded || onCancel ? <SheetHeader title={eyebrow} onClose={onCancel} /> : null}

          <Animated.View
            entering={embedded ? FadeInDown.duration(320) : undefined}
            style={[styles.intro, embedded && styles.embeddedIntro]}
          >
            {!embedded ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
            <Text style={[styles.heading, embedded && styles.embeddedHeading]}>{heading}</Text>
            {embedded ? (
              <Text style={styles.introCopy}>
                Give this journey a home. Add photos and memories whenever you are ready.
              </Text>
            ) : null}
          </Animated.View>

          <View style={styles.form}>
            <Animated.View
              entering={embedded ? FadeInDown.delay(55).duration(320) : undefined}
              style={[styles.fieldGroup, embedded && styles.embeddedGroup, embedded && fieldGroupAnimatedStyle]}
            >
              <View style={embedded ? styles.compactField : undefined}>
                <TextField
                  label="Journey title"
                  value={values.title}
                  onChangeText={update('title')}
                  onFocus={() => {
                    fieldGroupScale.set(withSpring(1.008, { damping: 18, stiffness: 260 }));
                  }}
                  onBlur={() => {
                    fieldGroupScale.set(withSpring(1, { damping: 18, stiffness: 260 }));
                  }}
                  placeholder="Give your journey a name"
                  autoCapitalize="words"
                  style={embedded ? styles.compactInput : undefined}
                />
              </View>
              {embedded ? <View style={styles.fieldDivider} /> : null}
              <View style={embedded ? styles.compactField : undefined}>
                <TextField
                  label="Destination"
                  value={values.destination}
                  onChangeText={update('destination')}
                  onFocus={() => {
                    fieldGroupScale.set(withSpring(1.008, { damping: 18, stiffness: 260 }));
                  }}
                  onBlur={() => {
                    fieldGroupScale.set(withSpring(1, { damping: 18, stiffness: 260 }));
                  }}
                  placeholder="Where are you going?"
                  autoCapitalize="words"
                  editable={!values.place}
                  style={embedded ? styles.compactInput : undefined}
                />
              </View>
              {embedded ? <View style={styles.fieldDivider} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={values.country ? `Country, ${values.country}` : 'Select a country'}
                onPress={() => {
                  setCountrySearch('');
                  setShowCountrySelector(true);
                }}
                onPressIn={() => {
                  fieldGroupScale.set(withSpring(1.008, { damping: 18, stiffness: 260 }));
                }}
                onPressOut={() => {
                  fieldGroupScale.set(withSpring(1, { damping: 18, stiffness: 260 }));
                }}
                style={[embedded ? styles.compactField : undefined, styles.countryField]}
              >
                <View style={styles.countryTextWrap}>
                  <Text style={styles.countryLabel}>COUNTRY</Text>
                  <View style={styles.countryValueRow}>
                    {selectedCountry ? <Text style={styles.countryFlag}>{flagEmoji(selectedCountry.code)}</Text> : null}
                    <Text
                      numberOfLines={1}
                      style={[styles.countryValue, !values.country && styles.countryPlaceholder]}
                    >
                      {values.country || 'Select a country'}
                    </Text>
                  </View>
                </View>
                <Ionicons color={colors.subtle} name="chevron-forward" size={18} />
              </Pressable>
            </Animated.View>

            <Animated.View
              entering={embedded ? FadeInDown.delay(95).duration(320) : undefined}
              style={embedded ? locationAnimatedStyle : undefined}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Search or choose journey place"
                onPress={() => setShowLocation(true)}
                onPressIn={() => {
                  if (embedded) locationScale.set(withSpring(0.985, { damping: 20, stiffness: 320 }));
                }}
                onPressOut={() => {
                  if (embedded) locationScale.set(withSpring(1, { damping: 18, stiffness: 300 }));
                }}
                style={[styles.location, embedded && styles.embeddedCard]}
              >
                {embedded ? <Ionicons color={colors.muted} name="location-outline" size={21} /> : null}
                <View style={styles.locationCopy}>
                  <Text style={styles.label}>LOCATION / PLACE — OPTIONAL</Text>
                  <Text numberOfLines={1} style={styles.locationValue}>
                    {values.place?.display_name ?? formatCoordinates(values.latitude, values.longitude) ?? 'Search or choose on map'}
                  </Text>
                </View>
                {embedded ? <Ionicons color={colors.subtle} name="chevron-forward" size={18} /> : <Text style={styles.locationAction}>{values.latitude ? 'Change' : 'Add'}</Text>}
              </Pressable>
            </Animated.View>

            <Animated.View
              entering={embedded ? FadeInDown.delay(135).duration(320) : undefined}
              style={[styles.dateRow, embedded && styles.embeddedCard, embedded && dateAnimatedStyle]}
            >
              <DateButton label="Start date" value={values.start_date} onPress={() => setActiveDate('start_date')} embedded={embedded} />
              <View style={embedded ? styles.dateDivider : undefined} />
              <DateButton label="End date" value={values.end_date} onPress={() => setActiveDate('end_date')} embedded={embedded} />
            </Animated.View>

            {activeDate ? (
              <Animated.View entering={FadeInDown.duration(190)} style={styles.datePicker}>
                <DateTimePicker
                  value={toDate(values[activeDate])}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={changeDate}
                />
                {Platform.OS === 'ios' ? (
                  <Pressable onPress={() => setActiveDate(null)} style={styles.dateDone}>
                    <Text style={styles.dateDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </Animated.View>
            ) : null}

            <Animated.View
              entering={embedded ? FadeInDown.delay(175).duration(320) : undefined}
              style={embedded ? descriptionAnimatedStyle : undefined}
            >
              <View ref={descriptionRef} collapsable={false} style={embedded ? styles.descriptionCard : undefined}>
                <TextField
                  label="Description — optional"
                  value={values.description ?? ''}
                  onChangeText={update('description')}
                  onFocus={() => {
                    descriptionFocused.current = true;
                    descriptionScale.set(withSpring(1.008, { damping: 18, stiffness: 260 }));

                    if (Number.isFinite(keyboardTop.current)) {
                      setTimeout(alignDescriptionAboveKeyboard, 55);
                    }
                  }}
                  onBlur={() => {
                    descriptionFocused.current = false;
                    descriptionScale.set(withSpring(1, { damping: 18, stiffness: 260 }));
                  }}
                  placeholder="What makes this journey special?"
                  multiline
                  contained={!embedded}
                  style={embedded ? styles.descriptionInput : undefined}
                />
              </View>
            </Animated.View>
          </View>

          {error ? (
            <Animated.View entering={FadeInDown.duration(180)}>
              <ErrorBanner message={error} />
            </Animated.View>
          ) : null}

          <Animated.View
            entering={embedded ? FadeInDown.delay(215).duration(320) : undefined}
            onTouchStart={() => {
              if (embedded) createScale.set(withSpring(0.975, { damping: 20, stiffness: 340 }));
            }}
            onTouchEnd={() => {
              if (embedded) createScale.set(withSpring(1, { damping: 18, stiffness: 300 }));
            }}
            onTouchCancel={() => {
              if (embedded) createScale.set(withSpring(1, { damping: 18, stiffness: 300 }));
            }}
            style={embedded ? createAnimatedStyle : undefined}
          >
            <PrimaryButton
              loading={isSubmitting}
              onPress={() => void submit()}
              style={embedded ? styles.createButton : undefined}
            >
              {submitLabel}
            </PrimaryButton>
          </Animated.View>

          <Modal
            animationType="slide"
            presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
            visible={showCountrySelector}
            onRequestClose={() => setShowCountrySelector(false)}
          >
            <SafeAreaView style={styles.countryModalSafe}>
              <View style={styles.countryModalHeader}>
                <View style={styles.countryModalGrabber} />
                <View style={styles.countryModalTitleRow}>
                  <Text style={styles.countryModalTitle}>Select a country</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close country selector"
                    hitSlop={12}
                    onPress={() => setShowCountrySelector(false)}
                    style={styles.countryModalClose}
                  >
                    <Ionicons name="close" size={19} color="#111111" />
                  </Pressable>
                </View>

                <View style={styles.countrySearchBar}>
                  <Ionicons name="search" size={18} color="#8E8E93" />
                  <TextInput
                    autoCorrect={false}
                    autoCapitalize="none"
                    clearButtonMode="while-editing"
                    placeholder="Search countries"
                    placeholderTextColor="#8E8E93"
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                    style={styles.countrySearchInput}
                  />
                </View>
              </View>

              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.code}
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.countryListContent}
                renderItem={({ item, index }) => {
                  const isSelected = item.name === values.country;

                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={item.name}
                      onPress={() => {
                        setValues((current) => ({ ...current, country: item.name }));
                        setShowCountrySelector(false);
                        setCountrySearch('');
                      }}
                      style={({ pressed }) => [
                        styles.countryRow,
                        pressed && styles.countryRowPressed,
                      ]}
                    >
                      <Text style={styles.countryRowFlag}>{flagEmoji(item.code)}</Text>
                      <Text style={styles.countryRowName}>{item.name}</Text>
                      {isSelected ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
                      {index < filteredCountries.length - 1 ? <View style={styles.countryRowDivider} /> : null}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.countryEmpty}>
                    <Text style={styles.countryEmptyText}>No countries found</Text>
                  </View>
                }
              />
            </SafeAreaView>
          </Modal>

          {showLocation ? <JourneyLocationPicker latitude={values.latitude} longitude={values.longitude} place={values.place ?? null} onCancel={() => setShowLocation(false)} onChange={(selection) => {
        setValues((current) => selection ? ({
          ...current,
          destination: selection.place?.name ?? current.destination,
          country: selection.place?.country ?? current.country,
          latitude: selection.coordinate.latitude.toFixed(6),
          longitude: selection.coordinate.longitude.toFixed(6),
          place: selection.place ?? current.place,
        }) : ({ ...current, latitude: null, longitude: null, place: current.place ? null : current.place }));
        setShowLocation(false);
      }} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DateButton({ label, value, onPress, embedded = false }: { label: string; value: string; onPress: () => void; embedded?: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.dateButton, embedded && styles.embeddedDateButton, animatedStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${displayDate(value)}`}
        onPress={onPress}
        onPressIn={() => {
          scale.set(withSpring(0.97, { damping: 20, stiffness: 340 }));
        }}
        onPressOut={() => {
          scale.set(withSpring(1, { damping: 18, stiffness: 300 }));
        }}
        style={styles.datePressable}
      >
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.dateValue}>{displayDate(value)}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F2F7' },
  content: { padding: spacing.screen, paddingBottom: 40, gap: spacing.lg },
  embeddedContent: {
    paddingTop: 42,
    paddingBottom: 112,
    paddingHorizontal: spacing.screen,
    gap: 0,
  },
  intro: { gap: spacing.xs },
  embeddedIntro: {
    marginTop: 8,
    marginBottom: 20,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  heading: { ...typography.display, color: colors.ink, maxWidth: 340 },
  embeddedHeading: {
    ...typography.screenTitle,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.7,
  },
  introCopy: {
    ...typography.body,
    color: '#7C7C80',
    marginTop: 5,
    maxWidth: 350,
    lineHeight: 24,
  },
  form: { gap: 16 },
  fieldGroup: { gap: spacing.md },
  embeddedGroup: {
    gap: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  compactField: {
    paddingTop: 10,
    paddingBottom: 4,
  },
  compactInput: {
    minHeight: 40,
    borderBottomWidth: 0,
    paddingVertical: 4,
    fontSize: 17,
    color: '#111111',
  },
  fieldDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D9D9DE',
    marginLeft: 0,
  },
  embeddedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  label: {
    ...typography.eyebrow,
    color: '#5E5E63',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
  dateRow: { flexDirection: 'row', gap: 0 },
  dateButton: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  embeddedDateButton: {
    borderBottomWidth: 0,
    minHeight: 68,
  },
  datePressable: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 14,
  },
  countryField: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  countryLabel: {
    ...typography.eyebrow,
    color: '#5E5E63',
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
  countryValueRow: {
    marginTop: 4,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryFlag: {
    fontSize: 20,
    lineHeight: 24,
  },
  countryValue: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: '#111111',
  },
  countryPlaceholder: {
    color: '#8E8E93',
  },
  countryModalSafe: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  countryModalHeader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  countryModalGrabber: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  countryModalTitleRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  countryModalTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#111111',
  },
  countryModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countrySearchBar: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#E5E5EA',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 7,
  },
  countrySearchInput: {
    flex: 1,
    minHeight: 38,
    paddingVertical: 0,
    fontSize: 17,
    color: '#111111',
  },
  countryListContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  countryRow: {
    minHeight: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    position: 'relative',
  },
  countryRowPressed: {
    opacity: 0.65,
  },
  countryRowFlag: {
    width: 30,
    fontSize: 22,
    lineHeight: 28,
  },
  countryRowName: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    color: '#111111',
  },
  countryRowDivider: {
    position: 'absolute',
    left: 56,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#D9D9DE',
  },
  countryEmpty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  countryEmptyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  dateDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: '#D9D9DE',
    marginVertical: 12,
    marginHorizontal: 12,
  },
  dateValue: {
    ...typography.body,
    color: '#111111',
    marginTop: 7,
    fontSize: 16,
  },
  datePicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  dateDone: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingBottom: 12 },
  dateDoneText: { color: colors.accent, fontWeight: '800' },
  location: {
    minHeight: 72,
    borderBottomWidth: 0,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationCopy: { flex: 1 },
  locationValue: {
    ...typography.body,
    color: '#111111',
    marginTop: 5,
    fontSize: 16,
  },
  locationAction: { ...typography.button, color: colors.accent, fontSize: 13 },
  descriptionCard: {
    minHeight: 92,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    overflow: 'hidden',
  },
  descriptionInput: {
    minHeight: 62,
    borderBottomWidth: 0,
    paddingTop: 4,
  },
  createButton: {
    marginTop: 18,
    borderRadius: radii.round,
    marginBottom: 4,
  },
});
