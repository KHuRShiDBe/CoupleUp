import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ICON_GLYPHS } from '../../constants/iconGlyphs';
import { useTheme } from '../../theme/useTheme';
import { iconColors } from '../../theme/iconColors';
import { IconName } from '../../types';

interface Props {
  name: IconName;
  size?: number;
  style?: StyleProp<TextStyle>;
  // Overrides the role-based tint (blue for male, pink for female) --
  // only needed for the rare case of an icon sitting on a solid-color
  // background (see AppIconScreen's preview swatches).
  color?: string;
}

export const IconImage = ({ name, size = 24, style, color }: Props) => {
  const { role } = useTheme();
  return (
    <Ionicons
      name={ICON_GLYPHS[name]}
      size={size}
      color={color ?? iconColors[role].primary}
      style={style}
    />
  );
};
