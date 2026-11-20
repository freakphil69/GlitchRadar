import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <NativeTabs tintColor={colors.brandPrimary}>
        <NativeTabs.Trigger name="index">
          <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" />
          <NativeTabs.Trigger.Label>Radar</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="markets"><NativeTabs.Trigger.Icon sf="cart" /><NativeTabs.Trigger.Label>Märkte</NativeTabs.Trigger.Label></NativeTabs.Trigger>
        <NativeTabs.Trigger name="codes">
          <NativeTabs.Trigger.Icon sf="ticket" />
          <NativeTabs.Trigger.Label>Codes</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="stash">
          <NativeTabs.Trigger.Icon sf="archivebox" />
          <NativeTabs.Trigger.Label>Stash</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="terminal">
          <NativeTabs.Trigger.Icon sf="gearshape" />
          <NativeTabs.Trigger.Label>Terminal</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    );
  }

  return (
    <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.brandPrimary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            ...(Platform.OS === "web" ? { height: 64 } : {}),
          },
          tabBarItemStyle: { alignSelf: "center" },
          tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.mono, letterSpacing: 1 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "RADAR",
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="radar" size={22} color={color} />,
          }}
        />
        <Tabs.Screen name="markets" options={{ title: "MÄRKTE", tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cart" size={22} color={color} /> }} />
        <Tabs.Screen
          name="codes"
          options={{
            title: "CODES",
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="ticket-percent" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="stash"
          options={{
            title: "STASH",
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="archive" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="terminal"
          options={{
            title: "TERMINAL",
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="cog" size={22} color={color} />,
          }}
        />
      </Tabs>
  );
}
