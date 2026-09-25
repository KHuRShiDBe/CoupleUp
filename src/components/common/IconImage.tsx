import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { getIcon } from '../../constants/assets';
import { useTheme } from '../../theme/useTheme';
import { IconName } from '../../types';

interface Props {
  name: IconName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export const IconImage = ({ name, size = 24, style }: Props) => {
  const { role } = useTheme();
  return (
    <Image
      source={getIcon(role, name)}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
};
