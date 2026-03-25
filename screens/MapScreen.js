import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, ActivityIndicator, Platform, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Path, Circle, G, Text as SvgText, Defs, RadialGradient, Stop,
} from 'react-native-svg';
import { usePsiData } from '../hooks/usePsiData';
import { THEME, getTier, formatTime } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const MAP_W = SCREEN_W - 32;
const MAP_H = MAP_W * 0.62;
const MONO = Platform.OS === 'ios' ? 'Courier New' : 'monospace';

// ─── Singapore SVG path (simplified outline) ──────────────────────────────────
// Normalised to a 500×310 viewBox

const SG_OUTLINE = `
  M 60,120 C 55,110 50,100 58,88 C 65,76 80,72 95,68
  C 115,62 138,58 162,55 C 185,52 208,50 230,49
  C 255,48 278,49 300,51 C 322,53 345,57 365,63
  C 385,69 402,78 415,90 C 428,102 432,116 430,130
  C 428,142 420,152 412,162 C 400,175 385,182 370,188
  C 352,195 333,198 315,200 C 295,202 275,202 255,201
  C 232,200 210,197 190,192 C 168,187 148,180 130,170
  C 110,159 90,145 75,133 Z
`;

// Sentosa island blob
const SENTOSA = `
  M 215,220 C 220,215 232,213 242,215 C 252,217 258,224 255,230
  C 252,236 240,238 230,236 C 220,234 212,226 215,220 Z
`;

// ─── Region "zones" as SVG clip regions (approximate polygons) ─────────────────
// Coordinates in the 500×310 viewBox

const REGIONS_SVG = {
  North: {
    cx: 245, cy: 85,
    polygon: '130,55 370,55 390,110 330,118 245,115 155,118 105,110',
    labelX: 245, labelY: 78,
  },
  South: {
    cx: 245, cy: 190,
    polygon: '140,168 185,192 245,200 305,192 355,168 330,148 245,155 155,148',
    labelX: 245, labelY: 194,
  },
  East: {
    cx: 370, cy: 138,
    polygon: '330,118 390,110 428,130 420,158 355,168 330,148 345,135',
    labelX: 375, labelY: 140,
  },
  West: {
    cx: 112, cy: 138,
    polygon: '105,110 155,118 155,148 140,168 75,155 60,130 68,112',
    labelX: 102, labelY: 140,
  },
  Central: {
    cx: 245, cy: 138,
    polygon: '155,118 330,118 330,148 245,155 155,148',
    labelX: 245, labelY: 138,
  },
};

// ─── Animated haze pulse ───────────────────────────────────────────────────────

function HazePulse({ cx, cy, color, psi }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const radius = 18 + (psi / 400) * 22;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Can't animate SVG props directly — use a static outer ring instead
  return (
    <>
      <Circle cx={cx} cy={cy} r={radius + 10} fill={color + '10'} stroke={color + '22'} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={radius} fill={color + '20'} stroke={color + '40'} strokeWidth={1} />
    </>
  );
}

// ─── SVG Map ───────────────────────────────────────────────────────────────────

