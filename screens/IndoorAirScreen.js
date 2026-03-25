import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Switch, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { THEME, getTier } from '../constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

// How much each building type filters outdoor air (lower = cleaner indoors)
const BUILDING_TYPES = [
  { id: 'hdb',      label: 'HDB Flat',         icon: '🏢', modifier: 0.7,  note: 'Typical ventilation gaps' },
  { id: 'condo',    label: 'Condo',             icon: '🏬', modifier: 0.6,  note: 'Better sealing than HDB' },
  { id: 'landed',   label: 'Landed / Bungalow', icon: '🏡', modifier: 0.8,  note: 'More air exchange points' },
  { id: 'office',   label: 'Office / Mall',     icon: '🏗',  modifier: 0.45, note: 'Central HVAC with filters' },
  { id: 'school',   label: 'School',            icon: '🏫', modifier: 0.65, note: 'Mixed ventilation' },
];

// Modifier reductions from active measures
const MEASURES = [
  { id: 'purifier',      label: 'Air Purifier ON',        icon: '🌀', delta: -0.20 },
  { id: 'windows',       label: 'Windows Closed',         icon: '🪟', delta: -0.15 },
  { id: 'doors',         label: 'Doors Sealed',           icon: '🚪', delta: -0.05 },
  { id: 'ac',            label: 'Aircon ON (recirculate)', icon: '❄️', delta: -0.10 },
];

// Window timing advice based on outdoor PSI
const windowTiming = (psi) => {
  if (psi <= 50)  return { time: 'Any time',           color: '#3FB950', advice: 'Outdoor air is clean — open windows freely for natural ventilation.' };
  if (psi <= 100) return { time: 'Morning (6–9 am)',   color: '#E3B341', advice: 'Ventilate in the early morning before heat builds. Keep brief, under 30 min.' };
  if (psi <= 150) return { time: 'Avoid if possible',  color: '#FF9500', advice: 'Keep windows shut. If you must ventilate, do it during cooler overnight hours.' };
  return           { time: 'Keep windows shut',        color: '#F85149', advice: 'Do not open windows. Run purifier on high. Seal gaps with wet towels if needed.' };
};

// Purifier sizing guide
const purifierGuide = (indoorAqi) => {
  if (indoorAqi <= 50)  return { setting: 'Off / Auto',  icon: '💤', color: '#3FB950' };
  if (indoorAqi <= 100) return { setting: 'Low',          icon: '🌿', color: '#E3B341' };
  if (indoorAqi <= 150) return { setting: 'Medium',       icon: '🌀', color: '#FF9500' };
  return                       { setting: 'High / MAX',   icon: '🚨', color: '#F85149' };
};

// ─── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, style }) {
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(Math.round(value));

  useEffect(() => {
    Animated.spring(anim, { toValue: value, tension: 40, friction: 10, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);

  return <Text style={style}>{display}</Text>;
}

// ─── Modifier Bar ─────────────────────────────────────────────────────────────

function ModifierBar({ label, value, color }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(widthAnim, { toValue: Math.min(value, 1), tension: 40, friction: 10, useNativeDriver: false }).start();
  }, [value]);
  const width = widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={mb.row}>
      <Text style={mb.label}>{label}</Text>
      <View style={mb.track}>
        <Animated.View style={[mb.fill, { width, backgroundColor: color }]} />
      </View>
      <Text style={[mb.pct, { color }]}>{Math.round(value * 100)}%</Text>
    </View>
  );
}

const mb = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 11, color: THEME.textMuted, width: 68, fontFamily: THEME.mono },
  track: { flex: 1, height: 4, backgroundColor: THEME.border, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: 4, borderRadius: 2 },
  pct:   { fontFamily: THEME.mono, fontSize: 11, fontWeight: '700', width: 36, textAlign: 'right' },
});

// ─── Room Card ────────────────────────────────────────────────────────────────

function RoomCard({ label, modifier, outdoorPsi }) {
  const indoorAqi = Math.round(outdoorPsi * modifier);
  const tier = getTier(indoorAqi);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (indoorAqi > 100) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.03, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [indoorAqi]);

  return (
    <Animated.View style={[rc.card, { borderColor: tier.color + '44', transform: [{ scale: pulse }] }]}>
      <Text style={rc.roomLabel}>{label}</Text>
      <Text style={[rc.aqi, { color: tier.color }]}>{indoorAqi}</Text>
      <Text style={rc.aqiUnit}>AQI</Text>
      <View style={[rc.pill, { backgroundColor: tier.color + '22' }]}>
        <Text style={[rc.pillText, { color: tier.color }]}>{tier.icon} {tier.label}</Text>
      </View>
    </Animated.View>
  );
}

