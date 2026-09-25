import { IconName, Role } from '../types';

export const icons: Record<Role, Record<IconName, any>> = {
  male: {
    // Swapped to the new set (male account only -- female icons untouched):
    // home/add/notification/back from assets/male/*1.png. Old files kept on
    // disk, unused.
    home: require('../../assets/male/home1.png'),
    history: require('../../assets/male/history.png'),
    add: require('../../assets/male/Add1.png'),
    rewards: require('../../assets/male/rewards.png'),
    profile: require('../../assets/male/profile.png'),
    settings: require('../../assets/male/settings.png'),
    notification: require('../../assets/male/notification1.png'),
    message: require('../../assets/male/message.png'),
    tasks: require('../../assets/male/tasks.png'),
    achievement: require('../../assets/male/achievement.png'),
    back: require('../../assets/male/back1.png'),
    pair: require('../../assets/male/pair.png'),
    goal: require('../../assets/male/goal.png'),
    shop: require('../../assets/male/shop.png'),
    lock: require('../../assets/male/lock.png'),
    periodDaily: require('../../assets/png/male-daily1.png'),
    periodWeekly: require('../../assets/periods/male/weekly.png'),
    periodMonthly: require('../../assets/periods/male/monthly.png'),
    periodYearly: require('../../assets/periods/male/yearly.png'),
  },
  female: {
    // Swapped to the new set (female account only -- male icons untouched):
    // home/add/notification/back from assets/female/*1.png, periodDaily
    // from assets/png/female-daily1.png. Old files kept on disk, unused.
    home: require('../../assets/female/home1.png'),
    history: require('../../assets/female/history.png'),
    add: require('../../assets/female/Add1.png'),
    rewards: require('../../assets/female/rewards.png'),
    profile: require('../../assets/female/profile.png'),
    settings: require('../../assets/female/settings.png'),
    notification: require('../../assets/female/notification1.png'),
    message: require('../../assets/female/message.png'),
    tasks: require('../../assets/female/tasks.png'),
    achievement: require('../../assets/female/achievement.png'),
    back: require('../../assets/female/back1.png'),
    pair: require('../../assets/female/pair.png'),
    goal: require('../../assets/female/goal.png'),
    shop: require('../../assets/female/shop.png'),
    lock: require('../../assets/female/lock.png'),
    periodDaily: require('../../assets/png/female-daily1.png'),
    periodWeekly: require('../../assets/periods/female/weekly.png'),
    periodMonthly: require('../../assets/periods/female/monthly.png'),
    periodYearly: require('../../assets/periods/female/yearly.png'),
  },
};

// Only one avatar per role is offered now -- the old 10-per-role catalog
// (assets/avatars/{male,female}/1..10.png) is gone except the two files
// still kept (male/4.png, female/3.png). See RoleSelectionScreen.tsx, which
// sets this immediately and skips AvatarSelectionScreen in the onboarding
// flow. getAvatar() below ignores whatever avatarId is stored (including
// old values from before this change) and always returns the fixed image
// for that role, so no data migration is needed for existing users.
export const FIXED_AVATAR_ID: Record<Role, number> = {
  male: 4,
  female: 3,
};

const fixedAvatarImages: Record<Role, any> = {
  male: require('../../assets/avatars/male/4.png'),
  female: require('../../assets/avatars/female/3.png'),
};

export const logo = require('../../assets/app-icon/logo.png');

export const roleImages: Record<Role, any> = {
  male: require('../../assets/onboarding/male-role.png'),
  female: require('../../assets/onboarding/female-role.png'),
};

export const getIcon = (role: Role, name: IconName) => icons[role][name];
export const getAvatar = (role: Role, _avatarId: number) => fixedAvatarImages[role];
