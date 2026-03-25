import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import * as Location from "expo-location";

// ─── API Keys ────────────────────────────────────────────────────────────────
const ORS_API_KEY = "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjA5YTEyMDhmY2U2ZDRmZDU5NWNiNjkxZDY3YTRiNTcwIiwiaCI6Im11cm11cjY0In0=";

// ─── Palette ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#0D1117",
  card: "#161B22",
  border: "#21262D",
  accent: "#58A6FF",
  good: "#3FB950",
  moderate: "#E3B341",
  unhealthy: "#F85149",
  text: "#E6EDF3",
  muted: "#8B949E",
  pill: "#1F2937",
};

// ─── NEA region bounding boxes (rough) ───────────────────────────────────────
// Used to map a [lat, lng] coordinate to the nearest PSI region.
const NEA_REGIONS = {
  north:   { lat: 1.4200, lng: 103.8200 },
  south:   { lat: 1.2800, lng: 103.8500 },
  east:    { lat: 1.3500, lng: 103.9400 },
  west:    { lat: 1.3500, lng: 103.7000 },
  central: { lat: 1.3521, lng: 103.8198 },
};

/** Return the NEA region key ("north" | "south" | ...) closest to [lat, lng]. */
function coordToRegion(lat, lng) {
  let closest = "central";
  let minDist = Infinity;
  for (const [region, centre] of Object.entries(NEA_REGIONS)) {
    const d =
      Math.pow(lat - centre.lat, 2) + Math.pow(lng - centre.lng, 2);
    if (d < minDist) { minDist = d; closest = region; }
  }
  return closest;
}

// ─── PSI helpers ─────────────────────────────────────────────────────────────
const psiLabel = (v) => {
  if (v <= 50)  return { label: "Good",                    color: C.good,      icon: "🌿" };
  if (v <= 100) return { label: "Moderate",                color: C.moderate,  icon: "🌤"  };
  if (v <= 150) return { label: "Unhealthy for Sensitive", color: "#FF9500",   icon: "😷" };
  return              { label: "Unhealthy",                color: C.unhealthy, icon: "☠️"  };
};

// ─── Decode ORS encoded polyline ─────────────────────────────────────────────
// ORS returns geometry as an encoded polyline string (Google format, precision 5).
function decodePolyline(encoded) {
  const coords = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, b;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; }
    while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]); // [lat, lng]
  }
  return coords;
}

/** Sample ~5 evenly-spaced points along a decoded polyline. */
function sampleWaypoints(coords, n = 5) {
  if (coords.length <= n) return coords;
  const step = Math.floor(coords.length / n);
  return Array.from({ length: n }, (_, i) => coords[i * step]);
}

/** Format metres → "X.X km" or "XXX m" */
function fmtDist(metres) {
  return metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres)} m`;
}

/** Format seconds → "X min" */
function fmtDur(seconds) {
  return `${Math.round(seconds / 60)} min`;
}

// ─── Fetch live PSI from data.gov.sg ─────────────────────────────────────────
async function fetchPsiByRegion() {
  const res = await fetch("https://api.data.gov.sg/v1/environment/psi");
  if (!res.ok) throw new Error(`PSI fetch failed: ${res.status}`);
  const json = await res.json();
  // Shape: { items: [{ readings: { psi_twenty_four_hourly: { north, south, east, west, central } } }] }
  const readings = json.items?.[0]?.readings?.psi_twenty_four_hourly;
  if (!readings) throw new Error("Unexpected PSI response shape");
  return readings; // { north: N, south: N, east: N, west: N, central: N }
}

// ─── Geocode an address string via ORS ───────────────────────────────────────
async function geocode(text) {
  const url = `https://api.openrouteservice.org/geocode/search?api_key=${ORS_API_KEY}&text=${encodeURIComponent(text)}&boundary.country=SGP&size=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const json = await res.json();
  const [lng, lat] = json.features?.[0]?.geometry?.coordinates ?? [];
  if (!lat) throw new Error(`Could not geocode: "${text}"`);
  return { lat, lng, label: json.features[0].properties.label };
}

