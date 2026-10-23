import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { getTheme } from '../../theme/colors';
import { Role } from '../../types';
import { getAvatar } from '../../constants/assets';

interface Props {
  role: Role;
  avatarId: number | null;
  // A real uploaded profile photo, when set, always wins over the fixed
  // per-role avatar image -- see SettingsScreen's photo upload flow.
  photoUrl?: string | null;
  size?: number;
  selected?: boolean;
  showCheck?: boolean;
}

export const Avatar = ({ role, avatarId, photoUrl, size = 64, selected = false, showCheck = false }: Props) => {
  const colors = getTheme(role);
  const source = photoUrl ? { uri: photoUrl } : avatarId ? getAvatar(role, avatarId) : null;

  return (
    <View
      style={[
        styles.wrapper,
        { width: size, height: size },
        selected && {
          shadowColor: colors.primary,
          shadowOpacity: 0.5,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
      ]}
    >
      <View
        style={[
          styles.clip,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: selected ? colors.primary : colors.border,
            borderWidth: selected ? 3 : 2,
          },
        ]}
      >
        {source ? (
          <Image source={source} style={{ width: size, height: size }} />
        ) : (
          <View style={[styles.placeholder, { width: size, height: size, backgroundColor: colors.border }]} />
        )}
      </View>
      {showCheck && selected && (
        <View style={[styles.check, { backgroundColor: colors.primary, borderColor: colors.card }]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clip: {
    overflow: 'hidden',
  },
  placeholder: {
    borderRadius: 999,
  },
  check: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
  },
});
