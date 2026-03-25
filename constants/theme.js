import { Platform } from 'react-native';

export const THEME = {
  bg: '#0C0C0E',
  surface: '#111114',
  surface2: '#18181C',
  border: '#1E1E22',
  accent: '#F5A623',
  inactive: '#3A3A40',
  textPrimary: '#F0F0F0',
  textSecondary: '#888890',
  textMuted: '#444448',
  mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

export const PSI_TIERS = [
  {
    label: 'Good',
    range: [0, 50],
    color: '#4CAF83',
    bgTint: '#0D2318',
    description: 'Air quality is satisfactory.',
    advice: 'No precautions needed. Safe for all activities.',
    icon: '◎',
  },
  {
    label: 'Moderate',
    range: [51, 100],
    color: '#F5C842',
    bgTint: '#1F1A06',
    description: 'Acceptable air quality.',
    advice: 'Sensitive groups should limit prolonged outdoor exertion.',
    icon: '◑',
  },
  {
    label: 'Unhealthy (SG)',
    range: [101, 200],
    color: '#F5A623',
    bgTint: '#1F1006',
    description: 'Hazy conditions.',
    advice: 'Wear N95 mask outdoors. Reduce prolonged activity.',
    icon: '◕',
  },
  {
    label: 'Very Unhealthy',
    range: [201, 300],
    color: '#E05A2B',
    bgTint: '#200A00',
    description: 'Very hazy. Health effects likely.',
    advice: 'Stay indoors. Keep windows shut. Use air purifier.',
    icon: '●',
  },
  {
    label: 'Hazardous',
    range: [301, 500],
    color: '#C0392B',
    bgTint: '#1A0000',
    description: 'Emergency conditions.',
    advice: 'Do not go outdoors. Seek medical help if symptomatic.',
    icon: '⬤',
  },
];

export function getTier(psi) {
  if (psi == null) return PSI_TIERS[0];
  return PSI_TIERS.find(t => psi >= t.range[0] && psi <= t.range[1]) || PSI_TIERS[PSI_TIERS.length - 1];
}

export function formatTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}