const rc = StyleSheet.create({
  card:      { flex: 1, backgroundColor: THEME.surface, borderRadius: 14, borderWidth: 1.5, padding: 14, alignItems: 'center', gap: 3, minWidth: 100 },
  roomLabel: { fontFamily: THEME.mono, fontSize: 9, letterSpacing: 1.5, color: THEME.textMuted, textTransform: 'uppercase' },
  aqi:       { fontFamily: THEME.mono, fontSize: 32, fontWeight: '900', lineHeight: 36 },
  aqiUnit:   { fontFamily: THEME.mono, fontSize: 10, color: THEME.textMuted, letterSpacing: 2 },
  pill:      { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 2 },
  pillText:  { fontFamily: THEME.mono, fontSize: 9, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function IndoorAirScreen({ route: navRoute }) {
  // Accept outdoor PSI passed from HomeScreen, or default to 80
  const outdoorPsi = navRoute?.params?.psi ?? 80;

  const [buildingId, setBuildingId]   = useState('hdb');
  const [activeIds, setActiveIds]     = useState({ purifier: false, windows: true, doors: false, ac: false });
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const building = BUILDING_TYPES.find(b => b.id === buildingId);

  // Calculate effective indoor modifier
  const measureDelta = MEASURES.reduce((acc, m) => acc + (activeIds[m.id] ? m.delta : 0), 0);
  const effectiveModifier = Math.max(0.05, building.modifier + measureDelta);
  const indoorAqi = Math.round(outdoorPsi * effectiveModifier);

  const outdoorTier = getTier(outdoorPsi);
  const indoorTier  = getTier(indoorAqi);
  const winTiming   = windowTiming(outdoorPsi);
  const purifier    = purifierGuide(indoorAqi);
  const improvement = Math.round(((outdoorPsi - indoorAqi) / outdoorPsi) * 100);

  const toggleMeasure = (id) => setActiveIds(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>INDOOR ESTIMATOR</Text>
          <Text style={styles.title}>Indoor Air Quality</Text>
          <Text style={styles.subtitle}>Based on outdoor PSI · {outdoorPsi}</Text>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>

          {/* ── Outdoor vs Indoor hero ── */}
          <View style={styles.heroRow}>
            {/* Outdoor */}
            <View style={[styles.heroCard, { borderColor: outdoorTier.color + '55' }]}>
              <Text style={styles.heroCardLabel}>OUTDOOR</Text>
              <AnimatedNumber value={outdoorPsi} style={[styles.heroNum, { color: outdoorTier.color }]} />
              <Text style={styles.heroUnit}>PSI</Text>
              <Text style={[styles.heroBadge, { color: outdoorTier.color }]}>{outdoorTier.icon} {outdoorTier.label}</Text>
            </View>

            {/* Arrow + improvement */}
            <View style={styles.heroMiddle}>
              <Text style={styles.arrowIcon}>→</Text>
              {improvement > 0 && (
                <View style={styles.improvePill}>
                  <Text style={styles.improveText}>−{improvement}%</Text>
                </View>
              )}
            </View>

            {/* Indoor */}
            <View style={[styles.heroCard, { borderColor: indoorTier.color + '55' }]}>
              <Text style={styles.heroCardLabel}>INDOOR</Text>
              <AnimatedNumber value={indoorAqi} style={[styles.heroNum, { color: indoorTier.color }]} />
              <Text style={styles.heroUnit}>AQI est.</Text>
              <Text style={[styles.heroBadge, { color: indoorTier.color }]}>{indoorTier.icon} {indoorTier.label}</Text>
            </View>
          </View>

          {/* ── Modifier breakdown bars ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>HOW WE ESTIMATE THIS</Text>
            <ModifierBar label="Building" value={building.modifier}     color="#58A6FF" />
            <ModifierBar label="Measures" value={Math.max(0, -measureDelta + 0.01)} color="#3FB950" />
            <ModifierBar label="Final"    value={effectiveModifier}     color={indoorTier.color} />
            <Text style={styles.formulaNote}>
              Indoor AQI ≈ Outdoor PSI × {effectiveModifier.toFixed(2)} = <Text style={{ color: indoorTier.color, fontWeight: '800' }}>{indoorAqi}</Text>
            </Text>
          </View>

          {/* ── Building type selector ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>YOUR BUILDING TYPE</Text>
            <View style={styles.buildingGrid}>
              {BUILDING_TYPES.map(b => (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.buildingChip, buildingId === b.id && styles.buildingChipActive]}
                  onPress={() => setBuildingId(b.id)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.buildingChipIcon}>{b.icon}</Text>
                  <Text style={[styles.buildingChipLabel, buildingId === b.id && styles.buildingChipLabelActive]}>
                    {b.label}
                  </Text>
                  {buildingId === b.id && (
                    <Text style={styles.buildingChipNote}>{b.note}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Active measures toggles ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ACTIVE MEASURES</Text>
            {MEASURES.map(m => (
              <View key={m.id} style={styles.measureRow}>
                <Text style={styles.measureIcon}>{m.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.measureLabel}>{m.label}</Text>
                  <Text style={styles.measureDelta}>
                    {activeIds[m.id]
                      ? `Reducing modifier by ${Math.abs(m.delta * 100).toFixed(0)}%`
                      : 'Not active'}
                  </Text>
                </View>
                <Switch
                  value={activeIds[m.id]}
                  onValueChange={() => toggleMeasure(m.id)}
                  trackColor={{ false: THEME.border, true: '#3FB95055' }}
                  thumbColor={activeIds[m.id] ? '#3FB950' : THEME.textMuted}
                  ios_backgroundColor={THEME.border}
                />
              </View>
            ))}
          </View>

          {/* ── Room estimates ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ROOM ESTIMATES</Text>
            <Text style={styles.roomNote}>Different rooms have different exposure levels.</Text>
            <View style={styles.roomGrid}>
              <RoomCard label="Bedroom"      modifier={effectiveModifier * 0.9}  outdoorPsi={outdoorPsi} />
              <RoomCard label="Living Room"  modifier={effectiveModifier}         outdoorPsi={outdoorPsi} />
              <RoomCard label="Kitchen"      modifier={effectiveModifier * 1.15}  outdoorPsi={outdoorPsi} />
            </View>
            <Text style={styles.roomHint}>
              🍳 Kitchens run higher — cooking + less sealing. Bedrooms lower if door is kept closed.
            </Text>
          </View>

          {/* ── Window timing ── */}
          <View style={[styles.card, styles.windowCard, { borderLeftColor: winTiming.color }]}>
            <View style={styles.windowHeader}>
              <Text style={styles.sectionLabel}>WINDOW TIMING</Text>
              <View style={[styles.windowTimePill, { backgroundColor: winTiming.color + '22', borderColor: winTiming.color + '55' }]}>
                <Text style={[styles.windowTimeText, { color: winTiming.color }]}>{winTiming.time}</Text>
              </View>
            </View>
            <Text style={styles.windowAdvice}>{winTiming.advice}</Text>
          </View>

          {/* ── Purifier recommendation ── */}
          <View style={[styles.card, styles.purifierCard, { borderColor: purifier.color + '44' }]}>
            <Text style={styles.sectionLabel}>AIR PURIFIER</Text>
            <View style={styles.purifierRow}>
              <Text style={styles.purifierIcon}>{purifier.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.purifierSetting, { color: purifier.color }]}>
                  Set to: {purifier.setting}
                </Text>
                <Text style={styles.purifierNote}>
                  {indoorAqi <= 50
                    ? 'Indoor air is clean. Save energy — leave purifier off or on auto.'
                    : indoorAqi <= 100
                    ? 'Mild indoor pollution. Low setting keeps air fresh without noise.'
                    : indoorAqi <= 150
                    ? 'Elevated indoor AQI. Medium setting recommended. Check filter.'
                    : 'Hazardous indoor level. Run on MAX. Replace filter if >3 months old.'}
                </Text>
              </View>
            </View>
            <View style={styles.cadrHint}>
              <Text style={styles.cadrText}>
                💡 CADR tip: For a 20 m² room, you need a purifier rated ≥ 180 m³/h to be effective at this AQI.
              </Text>
            </View>
          </View>

          {/* ── Action checklist ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>ACTION CHECKLIST</Text>
            {[
              { done: indoorAqi <= 100, text: 'Indoor AQI is within acceptable range' },
              { done: activeIds.purifier, text: 'Air purifier is running' },
              { done: !activeIds.windows || outdoorPsi <= 50, text: 'Windows managed for current PSI' },
              { done: activeIds.ac, text: 'Aircon on recirculation (not fresh air mode)' },
              { done: activeIds.doors, text: 'Doors to outdoor areas sealed' },
            ].map((item, i) => (
              <View key={i} style={styles.checkRow}>
                <View style={[styles.checkDot, { backgroundColor: item.done ? '#3FB950' : THEME.border }]}>
                  {item.done && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <Text style={[styles.checkText, item.done && styles.checkTextDone]}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.disclaimer}>
            ⚠ Estimates only. Actual indoor AQI varies by room sealing, occupancy, and cooking activity.
            Use a home sensor for accurate readings.
          </Text>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: THEME.bg },
  content: { paddingHorizontal: 16, paddingBottom: 48 },

  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: THEME.accent,
    fontWeight: '700',
    marginBottom: 4,
  },
  title:    { fontSize: 26, fontWeight: '800', color: THEME.textPrimary },
  subtitle: { fontFamily: THEME.mono, fontSize: 12, color: THEME.textMuted, marginTop: 4, letterSpacing: 0.5 },

  // Hero row
  heroRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  heroCard:   {
    flex: 1,
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'center',
    gap: 2,
  },
  heroCardLabel: { fontFamily: THEME.mono, fontSize: 9, letterSpacing: 2, color: THEME.textMuted, textTransform: 'uppercase' },
  heroNum:       { fontFamily: THEME.mono, fontSize: 42, fontWeight: '900', lineHeight: 46 },
  heroUnit:      { fontFamily: THEME.mono, fontSize: 10, color: THEME.textMuted, letterSpacing: 2 },
  heroBadge:     { fontFamily: THEME.mono, fontSize: 10, fontWeight: '700', marginTop: 4 },
  heroMiddle:    { alignItems: 'center', gap: 6 },
  arrowIcon:     { fontSize: 22, color: THEME.textMuted },
  improvePill:   { backgroundColor: '#3FB95022', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  improveText:   { fontFamily: THEME.mono, fontSize: 11, fontWeight: '700', color: '#3FB950' },

  // Generic card
  card: {
    backgroundColor: THEME.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 16,
    marginBottom: 14,
    gap: 10,
  },
  sectionLabel: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: THEME.textMuted,
    fontWeight: '700',
  },
  formulaNote: {
    fontFamily: THEME.mono,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },

  // Building selector
  buildingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  buildingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: THEME.bg,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  buildingChipActive: { borderColor: THEME.accent + '88', backgroundColor: THEME.accent + '11' },
  buildingChipIcon:   { fontSize: 14 },
  buildingChipLabel:  { fontSize: 12, color: THEME.textMuted, fontWeight: '600' },
  buildingChipLabelActive: { color: THEME.accent },
  buildingChipNote:   { fontSize: 10, color: THEME.textMuted, marginTop: 1 },

  // Measures
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  measureIcon:  { fontSize: 20, width: 28, textAlign: 'center' },
  measureLabel: { fontSize: 14, color: THEME.textPrimary, fontWeight: '600' },
  measureDelta: { fontSize: 11, color: THEME.textMuted, marginTop: 1 },

  // Room grid
  roomGrid:  { flexDirection: 'row', gap: 10 },
  roomNote:  { fontSize: 12, color: THEME.textMuted, marginTop: -4 },
  roomHint:  { fontSize: 11, color: THEME.textMuted, lineHeight: 17, marginTop: -2 },

  // Window card
  windowCard: { borderLeftWidth: 3, borderLeftColor: '#E3B341' },
  windowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  windowTimePill: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  windowTimeText: { fontFamily: THEME.mono, fontSize: 11, fontWeight: '700' },
  windowAdvice:   { fontSize: 13, color: THEME.textPrimary, lineHeight: 20 },

  // Purifier card
  purifierCard: { borderWidth: 1.5 },
  purifierRow:  { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  purifierIcon: { fontSize: 28, marginTop: 2 },
  purifierSetting: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  purifierNote:    { fontSize: 13, color: THEME.textPrimary, lineHeight: 19 },
  cadrHint: {
    backgroundColor: THEME.bg,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  cadrText: { fontSize: 11, color: THEME.textMuted, lineHeight: 17 },

  // Checklist
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkTick:     { fontSize: 11, color: THEME.bg, fontWeight: '900' },
  checkText:     { flex: 1, fontSize: 13, color: THEME.textMuted },
  checkTextDone: { color: THEME.textPrimary },

  disclaimer: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 16,
    paddingHorizontal: 8,
    marginTop: 8,
  },
});