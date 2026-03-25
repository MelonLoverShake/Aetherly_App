import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Dimensions,
  Animated, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchPsiHistory } from '../hooks/usePsiData';
import { THEME, getTier } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_H = 200;
const CHART_W = SCREEN_W - 40; // horizontal padding

// ─── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ points }) {
  const maxPsi = Math.max(...points.map(p => p.psi), 200);
  const barWidth = Math.max(8, (CHART_W / points.length) - 3);
  const animValues = useRef(points.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      30,
      animValues.map((av, i) =>
        Animated.spring(av, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [points.length]);

  return (
    <View style={styles.chartWrap}>
      {/* Y-axis grid lines */}
      {[0, 50, 100, 200, 300].map(val => {
        const y = CHART_H - (val / maxPsi) * CHART_H;
        return (
          <View key={val} style={[styles.gridLine, { bottom: (val / maxPsi) * CHART_H }]}>
            <Text style={styles.gridLabel}>{val}</Text>
          </View>
        );
      })}

      {/* Bars */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.barsScroll}>
        <View style={[styles.barsRow, { height: CHART_H }]}>
          {points.map((p, i) => {
            const tier = getTier(p.psi);
            const barH = animValues[i].interpolate({
              inputRange: [0, 1],
              outputRange: [0, Math.max(4, (p.psi / maxPsi) * CHART_H)],
            });
            return (
              <View key={i} style={[styles.barCol, { width: barWidth + 3 }]}>
                <View style={styles.barWrapper}>
                  <Animated.View
                    style={[styles.bar, {
                      width: barWidth,
                      height: barH,
                      backgroundColor: tier.color,
                      shadowColor: tier.color,
                    }]}
                  />
                </View>
                <Text style={styles.barHour}>{p.label}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: color || THEME.textPrimary }]}>{value ?? '—'}</Text>
    </View>
  );
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await fetchPsiHistory();
      setHistory(data);
      setLastUpdated(new Date());
      setError(null);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const stats = history.length > 0 ? {
    min: Math.min(...history.map(p => p.psi)),
    max: Math.max(...history.map(p => p.psi)),
    avg: Math.round(history.reduce((s, p) => s + p.psi, 0) / history.length),
    current: history[history.length - 1]?.psi,
  } : null;

  const currentTier = getTier(stats?.current);
  const maxTier = getTier(stats?.max);

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top']}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={styles.loadingText}>Loading 24h history…</Text>
        <Text style={styles.loadingNote}>Fetching hourly readings from NEA</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>HISTORY</Text>
            <Text style={styles.subtitle}>24-Hour National PSI</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => load(true)}
            disabled={refreshing}
            activeOpacity={0.6}
          >
            {refreshing
              ? <ActivityIndicator size="small" color={THEME.accent} />
              : <Text style={styles.refreshIcon}>↻</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        {stats && (
          <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
            <StatCard label="NOW" value={stats.current} color={currentTier.color} />
            <StatCard label="24H AVG" value={stats.avg} color={THEME.accent} />
            <StatCard label="PEAK" value={stats.max} color={maxTier.color} />
            <StatCard label="LOW" value={stats.min} color="#4CAF83" />
          </Animated.View>
        )}

        {/* Chart */}
        {history.length > 0 && (
          <Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
            <Text style={styles.sectionLabel}>HOURLY TREND</Text>
            <BarChart points={history} />
            <Text style={styles.chartNote}>← Scroll to view all hours</Text>
          </Animated.View>
        )}

        {/* Tier breakdown */}
        {stats && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.sectionLabel}>PEAK ADVISORY</Text>
            <View style={[styles.advisory, { borderLeftColor: maxTier.color }]}>
              <Text style={styles.advisoryLabel}>Highest reading today</Text>
              <Text style={[styles.advisoryPsi, { color: maxTier.color }]}>{stats.max} PSI</Text>
              <Text style={styles.advisoryTier}>{maxTier.label}</Text>
              <Text style={styles.advisoryAdvice}>{maxTier.advice}</Text>
            </View>
          </Animated.View>
        )}

        {/* History list */}
        {history.length > 0 && (
          <Animated.View style={{ opacity: fadeAnim }}>
            <Text style={styles.sectionLabel}>HOURLY LOG</Text>
            <View style={styles.logList}>
              {[...history].reverse().map((p, i) => {
                const t = getTier(p.psi);
                return (
                  <View key={i} style={styles.logRow}>
                    <Text style={styles.logTime}>{p.label}</Text>
                    <View style={[styles.logBar, { width: `${Math.min((p.psi / 300) * 60, 60)}%`, backgroundColor: t.color + '33' }]}>
                      <View style={[styles.logBarFill, { width: '100%', backgroundColor: t.color }]} />
                    </View>
                    <Text style={[styles.logPsi, { color: t.color }]}>{p.psi}</Text>
                    <Text style={[styles.logTier, { color: t.color + '88' }]}>{t.label.split(' ')[0]}</Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {error && (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>⚠ {error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
              <Text style={styles.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.source}>Source: NEA Singapore · data.gov.sg · 24H PSI readings</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  center: { justifyContent: 'center', alignItems: 'center', gap: 10 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingBottom: 14,
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
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: THEME.surface,
    borderWidth: 1, borderColor: THEME.border,
    justifyContent: 'center', alignItems: 'center',
  },
  refreshIcon: { color: THEME.accent, fontSize: 19, fontWeight: '700' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.surface,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontFamily: THEME.mono,
    fontSize: 8,
    letterSpacing: 2,
    color: THEME.textMuted,
    fontWeight: '700',
  },
  statValue: {
    fontFamily: THEME.mono,
    fontSize: 22,
    fontWeight: '900',
  },

  // Chart
  chartCard: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 3,
    color: THEME.textMuted,
    fontWeight: '700',
    marginBottom: 12,
  },
  chartWrap: {
    height: CHART_H + 32,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: THEME.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridLabel: {
    fontFamily: THEME.mono,
    fontSize: 9,
    color: THEME.textMuted,
    position: 'absolute',
    left: 0,
    top: -10,
  },
  barsScroll: { marginLeft: 28 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: 24,
  },
  barCol: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 4,
  },
  barHour: {
    fontFamily: THEME.mono,
    fontSize: 8,
    color: THEME.textMuted,
    marginTop: 4,
    transform: [{ rotate: '-45deg' }],
    width: 36,
    textAlign: 'center',
  },
  chartNote: {
    fontFamily: THEME.mono,
    fontSize: 10,
    color: THEME.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // Advisory
  advisory: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    marginBottom: 24,
    gap: 4,
  },
  advisoryLabel: {
    fontFamily: THEME.mono,
    fontSize: 10,
    letterSpacing: 2,
    color: THEME.textMuted,
  },
  advisoryPsi: {
    fontFamily: THEME.mono,
    fontSize: 36,
    fontWeight: '900',
  },
  advisoryTier: { color: THEME.textSecondary, fontSize: 14, fontWeight: '600' },
  advisoryAdvice: { color: THEME.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },

  // Log
  logList: {
    backgroundColor: THEME.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
    gap: 8,
  },
  logTime: {
    fontFamily: THEME.mono,
    fontSize: 11,
    color: THEME.textMuted,
    width: 54,
  },
  logBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  logBarFill: { height: 4, borderRadius: 2 },
  logPsi: {
    fontFamily: THEME.mono,
    fontSize: 15,
    fontWeight: '800',
    width: 34,
    textAlign: 'right',
  },
  logTier: {
    fontFamily: THEME.mono,
    fontSize: 10,
    width: 70,
  },

  // Error
  errorWrap: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  errorText: { color: '#E05A2B', fontSize: 13, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 8, borderWidth: 1, borderColor: THEME.accent,
  },
  retryText: {
    fontFamily: THEME.mono, color: THEME.accent,
    fontSize: 12, letterSpacing: 2, fontWeight: '700',
  },

  loadingText: { fontFamily: THEME.mono, color: THEME.textSecondary, fontSize: 13, letterSpacing: 1 },
  loadingNote: { fontFamily: THEME.mono, color: THEME.textMuted, fontSize: 11, letterSpacing: 0.5 },

  source: {
    fontFamily: THEME.mono, fontSize: 10,
    color: THEME.textMuted, textAlign: 'center',
    letterSpacing: 0.5, marginTop: 24,
  },
});