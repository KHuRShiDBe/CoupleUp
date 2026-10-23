import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { useTheme } from '../theme/useTheme';
import { iconColors } from '../theme/iconColors';
import { radius } from '../theme/layout';
import { IconImage } from '../components/common/IconImage';
import { Badge } from '../components/common/Badge';
import { useChat } from '../store/ChatContext';
import { IconName } from '../types';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ChatScreen } from '../screens/chat/ChatScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  Home: 'home',
  Chat: 'chat',
  Settings: 'settings',
};

// Fixed-size wrap so the icon/label gap never shifts between the focused and
// unfocused state, and so Badge (absolutely positioned) has a stable anchor
// -- no background/shadow/circle behind the icon's WRAP, just layout (the
// pill backdrop below lives one level deeper, inside this fixed wrap, so it
// never changes the tab bar's own size).
const ICON_WRAP_SIZE = 40;
const ICON_SIZE = 24;
const ICON_SIZE_ACTIVE = 26;

// Neutral gray for every unfocused tab, same in both themes -- only the
// focused tab picks up the role's accent color (iconColors[role].primary),
// per spec ("male/female theme можно учитывать только в accent color").
const INACTIVE_COLOR = '#AEB8C4';

const TabIcon = ({ name, focused, badgeCount }: { name: IconName; focused: boolean; badgeCount?: number }) => {
  const { role, colors } = useTheme();
  const activeColor = iconColors[role].primary;
  return (
    <View style={styles.iconWrap}>
      {/* Soft accent-tinted pill behind the active icon only -- subtle
          (uses the theme's own low-opacity `glow` color), sized to fit
          inside the existing fixed-size wrap so it adds no extra layout
          space. */}
      <View style={[styles.iconPill, focused && { backgroundColor: colors.glow }]}>
        <IconImage name={name} size={focused ? ICON_SIZE_ACTIVE : ICON_SIZE} color={focused ? activeColor : INACTIVE_COLOR} />
      </View>
      {!!badgeCount && <Badge count={badgeCount} />}
    </View>
  );
};

const TabLabel = ({ label, focused, color }: { label: string; focused: boolean; color: string }) => (
  <Text style={[styles.label, { color, fontWeight: focused ? '800' : '600' }]} numberOfLines={1}>
    {label}
  </Text>
);

export const MainTabNavigator = () => {
  const { role } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadCount: chatUnreadCount } = useChat();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: iconColors[role].primary,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          // Same white as the screen background (ScreenBackground.tsx) --
          // no separate colored/grey backdrop, just a hairline top border
          // for a bit of separation from the content above it.
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(0, 0, 0, 0.08)',
          height: 68 + insets.bottom,
          paddingBottom: Math.max(12, insets.bottom + 8),
          paddingTop: 10,
          paddingHorizontal: 8,
        },
        tabBarItemStyle: styles.item,
        tabBarIcon: ({ focused }) => (
          <TabIcon name={TAB_ICONS[route.name]} focused={focused} badgeCount={route.name === 'Chat' ? chatUnreadCount : undefined} />
        ),
        tabBarLabel: ({ focused, color, children }) => <TabLabel label={children} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="Chat" component={ChatScreen} options={{ title: 'Чат' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Настройки' }} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  iconWrap: {
    width: ICON_WRAP_SIZE,
    height: ICON_WRAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconPill: {
    width: ICON_WRAP_SIZE,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
  },
});
