import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/AuthContext";
import type { RootStackParamList } from "./src/navigation";
import AuthScreen from "./src/screens/AuthScreen";
import PoolDetailScreen from "./src/screens/PoolDetailScreen";
import PoolsScreen from "./src/screens/PoolsScreen";
import TicketsScreen from "./src/screens/TicketsScreen";
import WalletScreen from "./src/screens/WalletScreen";
import { OfficialRulesScreen, TermsOfServiceScreen, PrivacyPolicyScreen } from "./src/screens/LegalScreens";
import { colors } from "./src/theme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.accent,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "800", color: focused ? colors.accent : colors.textMuted }}>
      {label}
    </Text>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused }) => <TabIcon label={routeLabel(route.name)} focused={focused} />,
        tabBarLabelStyle: { fontWeight: "700" },
      })}
    >
      <Tab.Screen name="Pools" component={PoolsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Wallet" component={WalletScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Tickets" component={TicketsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function routeLabel(name: string): string {
  if (name === "Pools") return "◆";
  if (name === "Wallet") return "$";
  return "▤";
}

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash}>
        <Text style={styles.brand}>A STACK'D</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {!session ? (
        <>
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
          <Stack.Screen name="OfficialRules" component={OfficialRulesScreen} options={{ title: "Official Rules" }} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ title: "Terms of Service" }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: "Privacy Policy" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          <Stack.Screen name="PoolDetail" component={PoolDetailScreen} options={{ title: "Pool" }} />
          <Stack.Screen name="OfficialRules" component={OfficialRulesScreen} options={{ title: "Official Rules" }} />
          <Stack.Screen name="TermsOfService" component={TermsOfServiceScreen} options={{ title: "Terms of Service" }} />
          <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} options={{ title: "Privacy Policy" }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme}>
        <AuthProvider>
          <StatusBar style="light" />
          <Root />
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" },
  brand: { color: colors.accent, fontSize: 36, fontWeight: "900", letterSpacing: 2 },
});
