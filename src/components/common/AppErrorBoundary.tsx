import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from './ScreenContainer';
import { ErrorState } from './ErrorState';
import { PrimaryButton } from '../buttons/PrimaryButton';
import { useTheme } from '../../theme/useTheme';
import { fontSize, spacing } from '../../theme/layout';
import { useTranslation } from '../../localization/useTranslation';

interface BoundaryProps {
  children: React.ReactNode;
  // Called when the user leaves the recovery screen. The caller remounts the
  // navigator, which starts at Splash -- the single place that decides where
  // the user belongs (language / onboarding / auth / couple).
  onRecover: () => void;
}

interface BoundaryState {
  error: Error | null;
}

// Catches errors thrown while *rendering* the navigator and its screens
// (including lifecycle methods and constructors below it). Like every React
// error boundary it does NOT catch errors in event handlers, promises /
// async code, timers, or in the providers mounted above it -- those still
// need their own try/catch handling.
export class AppErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary] render error', error, info.componentStack);
  }

  private recover = () => {
    this.props.onRecover();
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return <RecoveryScreen error={this.state.error} onRecover={this.recover} />;
    }
    return this.props.children;
  }
}

// Nothing is cleared here: session, AsyncStorage data and settings are left
// untouched. Recovery only re-renders the app from Splash.
const RecoveryScreen = ({ error, onRecover }: { error: Error; onRecover: () => void }) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <ScreenContainer style={styles.container}>
      <ErrorState title={t('recovery.title')} message={t('recovery.message')} />
      <PrimaryButton label={t('recovery.returnToApp')} onPress={onRecover} />
      {__DEV__ && (
        <View style={styles.devDetails}>
          <Text style={[styles.devText, { color: colors.textSecondary }]} selectable>
            {error.message}
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  devDetails: {
    marginTop: spacing.lg,
  },
  devText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
});
