import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList } from './types';
import { useTheme } from '../theme/useTheme';
import { getIcon } from '../constants/assets';
import { IconName } from '../types';
import { Badge } from '../components/common/Badge';
import { useNotifications } from '../store/NotificationsContext';
import { maleHomeDark } from '../theme/maleHomeDark';
import { HomeScreen } from '../screens/home/HomeScreen';
import { AddActionScreen } from '../screens/actions/AddActionScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, IconName> = {
  Home: 'home',
  Add: 'add',
  Notifications: 'notification',
};

// Fixed-size wrap so the icon/label gap never shifts between the focused and
// unfocused state -- only what's inside the wrap (icon size + glow) changes.
const ICON_WRAP_SIZE = 48;
const ICON_SIZE = 34;
const ICON_SIZE_ACTIVE = 38;

const TabIcon = ({ name, focused, badgeCount }: { name: IconName; focused: boolean; badgeCount?: number }) => {
  const { colors, role } = useTheme();
  const dark = role === 'male';
  return (
    <View
      style={[
        styles.iconWrap,
        focused && [
          styles.iconWrapActive,
          { backgroundColor: dark ? maleHomeDark.cardBgAlt : colors.background, shadowColor: dark ? maleHomeDark.accent : colors.primary },
        ],
      ]}
    >
      <Image
        source={getIcon(role, name)}
        style={{
          width: focused ? ICON_SIZE_ACTIVE : ICON_SIZE,
          height: focused ? ICON_SIZE_ACTIVE : ICON_SIZE,
          opacity: focused ? 1 : 0.5,
        }}
        resizeMode="contain"
      />
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
  const { colors, role } = useTheme();
  const dark = role === 'male';
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: dark ? maleHomeDark.accent : colors.primary,
        tabBarInactiveTintColor: dark ? maleHomeDark.textSecondary : colors.textSecondary,
        tabBarStyle: {
          backgroundColor: dark ? maleHomeDark.tabBarBg : colors.card,
          borderTopColor: dark ? maleHomeDark.tabBarBorder : colors.border,
          height: 68 + insets.bottom,
          paddingBottom: Math.max(12, insets.bottom + 8),
          paddingTop: 10,
          paddingHorizontal: 8,
        },
        tabBarItemStyle: styles.item,
        tabBarIcon: ({ focused }) => (
          <TabIcon
            name={TAB_ICONS[route.name]}
            focused={focused}
            badgeCount={route.name === 'Notifications' ? unreadCount : undefined}
          />
        ),
        tabBarLabel: ({ focused, color, children }) => <TabLabel label={children} focused={focused} color={color} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Главная' }} />
      <Tab.Screen name="Add" component={AddActionScreen} options={{ title: 'Договоры' }} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
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
    borderRadius: ICON_WRAP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconWrapActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  label: {
    fontSize: 11,
  },
});
