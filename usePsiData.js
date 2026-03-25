import { useState, useEffect, useCallback, useRef } from 'react';

// NEA / data.gov.sg real-time PSI endpoint
const PSI_URL = 'https://api.data.gov.sg/v1/environment/psi';
const PM25_URL = 'https://api.data.gov.sg/v1/environment/pm25';

const REGIONS = ['national', 'north', 'south', 'east', 'west', 'central'];
const DISPLAY_REGIONS = ['North', 'South', 'East', 'West', 'Central'];

function parseRegions(readings) {
  return DISPLAY_REGIONS.map((label) => {
    const key = label.toLowerCase();
    return {
      region: label,
      psi: Math.round(readings?.psi_twenty_four_hourly?.[key] ?? 0),
      pm25: Math.round(readings?.pm25_one_hourly?.[key] ?? 0),
    };
  });
}

export function usePsiData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!data) setLoading(true);

    try {
      const [psiRes, pm25Res] = await Promise.all([
        fetch(PSI_URL),
        fetch(PM25_URL),
      ]);

      if (!psiRes.ok) throw new Error(`PSI API error: ${psiRes.status}`);

      const psiJson = await psiRes.json();
      const pm25Json = pm25Res.ok ? await pm25Res.json() : null;

      const psiItem = psiJson?.items?.[0];
      const pm25Item = pm25Json?.items?.[0];

      if (!psiItem) throw new Error('No PSI data returned');

      const psiReadings = psiItem.readings;
      const pm25Readings = pm25Item?.readings ?? {};

      // Merge PSI + PM2.5 readings per region
      const regionData = DISPLAY_REGIONS.map((label) => {
        const key = label.toLowerCase();
        return {
          region: label,
          psi: Math.round(psiReadings?.psi_twenty_four_hourly?.[key] ?? 0),
          pm25: Math.round(pm25Readings?.pm25_one_hourly?.[key] ?? 0),
          psiThreeHour: Math.round(psiReadings?.psi_three_hourly?.[key] ?? 0),
        };
      });

      const nationalPsi = Math.round(
        psiReadings?.psi_twenty_four_hourly?.national ??
        Math.max(...regionData.map(r => r.psi))
      );

      setData({
        national: nationalPsi,
        regions: regionData,
        timestamp: psiItem.timestamp,
        updateTimestamp: psiItem.update_timestamp,
      });
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('PSI fetch error:', err);
      setError(err.message ?? 'Failed to fetch data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 5 minutes (NEA updates hourly, but poll more often)
    intervalRef.current = setInterval(() => fetchData(true), 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const refresh = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, refreshing, error, lastUpdated, refresh };
}

// Fetch hourly history — use date param for past 24h
export async function fetchPsiHistory() {
  const results = [];
  const now = new Date();

  // Fetch last 24 hours, 1 hour apart
  const promises = Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now - i * 60 * 60 * 1000);
    const dateStr = d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    return fetch(`${PSI_URL}?date_time=${encodeURIComponent(dateStr)}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
  });

  const responses = await Promise.all(promises);

  responses.forEach((json, i) => {
    const item = json?.items?.[0];
    if (!item) return;
    const d = new Date(now - i * 60 * 60 * 1000);
    const national = item.readings?.psi_twenty_four_hourly?.national ?? 0;
    results.push({
      hour: d.getHours(),
      label: d.toLocaleTimeString('en-SG', { hour: '2-digit', hour12: true }),
      psi: Math.round(national),
      timestamp: item.timestamp,
    });
  });

  // Sort chronologically
  return results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}