function SingaporeMap({ regions, selected, onRegionPress }) {
  const byName = {};
  regions?.forEach(r => { byName[r.region] = r; });

  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
      <Svg width={MAP_W} height={MAP_H} viewBox="0 0 500 310">
        <Defs>
          {Object.entries(REGIONS_SVG).map(([name, r]) => {
            const data = byName[name];
            const tier = getTier(data?.psi ?? 0);
            return (
              <RadialGradient
                key={name}
                id={`grad_${name}`}
                cx="50%" cy="50%" r="50%"
              >
                <Stop offset="0%" stopColor={tier.color} stopOpacity="0.25" />
                <Stop offset="100%" stopColor={tier.color} stopOpacity="0.04" />
              </RadialGradient>
            );
          })}
        </Defs>

        {/* Ocean background */}
        <Path d="M0,0 H500 V310 H0 Z" fill="#07090f" />

        {/* SG outline fill */}
        <Path d={SG_OUTLINE} fill="#0e0e14" stroke="#1e1e28" strokeWidth="1.5" />
        <Path d={SENTOSA} fill="#0e0e14" stroke="#1e1e28" strokeWidth="1" />

        {/* Region zone fills + press targets */}
        {Object.entries(REGIONS_SVG).map(([name, r]) => {
          const data = byName[name];
          const tier = getTier(data?.psi ?? 0);
          const isSelected = selected === name;

          return (
            <G key={name} onPress={() => onRegionPress(name)}>
              {/* Zone shading */}
              <Path
                d={`M ${r.polygon} Z`}
                fill={isSelected ? tier.color + '30' : tier.color + '12'}
                stroke={tier.color + (isSelected ? 'AA' : '44')}
                strokeWidth={isSelected ? 1.5 : 0.8}
              />

              {/* Haze glow circles */}
              <HazePulse cx={r.cx} cy={r.cy} color={tier.color} psi={data?.psi ?? 0} />

              {/* Centre dot */}
              <Circle
                cx={r.cx} cy={r.cy} r={isSelected ? 7 : 5}
                fill={tier.color}
                stroke={isSelected ? '#fff' : tier.color + '88'}
                strokeWidth={isSelected ? 1.5 : 1}
              />

              {/* PSI label */}
              <SvgText
                x={r.labelX} y={r.labelY - 14}
                fontSize={isSelected ? 14 : 11}
                fontWeight="900"
                fill={tier.color}
                textAnchor="middle"
                fontFamily={MONO}
              >
                {data?.psi ?? '—'}
              </SvgText>

              {/* Region name */}
              <SvgText
                x={r.labelX} y={r.labelY - 2}
                fontSize={7}
                fill={tier.color + 'BB'}
                textAnchor="middle"
                fontFamily={MONO}
                letterSpacing={1.5}
              >
                {name.toUpperCase()}
              </SvgText>
            </G>
          );
        })}

        {/* Coastline re-stroke on top */}
        <Path d={SG_OUTLINE} fill="none" stroke="#2a2a38" strokeWidth="1" />

        {/* Compass rose */}
        <SvgText x={468} y={28} fontSize={8} fill="#333340" textAnchor="middle" fontFamily={MONO}>N</SvgText>
        <SvgText x={468} y={52} fontSize={6} fill="#222230" textAnchor="middle" fontFamily={MONO}>↑</SvgText>
      </Svg>
    </Animated.View>
  );
}

