import { Role } from '../types';

// The two Home wishlist-card icons, picked by role.
export const wishlistIcons: Record<Role, any> = {
  // Swapped to new icons -- old assets/wishlist/{male,female}-wishlist-icon.png
  // kept on disk, unused. Despite its "female-draft" filename,
  // female-draft-purple1.png is the intended MALE icon here (confirmed with
  // the user -- it's the blue checklist-with-bow-tie image).
  male: require('../../assets/png/female-draft-purple1.png'),
  female: require('../../assets/png/female-wishlist-icon1.png'),
};
