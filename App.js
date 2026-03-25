import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Text, View, Platform } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import MapScreen from './screens/MapScreen';
import HistoryScreen from './screens/HistoryScreen';
import RouteAirQualityScreen from './screens/RouteAirQualityScreen';
import IndoorAirScreen from './screens/IndoorAirScreen';

const Tab = createBottomTabNavigator();

const THEME = {
  bg: '#0C0C0E',
  tabBar: '#111114',
  border: '#1E1E22',
  accent: '#F5A623',
  inactive: '#3A3A40',
  mono: Platform.OS === 'ios' ? 'Courier New' : 'monospace',
};

const TAB_ICONS = {
  Home:    { active: '◉', inactive: '○', label: 'AIR' },
  Map:     { active: '▣', inactive: '□', label: 'MAP' },
  Route:   { active: '⬡', inactive: '⬢', label: 'ROUTE' },
  Indoor:  { active: '⌂', inactive: '⌂', label: 'INDOOR' },
  History: { active: '▤', inactive: '≡', label: 'LOG' },
};

function TabIcon({ name, focused }) {
  const icon = TAB_ICONS[name];
  const color = focused ? THEME.accent : THEME.inactive;
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ fontSize: 18, color, fontFamily: THEME.mono }}>
        {focused ? icon.active : icon.inactive}
      </Text>
      <Text style={{ fontSize: 9, color, letterSpacing: 1.5, fontFamily: THEME.mono }}>
        {icon.label}
      </Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={THEME.bg} />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: THEME.accent,
            background: THEME.bg,
            card: THEME.tabBar,
            text: '#FFFFFF',
            border: THEME.border,
            notification: THEME.accent,
          },
        }}
      >
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarIcon: ({ focused }) => (
              <TabIcon name={route.name} focused={focused} />
            ),
            tabBarActiveTintColor: THEME.accent,
            tabBarInactiveTintColor: THEME.inactive,
            tabBarShowLabel: false,
            tabBarStyle: {
              backgroundColor: THEME.tabBar,
              borderTopColor: THEME.border,
              borderTopWidth: 1,
              height: Platform.OS === 'ios' ? 84 : 64,
              paddingBottom: Platform.OS === 'ios' ? 24 : 10,
              paddingTop: 10,
            },
          })}
        >
          <Tab.Screen name="Home"    component={HomeScreen} />
          <Tab.Screen name="Map"     component={MapScreen} />
          <Tab.Screen name="Route"   component={RouteAirQualityScreen} />
          <Tab.Screen name="Indoor"  component={IndoorAirScreen} />
          <Tab.Screen name="History" component={HistoryScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}