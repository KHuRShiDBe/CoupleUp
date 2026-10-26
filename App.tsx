import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from './src/store/AppContext';
import { AuthProvider } from './src/store/AuthContext';
import { CoupleSyncProvider } from './src/store/CoupleSyncContext';
import { BondProvider } from './src/store/BondContext';
import { CoupleInteractionProvider } from './src/store/CoupleInteractionContext';
import { PlanningProvider } from './src/store/PlanningContext';
import { BudgetProvider } from './src/store/BudgetContext';
import { ProgressionProvider } from './src/store/ProgressionContext';
import { NotificationsProvider } from './src/store/NotificationsContext';
import { RemindersProvider } from './src/store/RemindersContext';
import { WishlistProvider } from './src/store/WishlistContext';
import { GamesProvider } from './src/store/GamesContext';
import { DailyActionsProvider } from './src/store/DailyActionsContext';
import { QuestsProvider } from './src/store/QuestsContext';
import { CoupleOffersProvider } from './src/store/CoupleOffersContext';
import { IntimateRouletteProvider } from './src/store/IntimateRouletteContext';
import { ShopRouletteProvider } from './src/store/ShopRouletteContext';
import { WishRouletteProvider } from './src/store/WishRouletteContext';
import { ChatProvider } from './src/store/ChatContext';
import { useProfileAutoSync } from './src/store/useProfileAutoSync';
import { RootNavigator } from './src/navigation/RootNavigator';
import { InAppNotificationBanner } from './src/components/notifications/InAppNotificationBanner';
import { AppErrorBoundary } from './src/components/common/AppErrorBoundary';
import { PartnerPrizeUseModal } from './src/components/notifications/PartnerPrizeUseModal';

const AppShell = () => {
  useProfileAutoSync();
  // Bumped on recovery so the navigator remounts from Splash with fresh
  // navigation state; providers above (session, stored data) are untouched.
  const [navigatorKey, setNavigatorKey] = useState(0);
  return (
    <>
      <StatusBar style="dark" />
      <AppErrorBoundary onRecover={() => setNavigatorKey((k) => k + 1)}>
        <RootNavigator key={navigatorKey} />
        <InAppNotificationBanner />
        <PartnerPrizeUseModal />
      </AppErrorBoundary>
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <AuthProvider>
          <CoupleSyncProvider>
            <BondProvider>
              <CoupleInteractionProvider>
                <PlanningProvider>
                  <BudgetProvider>
                    <ProgressionProvider>
                      <NotificationsProvider>
                        <RemindersProvider>
                          <WishlistProvider>
                            <GamesProvider>
                              <DailyActionsProvider>
                                <QuestsProvider>
                                  <CoupleOffersProvider>
                                    <IntimateRouletteProvider>
                                      <ShopRouletteProvider>
                                        <WishRouletteProvider>
                                          <ChatProvider>
                                            <AppShell />
                                          </ChatProvider>
                                        </WishRouletteProvider>
                                      </ShopRouletteProvider>
                                    </IntimateRouletteProvider>
                                  </CoupleOffersProvider>
                                </QuestsProvider>
                              </DailyActionsProvider>
                            </GamesProvider>
                          </WishlistProvider>
                        </RemindersProvider>
                      </NotificationsProvider>
                    </ProgressionProvider>
                  </BudgetProvider>
                </PlanningProvider>
              </CoupleInteractionProvider>
            </BondProvider>
          </CoupleSyncProvider>
        </AuthProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}
