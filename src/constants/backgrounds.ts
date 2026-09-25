import { Role } from '../types';

// The two hand-picked background images -- never regenerate/replace these,
// only these exact files. Old bg-male.png/bg-male1.png/bg-female.png are
// kept in the assets folder as a fallback, just no longer referenced from
// here.
export const backgroundImages: Record<Role, any> = {
  male: require('../../assets/backgrounds/bg-male12.png'),
  female: require('../../assets/backgrounds/bg-female1.png'),
};
