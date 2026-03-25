import React, { useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Animated, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePsiData } from '../hooks/usePsiData';
import { THEME, getTier, formatTime } from '../constants/theme';

// ─── Gauge ─────────────────────────────────────────────────────────────────────

function PsiGauge({ psi, tier }) {
  const animVal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (psi == null) return;
    Animated.spring(animVal, {
      toValue: Math.min(psi / 400, 1),
      tension: 35,
      friction: 9,
      useNativeDriver: false,
    }).start();
  }, [psi]);

  const needleRotate = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '90deg'],
  });

  // Arc segment colours behind needle
  const arcColors = ['#3FB950', '#E3B341', '#FF9500', '#F85149'];

  return (
    <View style={styles.gaugeWrap}>
      {/* Coloured arc hint */}
      <View style={styles.arcRow}>
        {arcColors.map((c, i) => (
          <View key={i} style={[styles.arcSegment, { backgroundColor: c + '33' }]} />
        ))}
      </View>

      {/* Ring decorations */}
      <View style={[styles.gaugeRingOuter, { borderColor: tier.color + '18' }]} />
      <View style={[styles.gaugeRingInner, { borderColor: tier.color + '30' }]} />

      {/* Needle */}
      <Animated.View
        style={[styles.needle, {
          backgroundColor: tier.color,
          shadowColor: tier.color,
          transform: [{ rotate: needleRotate }],
        }]}
      />

      {/* Center readout */}
      <View style={styles.gaugeFace}>
        <Text style={[styles.gaugeValue, { color: tier.color }]}>{psi ?? '—'}</Text>
        <Text style={styles.gaugeUnit}>PSI</Text>
        <View style={[styles.statusPill, { backgroundColor: tier.color + '22', borderColor: tier.color + '55' }]}>
          <Text style={[styles.statusText, { color: tier.color }]}>
            {tier.icon}  {tier.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Route Shortcut Card ───────────────────────────────────────────────────────

function RouteShortcut({ psi, onPress }) {
  const tier = getTier(psi);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Suggest indoor routing when PSI is elevated
  const suggestion = psi == null
    ? 'Check route air quality'
    : psi > 100
    ? 'High PSI · Try indoor route'
    : psi > 50
    ? 'Moderate · Cleaner path available'
    : 'Air is clean · Good to go';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Animated.View style={[styles.routeCard, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.routeCardLeft}>
          <Text style={styles.routeCardIcon}>🗺</Text>
          <View>
            <Text style={styles.routeCardTitle}>ROUTE AIR QUALITY</Text>
            <Text style={styles.routeCardSub}>{suggestion}</Text>
          </View>
        </View>
        <View style={[styles.routeCardBadge, { backgroundColor: tier.color + '22', borderColor: tier.color + '55' }]}>
          <Text style={[styles.routeCardBadgeText, { color: tier.color }]}>
            {psi ?? '—'}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Indoor Shortcut Card ─────────────────────────────────────────────────────

function IndoorShortcut({ psi, onPress }) {
  const modifier = 0.7; // default HDB estimate
  const indoorAqi = Math.round((psi ?? 80) * modifier);
  const tier = getTier(indoorAqi);

  const suggestion = psi == null
    ? 'Estimate your indoor air quality'
    : psi > 100
    ? `Indoor est. AQI ~${indoorAqi} · Action needed`
    : psi > 50
    ? `Indoor est. AQI ~${indoorAqi} · Check purifier`
    : `Indoor est. AQI ~${indoorAqi} · Looking good`;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{ marginTop: -4, marginBottom: 20 }}>
      <View style={[styles.indoorCard, { borderColor: tier.color + '44' }]}>
        <Text style={styles.indoorCardIcon}>🏠</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.indoorCardTitle}>INDOOR AIR ESTIMATOR</Text>
          <Text style={styles.indoorCardSub}>{suggestion}</Text>
        </View>
        <View style={[styles.indoorCardBadge, { backgroundColor: tier.color + '22', borderColor: tier.color + '55' }]}>
          <Text style={[styles.indoorCardBadgeText, { color: tier.color }]}>{indoorAqi}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Region Row ────────────────────────────────────────────────────────────────

function RegionRow({ region, psi, pm25, index }) {
  const tier = getTier(psi);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 80,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.regionRow, { opacity: fadeAnim }]}>
      <View style={styles.regionLeft}>
        <View style={[styles.regionDot, { backgroundColor: tier.color }]} />
        <Text style={styles.regionName}>{region}</Text>
      </View>
      <View style={styles.regionRight}>
        {pm25 > 0 && (
          <Text style={styles.pm25Label}>
            PM2.5 <Text style={{ color: THEME.textSecondary }}>{pm25}</Text>
          </Text>
        )}
        <View style={styles.regionBarWrap}>
          <View style={styles.regionBarBg}>
            <View style={[styles.regionBarFill, {
              width: `${Math.min((psi / 400) * 100, 100)}%`,
              backgroundColor: tier.color,
            }]} />
          </View>
          <Text style={[styles.regionPsi, { color: tier.color }]}>{psi}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Error State ───────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }) {
  return (
    <View style={styles.errorWrap}>
      <Text style={styles.errorIcon}>⚠</Text>
      <Text style={styles.errorTitle}>Could not load data</Text>
      <Text style={styles.errorMsg}>{message}</Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>RETRY</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { data, loading, refreshing, error, lastUpdated, refresh } = usePsiData();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (data) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
  }, [data]);

  const tier = getTier(data?.national);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={styles.loadingText}>Reading the air…</Text>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <ErrorState message={error} onRetry={refresh} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: THEME.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>HAZE WATCH</Text>
            <Text style={styles.subtitle}>Singapore · 24H PSI</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={refresh}
            disabled={refreshing}
            activeOpacity={0.6}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={THEME.accent} />
              : <Text style={styles.refreshIcon}>↻</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Gauge ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <PsiGauge psi={data?.national} tier={tier} />
        </Animated.View>

        {/* ── Timestamp ── */}
        <Animated.View style={[styles.updatedRow, { opacity: fadeAnim }]}>
          <View style={[styles.liveBlip, error ? { backgroundColor: '#E05A2B' } : {}]} />
          <Text style={styles.updatedText}>
            {error ? 'Error refreshing · ' : 'Updated '}
            {formatTime(lastUpdated)}
          </Text>
        </Animated.View>

        {/* ── Route shortcut ── */}
        <Animated.View style={{ opacity: fadeAnim, marginBottom: 20 }}>
          <RouteShortcut
            psi={data?.national}
            onPress={() => navigation.navigate('Route')}
          />
        </Animated.View>

        {/* ── Indoor shortcut ── */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <IndoorShortcut
            psi={data?.national}
            onPress={() => navigation.navigate('Indoor', { psi: data?.national })}
          />
        </Animated.View>

        {/* ── Health advisory ── */}
        <Animated.View style={[styles.advisory, { borderLeftColor: tier.color, opacity: fadeAnim }]}>
          <Text style={styles.advisoryHeader}>HEALTH ADVISORY</Text>
          <Text style={styles.advisoryDesc}>{tier.description}</Text>
          <Text style={[styles.advisoryAdvice, { color: tier.color }]}>{tier.advice}</Text>
        </Animated.View>

        {/* ── Regional breakdown ── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>REGIONAL PSI</Text>
          <View style={styles.regionList}>
            {data?.regions?.map((r, i) => (
              <RegionRow
                key={r.region}
                region={r.region}
                psi={r.psi}
                pm25={r.pm25}
                index={i}
              />
            ))}
          </View>
        </Animated.View>

        {/* ── Scale legend ── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionLabel}>SCALE</Text>
          <View style={styles.scaleRow}>
            {[0, 50, 100, 200, 300, 400].map((v) => {
              const t = getTier(v);
              return (
                <View key={v} style={styles.scaleTick}>
                  <View style={[styles.scaleDot, { backgroundColor: t.color }]} />
                  <Text style={styles.scaleVal}>{v}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        <Text style={styles.source}>Source: data.gov.sg · NEA Singapore</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: 14 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingBottom: 4,
  },
  title: {
    fontFamily: THEME.mono,
    fontSize: 20,
    fontWeight: '800',
    color: THEME.textPrimary,
    letterSpacing: 5,
  },
  subtitle: {
    fontFamily: THEME.mono,
    fontSize: 11,
    color: THEME.textSecondary,
    letterSpacing: 2,
    marginTop: 3,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshIcon: { color: THEME.accent, fontSize: 19, fontWeight: '700' },

  // Gauge
  gaugeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 230,
    marginTop: 16,
    marginBottom: 4,
  },
  arcRow: {
    position: 'absolute',
    flexDirection: 'row',
    width: 220,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    top: '50%',
  },
  arcSegment: { flex: 1 },
  gaugeRingOuter: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
  },
  gaugeRingInner: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
  },
  needle: {
    position: 'absolute',
    width: 2,
    height: 80,
    borderRadius: 1,
    bottom: '50%',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
    transformOrigin: 'bottom',
  },
  gaugeFace: {
    alignItems: 'center',
    marginTop: 20,
  },
  gaugeValue: {
    fontFamily: THEME.mono,
    fontSize: 62,
    fontWeight: '900',
    lineHeight: 66,
  },
  gaugeUnit: {
    fontFamily: THEME.mono,
    fontSize: 12,
    letterSpacing: 4,
    color: THEME.textMuted,
    marginBottom: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: THEME.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Timestamp
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 10,
    marginBottom: 20,
  },
  liveBlip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF83',
  },
  updatedText: {
    fontFamily: THEME.mono,
    fontSize: 11,
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },

  // Route shortcut card
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F5A62333',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  routeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  routeCardIcon: { fontSize: 22 },
  routeCardTitle: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.accent,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  routeCardSub: {
    fontSize: 13,
    color: THEME.textPrimary,
    marginTop: 2,
    fontWeight: '500',
  },
  routeCardBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: 'center',
  },
  routeCardBadgeText: {
    fontFamily: THEME.mono,
    fontSize: 16,
    fontWeight: '900',
  },

  // Indoor shortcut card
  indoorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  indoorCardIcon:  { fontSize: 22 },
  indoorCardTitle: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: '#58A6FF',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  indoorCardSub: { fontSize: 13, color: THEME.textPrimary, marginTop: 2, fontWeight: '500' },
  indoorCardBadge: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: 'center',
  },
  indoorCardBadgeText: { fontFamily: THEME.mono, fontSize: 16, fontWeight: '900' },

  // Advisory
  advisory: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    marginBottom: 24,
    gap: 6,
  },
  advisoryHeader: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 2.5,
    color: THEME.textSecondary,
    fontWeight: '700',
  },
  advisoryDesc: {
    fontSize: 14,
    color: THEME.textPrimary,
    lineHeight: 20,
  },
  advisoryAdvice: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Section
  section: { marginBottom: 28 },
  sectionLabel: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: THEME.textMuted,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Region rows
  regionList: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },
  regionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: 90,
  },
  regionDot: { width: 8, height: 8, borderRadius: 4 },
  regionName: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  regionRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  pm25Label: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.textMuted,
    letterSpacing: 0.5,
  },
  regionBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    justifyContent: 'flex-end',
  },
  regionBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: THEME.surface2,
    borderRadius: 2,
    overflow: 'hidden',
    maxWidth: 120,
  },
  regionBarFill: { height: 3, borderRadius: 2 },
  regionPsi: {
    fontFamily: THEME.mono,
    fontSize: 16,
    fontWeight: '800',
    width: 36,
    textAlign: 'right',
  },

  // Scale
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
  },
  scaleTick: { alignItems: 'center', gap: 5 },
  scaleDot: { width: 8, height: 8, borderRadius: 4 },
  scaleVal: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.textMuted,
  },

  // Error
  errorWrap: { alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  errorIcon: { fontSize: 36, color: '#E05A2B' },
  errorTitle: { color: THEME.textPrimary, fontSize: 16, fontWeight: '700' },
  errorMsg: { color: THEME.textSecondary, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.accent,
  },
  retryText: {
    fontFamily: THEME.mono,
    color: THEME.accent,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },

  loadingText: {
    fontFamily: THEME.mono,
    color: THEME.textSecondary,
    fontSize: 13,
    letterSpacing: 1,
  },
  source: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
    marginTop: 4,
  },
});