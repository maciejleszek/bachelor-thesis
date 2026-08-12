import { Ionicons } from "@expo/vector-icons";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import DashboardScreen from "../screens/DashboardScreen";
import SleepScreen from "../screens/SleepScreen";
import SportScreen from "../screens/SportScreen";
import AnalysisScreen from "../screens/AnalysisScreen";
import SurveyScreen from "../screens/SurveyScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../theme/colors";

export type TabParamList = {
  Dashboard: undefined;
  Sleep: undefined;
  Sport: undefined;
  Analysis: undefined;
  Survey: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const ICONS: Record<keyof TabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: "speedometer-outline",
  Sleep: "moon-outline",
  Sport: "walk-outline",
  Analysis: "analytics-outline",
  Survey: "happy-outline",
  Settings: "settings-outline",
};

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    border: colors.border,
    text: colors.text,
    primary: colors.accent,
  },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={ICONS[route.name as keyof TabParamList]} size={size} color={color} />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Dashboard" }} />
        <Tab.Screen name="Sleep" component={SleepScreen} options={{ title: "Sen" }} />
        <Tab.Screen name="Sport" component={SportScreen} options={{ title: "Sport" }} />
        <Tab.Screen name="Analysis" component={AnalysisScreen} options={{ title: "Analiza" }} />
        <Tab.Screen name="Survey" component={SurveyScreen} options={{ title: "Ankieta" }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "Ustawienia" }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