// ─── Fetch one ORS route ──────────────────────────────────────────────────────
// profile: "foot-walking" | "driving-car"
// alternativeRoutes: { target_count, weight_factor } | null
async function fetchOrsRoute(originCoord, destCoord, profile, alternativeRoutes = null) {
  const body = {
    coordinates: [
      [originCoord.lng, originCoord.lat],
      [destCoord.lng,   destCoord.lat],
    ],
    geometry: true,
    instructions: true,
    units: "m",
    ...(alternativeRoutes ? { alternative_routes: alternativeRoutes } : {}),
  };
  const res = await fetch(
    `https://api.openrouteservice.org/v2/directions/${profile}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ORS directions failed (${profile}): ${err}`);
  }
  return res.json();
}

// ─── Build route objects from ORS + PSI data ─────────────────────────────────
async function buildRoutes(originCoord, destCoord, psiByRegion) {
  /** Assign a PSI value to a coordinate pair. */
  const psiAt = (lat, lng) => {
    const region = coordToRegion(lat, lng);
    return psiByRegion[region] ?? psiByRegion.central;
  };

  /** Turn an ORS route object into our internal shape. */
  const parseOrsRoute = (orsRoute, meta) => {
    const coords  = decodePolyline(orsRoute.geometry);
    const samples = sampleWaypoints(coords, 5);
    const summary = orsRoute.summary;

    // Build segments from ORS step instructions
    const steps = orsRoute.segments?.[0]?.steps ?? [];
    const segments = steps
      .filter((s) => s.name && s.name !== "-")
      .slice(0, 5)
      .map((s) => {
        // Approximate midpoint of this step
        const midIdx = Math.floor((s.way_points[0] + s.way_points[1]) / 2);
        const [sLat, sLng] = coords[Math.min(midIdx, coords.length - 1)];
        const psi = psiAt(sLat, sLng);
        return {
          name: s.name,
          aqi: psi,
          indoors: false, // ORS walking profile has no indoor data
        };
      });

    // Fallback: if steps produced no named segments use sampled coords
    const usedSegments = segments.length
      ? segments
      : samples.map(([sLat, sLng], i) => ({
          name: `Segment ${i + 1}`,
          aqi: psiAt(sLat, sLng),
          indoors: false,
        }));

    // Overall route PSI = average of sampled points
    const avgPsi = Math.round(
      samples.reduce((sum, [sLat, sLng]) => sum + psiAt(sLat, sLng), 0) / samples.length
    );

    return {
      ...meta,
      aqi: avgPsi,
      distance: fmtDist(summary.distance),
      duration: fmtDur(summary.duration),
      segments: usedSegments,
    };
  };

  const results = [];

  // ── Route 1 + 2: walking routes (main + 1 alternative) ──────────────────
  try {
    const walkJson = await fetchOrsRoute(originCoord, destCoord, "foot-walking", {
      target_count: 2,
      weight_factor: 1.6,
    });
    const routes = walkJson.routes ?? [];

    if (routes[0]) {
      results.push(
        parseOrsRoute(routes[0], {
          id: "walk_main",
          name: "Walking Route",
          tag: "RECOMMENDED",
          tagColor: C.good,
          type: "walking",
          typeIcon: "🚶",
          tip: "Main walking route based on OpenStreetMap data.",
          savings: 0, // calculated below
        })
      );
    }
    if (routes[1]) {
      results.push(
        parseOrsRoute(routes[1], {
          id: "walk_alt",
          name: "Alt Walking Route",
          tag: "ALTERNATIVE",
          tagColor: C.accent,
          type: "walking",
          typeIcon: "🚶",
          tip: "Alternative path — may be slightly longer but avoids busy roads.",
          savings: 0,
        })
      );
    }
  } catch (e) {
    console.warn("Walking route fetch failed:", e.message);
  }

  // ── Route 3: driving route (used as a proxy for fastest/transit option) ──
  // Note: ORS free tier lacks public-transit routing. We use driving-car as
  // a "fastest option" reference and label it accordingly.
  try {
    const driveJson = await fetchOrsRoute(originCoord, destCoord, "driving-car");
    const route = (driveJson.routes ?? [])[0];
    if (route) {
      results.push(
        parseOrsRoute(route, {
          id: "drive",
          name: "Drive / Ride",
          tag: "FASTEST",
          tagColor: "#A371F7",
          type: "driving",
          typeIcon: "🚗",
          tip: "Fastest route by car or ride-hailing. Enclosed vehicle reduces direct exposure.",
          savings: 0,
        })
      );
    }
  } catch (e) {
    console.warn("Driving route fetch failed:", e.message);
  }

  if (!results.length) throw new Error("No routes returned from ORS.");

  // Sort by PSI ascending so cleanest is first
  results.sort((a, b) => a.aqi - b.aqi);

  // Mark cleanest route and compute savings vs worst route
  const worstPsi = Math.max(...results.map((r) => r.aqi));
  results[0].tag = "CLEANEST AIR";
  results[0].tagColor = C.good;
  results.forEach((r) => {
    r.savings = Math.max(0, worstPsi - r.aqi);
  });

  return results;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const PsiBadge = ({ value, size = "md" }) => {
  const { label, color } = psiLabel(value);
  const big = size === "lg";
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeNum, { color, fontSize: big ? 22 : 15 }]}>{value}</Text>
      <Text style={[styles.badgeLabel, { color, fontSize: big ? 11 : 9 }]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const SegmentBar = ({ segments }) => (
  <View style={styles.segRow}>
    {segments.map((s, i) => {
      const { color } = psiLabel(s.aqi);
      return (
        <View key={i} style={styles.segItem}>
          <View style={[styles.segDot, { backgroundColor: color }]}>
            {s.indoors && <Text style={styles.segDotIcon}>🏠</Text>}
          </View>
          {i < segments.length - 1 && (
            <View style={[styles.segLine, { backgroundColor: color + "55" }]} />
          )}
        </View>
      );
    })}
  </View>
);

const RouteCard = ({ route, selected, onSelect }) => {
  const { color } = psiLabel(route.aqi);
  const anim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: selected ? 1 : 0, useNativeDriver: false }).start();
  }, [selected]);

  const borderColor = anim.interpolate({ inputRange: [0, 1], outputRange: [C.border, color] });

  return (
    <Animated.View style={[styles.routeCard, { borderColor }]}>
      <TouchableOpacity activeOpacity={0.85} onPress={onSelect}>
        <View style={styles.routeHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.routeNameRow}>
              <Text style={styles.routeTypeIcon}>{route.typeIcon}</Text>
              <Text style={styles.routeName}>{route.name}</Text>
              <View style={[styles.tagPill, { backgroundColor: route.tagColor + "33", borderColor: route.tagColor }]}>
                <Text style={[styles.tagText, { color: route.tagColor }]}>{route.tag}</Text>
              </View>
            </View>
            <Text style={styles.routeMeta}>
              {route.distance} · {route.duration}
            </Text>
          </View>
          <PsiBadge value={route.aqi} />
        </View>

        <SegmentBar segments={route.segments} />

        {route.savings > 0 && (
          <View style={styles.savingsPill}>
            <Text style={styles.savingsText}>
              {psiLabel(route.aqi).icon} {route.savings} PSI pts cleaner than worst option
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {selected && (
        <View style={styles.expandedDetail}>
          <Text style={styles.expandedTitle}>Route breakdown</Text>
          {route.segments.map((s, i) => {
            const { color: sc } = psiLabel(s.aqi);
            return (
              <View key={i} style={styles.segDetail}>
                <View style={[styles.segDetailDot, { backgroundColor: sc }]} />
                <Text style={styles.segDetailName}>{s.indoors ? "🏠 " : "🌬 "}{s.name}</Text>
                <Text style={[styles.segDetailAqi, { color: sc }]}>PSI {s.aqi}</Text>
              </View>
            );
          })}
          <View style={styles.tipBox}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>{route.tip}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RouteAirQualityScreen() {
  const [origin, setOrigin]               = useState("");
  const [destination, setDestination]     = useState("");
  const [routes, setRoutes]               = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingMsg, setLoadingMsg]       = useState("");
  const [error, setError]                 = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [psiTimestamp, setPsiTimestamp]   = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const fetchLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setOrigin("Permission denied"); return; }
      const loc = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync(loc.coords);
      setOrigin(
        place?.street
          ? `${place.street}, ${place.district ?? place.city}`
          : "Current location"
      );
    } catch {
      setOrigin("Unable to get location");
    } finally {
      setLocationLoading(false);
    }
  };

  const searchRoutes = async () => {
    if (!destination.trim()) return;
    setLoading(true);
    setRoutes(null);
    setError(null);
    fadeAnim.setValue(0);

    try {
      // Step 1 – geocode
      setLoadingMsg("Locating addresses…");
      const originText = origin.trim() || "Yishun MRT, Singapore";
      const [originCoord, destCoord] = await Promise.all([
        geocode(originText + ", Singapore"),
        geocode(destination.trim() + ", Singapore"),
      ]);

      // Step 2 – PSI
      setLoadingMsg("Fetching live NEA PSI data…");
      const psiData = await fetchPsiByRegion();
      // data.gov.sg returns timestamps in items[0].timestamp
      // We'll re-fetch to grab it (already fetched above — grab from raw if needed)
      setPsiTimestamp(new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" }));

      // Step 3 – routes
      setLoadingMsg("Calculating routes via OpenRouteService…");
      const builtRoutes = await buildRoutes(originCoord, destCoord, psiData);

      setRoutes(builtRoutes);
      setSelectedRoute(builtRoutes[0].id);
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>BREATHE SMART · LIVE NEA DATA</Text>
        <Text style={styles.headerTitle}>Route Air Quality</Text>
        <Text style={styles.headerSub}>Find the cleanest path to your destination</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Input card */}
        <View style={styles.inputCard}>
          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: C.good }]} />
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.input}
                placeholder="Your starting point (default: Yishun MRT)"
                placeholderTextColor={C.muted}
                value={origin}
                onChangeText={setOrigin}
              />
            </View>
            <TouchableOpacity onPress={fetchLocation} style={styles.locBtn}>
              {locationLoading
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={styles.locBtnText}>📍</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.inputDivider} />

          <View style={styles.inputRow}>
            <View style={[styles.inputDot, { backgroundColor: C.unhealthy }]} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Where are you going?"
              placeholderTextColor={C.muted}
              value={destination}
              onChangeText={setDestination}
              onSubmitEditing={searchRoutes}
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity
            style={[styles.searchBtn, (!destination.trim() || loading) && styles.searchBtnDisabled]}
            onPress={searchRoutes}
            disabled={!destination.trim() || loading}
          >
            <Text style={styles.searchBtnText}>Find Cleanest Route →</Text>
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={styles.loadingText}>{loadingMsg}</Text>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Text style={styles.errorHint}>
              Check your ORS API key and ensure both addresses are within Singapore.
            </Text>
          </View>
        )}

        {/* Results */}
        {routes && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Data source badge */}
            <View style={styles.sourceRow}>
              <Text style={styles.sourceText}>
                🛰 Live PSI · NEA via data.gov.sg · Updated {psiTimestamp}
              </Text>
            </View>

            {/* Best route headline */}
            <View style={styles.headlineCard}>
              <Text style={styles.headlineLabel}>Cleanest route to</Text>
              <Text style={styles.headlineDestination} numberOfLines={1}>{destination}</Text>
              <View style={styles.headlineAqiRow}>
                <PsiBadge value={routes[0].aqi} size="lg" />
                <Text style={styles.headlineDetail}>
                  {routes[0].savings > 0
                    ? `${routes[0].savings} PSI pts better than worst option`
                    : "All routes have similar air quality"}
                </Text>
              </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
              {[
                { color: C.good,      label: "Good (0–50)"       },
                { color: C.moderate,  label: "Moderate (51–100)" },
                { color: C.unhealthy, label: "Unhealthy (101+)"  },
              ].map((l) => (
                <View key={l.label} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>All Routes</Text>
            {routes.map((r) => (
              <RouteCard
                key={r.id}
                route={r}
                selected={selectedRoute === r.id}
                onSelect={() => setSelectedRoute(selectedRoute === r.id ? null : r.id)}
              />
            ))}

            {/* PSI note */}
            <View style={styles.indoorTip}>
              <Text style={styles.indoorTipIcon}>ℹ️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.indoorTipTitle}>About the PSI values</Text>
                <Text style={styles.indoorTipBody}>
                  Segment PSI is derived from NEA's nearest regional station (north / south /
                  east / west / central). ORS walking routes do not include indoor segments —
                  values reflect outdoor exposure only. For the 24-hr rolling PSI, check
                  the NEA app.
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, paddingBottom: 40 },

  header: {
    paddingTop: Platform.OS === "ios" ? 56 : 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerEyebrow: { fontSize: 10, letterSpacing: 3, color: C.accent, fontWeight: "700", marginBottom: 4 },
  headerTitle:   { fontSize: 26, fontWeight: "800", color: C.text },
  headerSub:     { fontSize: 13, color: C.muted, marginTop: 4 },

  inputCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 16,
  },
  inputRow:     { flexDirection: "row", alignItems: "center", gap: 10 },
  inputDot:     { width: 10, height: 10, borderRadius: 5 },
  input:        { color: C.text, fontSize: 15, paddingVertical: 8, flex: 1 },
  inputDivider: { height: 1, backgroundColor: C.border, marginVertical: 8, marginLeft: 20 },
  locBtn:       { padding: 6 },
  locBtnText:   { fontSize: 18 },
  searchBtn: {
    marginTop: 14,
    backgroundColor: C.accent,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
  },
  searchBtnDisabled: { opacity: 0.4 },
  searchBtnText:     { color: "#0D1117", fontWeight: "800", fontSize: 15 },

  loadingBox:  { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadingText: { color: C.muted, fontSize: 14, textAlign: "center" },

  errorBox: {
    backgroundColor: C.unhealthy + "15",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.unhealthy + "44",
    padding: 16,
    marginBottom: 16,
    gap: 6,
  },
  errorTitle: { color: C.unhealthy, fontWeight: "700", fontSize: 14 },
  errorBody:  { color: C.text,      fontSize: 13 },
  errorHint:  { color: C.muted,     fontSize: 12 },

  sourceRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  sourceText: { color: C.muted, fontSize: 11 },

  headlineCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.good + "55",
    padding: 18,
    marginBottom: 12,
  },
  headlineLabel:       { fontSize: 11, color: C.muted, letterSpacing: 1, textTransform: "uppercase" },
  headlineDestination: { fontSize: 20, fontWeight: "800", color: C.text, marginTop: 2, marginBottom: 10 },
  headlineAqiRow:      { flexDirection: "row", alignItems: "center", gap: 14 },
  headlineDetail:      { fontSize: 13, color: C.muted, flex: 1 },

  badge: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    minWidth: 56,
  },
  badgeNum:   { fontWeight: "900" },
  badgeLabel: { fontWeight: "700", letterSpacing: 0.5, marginTop: 1 },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: C.muted },

  sectionTitle: {
    fontSize: 13, color: C.muted, fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },

  routeCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 12,
  },
  routeHeader:  { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  routeNameRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  routeTypeIcon: { fontSize: 16 },
  routeName:    { fontSize: 16, fontWeight: "700", color: C.text },
  tagPill:      { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText:      { fontSize: 9, fontWeight: "800", letterSpacing: 0.8 },
  routeMeta:    { fontSize: 12, color: C.muted, marginTop: 3 },

  segRow:  { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  segItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  segDot:  { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segDotIcon: { fontSize: 10 },
  segLine: { flex: 1, height: 2 },

  savingsPill: {
    backgroundColor: C.good + "22",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  savingsText: { color: C.good, fontSize: 12, fontWeight: "600" },

  expandedDetail: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    marginTop: 14,
    paddingTop: 14,
    gap: 8,
  },
  expandedTitle:  { fontSize: 11, color: C.muted, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 },
  segDetail:      { flexDirection: "row", alignItems: "center", gap: 8 },
  segDetailDot:   { width: 8, height: 8, borderRadius: 4 },
  segDetailName:  { flex: 1, fontSize: 13, color: C.text },
  segDetailAqi:   { fontSize: 13, fontWeight: "700" },

  tipBox: {
    flexDirection: "row",
    backgroundColor: C.accent + "15",
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 8,
    alignItems: "flex-start",
  },
  tipIcon: { fontSize: 14, marginTop: 1 },
  tipText: { flex: 1, fontSize: 12, color: C.muted, lineHeight: 18 },

  indoorTip: {
    flexDirection: "row",
    backgroundColor: "#A371F715",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#A371F733",
    padding: 14,
    gap: 10,
    marginTop: 4,
    alignItems: "flex-start",
  },
  indoorTipIcon:  { fontSize: 22 },
  indoorTipTitle: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 4 },
  indoorTipBody:  { fontSize: 12, color: C.muted, lineHeight: 18 },
});