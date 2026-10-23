import { Role } from '../types';

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

export const getAvatar = (role: Role, _avatarId: number) => fixedAvatarImages[role];
