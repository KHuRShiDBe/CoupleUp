import { Platform } from 'react-native';
import Constants from 'expo-constants';

// This file must NEVER import expo-notifications, directly or transitively --
// the whole point is that pushService.ts can check the environment *before*
// deciding whether it's safe to even load that module. Only expo-constants
// and react-native's Platform are touched here, both safe everywhere.

// True for Expo Go specifically (not a custom dev client, which also reports
// executionEnvironment "storeClient"). appOwnership is deprecated in favor of
// executionEnvironment, but executionEnvironment can't tell Expo Go and a dev
// client apart -- appOwnership is the only reliable signal for that.
export const isExpoGo = (): boolean => Constants.appOwnership === 'expo';

// Since SDK 53, expo-notifications' Android push machinery was removed from
// Expo Go -- on that specific combination, even loading the native module
// (not just calling getExpoPushTokenAsync) can crash the app at startup.
// This is the single source of truth for "don't touch expo-notifications here".
export const isUnsupportedPushEnvironment = (): boolean => isExpoGo() && Platform.OS === 'android';
