import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';

// This file must NEVER import expo-notifications, directly or transitively --
// the whole point is that pushService.ts can check the environment *before*
// deciding whether it's safe to even load that module. Only expo,
// expo-constants and react-native's Platform are touched here, all safe
// everywhere.

// True for Expo Go specifically (not a dev client or a release build).
// isRunningInExpoGo() checks for Expo Go's own native module, so it can't be
// fooled by a dev client. The deprecated appOwnership check is kept only as a
// fallback: in SDK 58 Expo Go it no longer reports 'expo', which let
// expo-notifications load on Android and crash on its missing
// ExpoTopicSubscriptionModule native module.
export const isExpoGo = (): boolean => isRunningInExpoGo() || Constants.appOwnership === 'expo';

// Since SDK 53, expo-notifications' Android push machinery was removed from
// Expo Go -- on that specific combination, even loading the native module
// (not just calling getExpoPushTokenAsync) can crash the app at startup.
// This is the single source of truth for "don't touch expo-notifications here".
export const isUnsupportedPushEnvironment = (): boolean => isExpoGo() && Platform.OS === 'android';
