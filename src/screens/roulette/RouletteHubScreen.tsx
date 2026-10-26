import { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RouletteHub'>;

// The roulette section is now a single 20-sector wheel (WishRouletteScreen).
// The old "regular / intimate" picker is gone; this route is kept only so any
// existing navigate('RouletteHub') still lands on the one roulette. The
// intimate roulette screen stays registered -- it is where jackpot coupons
// are spent, reached from the wheel's "use coupon" button.
export const RouletteHubScreen = ({ navigation }: Props) => {
  useEffect(() => {
    navigation.replace('WishRoulette');
  }, [navigation]);
  return null;
};
