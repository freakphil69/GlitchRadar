import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

import { AutoScan } from "@/src/components/AutoScan";
import { usesNativeTabs } from "@/src/navigation";
import { fonts, useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();

  if (usesNativeTabs) {
    return (
      <>
        <AutoScan />
        <NativeTabs tintColor={colors.brandPrimary}>
          <NativeTabs.Trigger name="index">
            <NativeTabs.Trigger.Icon sf="radar" />
            <NativeTabs.Trigger.Label>Radar</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="scout">
            <NativeTabs.Trigger.Icon sf="magnifyingglass" />
            <NativeTabs.Trigger.Label>Scout</NativeTabs.Trigger.Label>
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
      </>
    );
  }

  return (
    <>
      <AutoScan />
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
        <Tabs.Screen
          name="scout"
          options={{
            title: "SCOUT",
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="access-point" size={22} color={color} />,
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
            tabBarIcon: ({ color }) => <MaterialCommunityIcons name="settings" size={22} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