// ─── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ region, data, onClose }) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [region]);

  if (!data) return null;
  const tier = getTier(data.psi);

  return (
    <Animated.View style={[
      styles.panel,
      { opacity: fadeAnim, transform: [{ translateY: slideAnim }], borderColor: tier.color + '44' },
    ]}>
      <View style={[styles.panelStripe, { backgroundColor: tier.color }]} />
      <View style={styles.panelInner}>
        <View style={styles.panelHead}>
          <View>
            <Text style={[styles.panelRegionName, { color: tier.color }]}>{region}</Text>
            <Text style={styles.panelTierName}>{tier.label}</Text>
          </View>
          <View style={styles.panelPsiBlock}>
            <Text style={[styles.panelPsiValue, { color: tier.color }]}>{data.psi}</Text>
            <Text style={styles.panelPsiUnit}>PSI</Text>
          </View>
        </View>

        <View style={styles.panelRule} />

        <View style={styles.panelStatsRow}>
          {data.pm25 > 0 && (
            <View style={styles.panelStatItem}>
              <Text style={styles.panelStatKey}>PM2.5</Text>
              <Text style={styles.panelStatVal}>{data.pm25}</Text>
            </View>
          )}
          {data.psiThreeHour > 0 && (
            <View style={styles.panelStatItem}>
              <Text style={styles.panelStatKey}>3H PSI</Text>
              <Text style={styles.panelStatVal}>{data.psiThreeHour}</Text>
            </View>
          )}
          <View style={styles.panelStatItem}>
            <Text style={styles.panelStatKey}>GRADE</Text>
            <Text style={[styles.panelStatVal, { color: tier.color }]}>{tier.icon}</Text>
          </View>
        </View>

        <Text style={styles.panelAdviceText}>{tier.advice}</Text>
      </View>

      <TouchableOpacity
        onPress={onClose}
        style={styles.panelCloseBtn}
        hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
      >
        <Text style={styles.panelCloseText}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function MapScreen() {
  const { data, loading, refreshing, error, lastUpdated, refresh } = usePsiData();
  const [selected, setSelected] = useState(null);
  const headerFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (data) Animated.timing(headerFade, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [data]);

  const byName = {};
  data?.regions?.forEach(r => { byName[r.region] = r; });

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.centered]} edges={['top']}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </SafeAreaView>
    );
  }

  const nationalTier = getTier(data?.national);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View style={[styles.header, { opacity: headerFade }]}>
          <View>
            <Text style={styles.title}>REGIONAL MAP</Text>
            <Text style={styles.subtitle}>Singapore Air Quality Zones</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refresh}
            disabled={refreshing}
            activeOpacity={0.7}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={THEME.accent} />
              : <Text style={styles.refreshIcon}>↻</Text>}
          </TouchableOpacity>
        </Animated.View>

        {/* Timestamp + national */}
        <Animated.View style={[styles.metaRow, { opacity: headerFade }]}>
          <View style={styles.updatedRow}>
            <View style={styles.liveBlip} />
            <Text style={styles.updatedText}>Updated {formatTime(lastUpdated)}</Text>
          </View>
          {data?.national != null && (
            <View style={[styles.nationalPill, { borderColor: nationalTier.color + '55' }]}>
              <Text style={styles.nationalPillLabel}>NATIONAL</Text>
              <Text style={[styles.nationalPillPsi, { color: nationalTier.color }]}>
                {data.national}
              </Text>
              <Text style={[styles.nationalPillTier, { color: nationalTier.color + '99' }]}>
                {nationalTier.label}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* SVG Map */}
        <Animated.View style={[styles.mapCard, { opacity: headerFade }]}>
          <SingaporeMap
            regions={data?.regions}
            selected={selected}
            onRegionPress={name => setSelected(prev => prev === name ? null : name)}
          />
          {!selected && (
            <Text style={styles.mapHint}>Tap a zone for details</Text>
          )}
        </Animated.View>

        {/* Detail panel */}
        {selected && byName[selected] && (
          <DetailPanel
            region={selected}
            data={byName[selected]}
            onClose={() => setSelected(null)}
          />
        )}

        {/* Region list */}
        <Animated.View style={[styles.section, { opacity: headerFade }]}>
          <Text style={styles.sectionLabel}>ALL REGIONS</Text>
          <View style={styles.regionList}>
            {data?.regions?.map((r, i) => {
              const tier = getTier(r.psi);
              const isSelected = selected === r.region;
              return (
                <TouchableOpacity
                  key={r.region}
                  style={[
                    styles.regionRow,
                    i === data.regions.length - 1 && styles.regionRowLast,
                    isSelected && { backgroundColor: tier.color + '12' },
                  ]}
                  onPress={() => setSelected(prev => prev === r.region ? null : r.region)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.regionDot, { backgroundColor: tier.color }]} />
                  <Text style={styles.regionName}>{r.region}</Text>
                  <View style={styles.regionBarBg}>
                    <View style={[styles.regionBarFill, {
                      width: `${Math.min((r.psi / 350) * 100, 100)}%`,
                      backgroundColor: tier.color,
                    }]} />
                  </View>
                  <Text style={[styles.regionPsi, { color: tier.color }]}>{r.psi}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {error && <Text style={styles.errorNote}>⚠ {error}</Text>}
        <Text style={styles.source}>Source: NEA Singapore · data.gov.sg</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 14 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingTop: 20, paddingBottom: 8,
  },
  title: {
    fontFamily: MONO, fontSize: 20, fontWeight: '800',
    color: THEME.textPrimary, letterSpacing: 5,
  },
  subtitle: {
    fontFamily: MONO, fontSize: 11, color: THEME.textSecondary,
    letterSpacing: 2, marginTop: 3,
  },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: THEME.surface, borderWidth: 1, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
  },
  refreshIcon: { color: THEME.accent, fontSize: 19, fontWeight: '700' },

  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 14,
  },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBlip: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4CAF83' },
  updatedText: { fontFamily: MONO, fontSize: 11, color: THEME.textMuted, letterSpacing: 0.5 },

  nationalPill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: THEME.surface, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
  },
  nationalPillLabel: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: THEME.textMuted, fontWeight: '700' },
  nationalPillPsi: { fontFamily: MONO, fontSize: 18, fontWeight: '900' },
  nationalPillTier: { fontSize: 11 },

  mapCard: {
    backgroundColor: THEME.surface,
    borderRadius: 16, borderWidth: 1, borderColor: THEME.border,
    overflow: 'hidden', marginBottom: 12, alignItems: 'center',
    paddingBottom: 10,
  },
  mapHint: {
    fontFamily: MONO, fontSize: 10, color: THEME.textMuted,
    letterSpacing: 0.5, marginTop: 4,
  },

  // Detail panel
  panel: {
    flexDirection: 'row', backgroundColor: THEME.surface,
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
    marginBottom: 20,
  },
  panelStripe: { width: 4 },
  panelInner: { flex: 1, padding: 14, gap: 10 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  panelRegionName: { fontFamily: MONO, fontSize: 17, fontWeight: '800', letterSpacing: 2 },
  panelTierName: { color: THEME.textSecondary, fontSize: 12, marginTop: 2 },
  panelPsiBlock: { alignItems: 'flex-end' },
  panelPsiValue: { fontFamily: MONO, fontSize: 40, fontWeight: '900', lineHeight: 44 },
  panelPsiUnit: { fontFamily: MONO, fontSize: 10, letterSpacing: 3, color: THEME.textMuted },
  panelRule: { height: 1, backgroundColor: THEME.border },
  panelStatsRow: { flexDirection: 'row', gap: 22 },
  panelStatItem: { gap: 3 },
  panelStatKey: { fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: THEME.textMuted, fontWeight: '700' },
  panelStatVal: { fontFamily: MONO, fontSize: 15, fontWeight: '800', color: THEME.textPrimary },
  panelAdviceText: { color: THEME.textSecondary, fontSize: 12, lineHeight: 18 },
  panelCloseBtn: { padding: 14, justifyContent: 'flex-start' },
  panelCloseText: { color: THEME.textMuted, fontSize: 14 },

  // Region list
  section: { marginBottom: 24 },
  sectionLabel: {
    fontFamily: MONO, fontSize: 10, letterSpacing: 3,
    color: THEME.textMuted, fontWeight: '700', marginBottom: 10,
  },
  regionList: { backgroundColor: THEME.surface, borderRadius: 12, overflow: 'hidden' },
  regionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: THEME.border,
  },
  regionRowLast: { borderBottomWidth: 0 },
  regionDot: { width: 8, height: 8, borderRadius: 4 },
  regionName: { color: THEME.textPrimary, fontSize: 14, fontWeight: '600', width: 62 },
  regionBarBg: {
    flex: 1, height: 3, backgroundColor: THEME.surface2,
    borderRadius: 2, overflow: 'hidden',
  },
  regionBarFill: { height: 3, borderRadius: 2 },
  regionPsi: { fontFamily: MONO, fontSize: 16, fontWeight: '800', width: 34, textAlign: 'right' },

  errorNote: { color: '#E05A2B', fontSize: 12, textAlign: 'center', marginBottom: 12 },
  loadingText: { fontFamily: MONO, color: THEME.textSecondary, fontSize: 13, letterSpacing: 1 },
  source: {
    fontFamily: MONO, fontSize: 10, color: THEME.textMuted,
    textAlign: 'center', letterSpacing: 0.5, marginTop: 8,
  },
});