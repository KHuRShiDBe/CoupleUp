import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useTranslation } from '../../localization/useTranslation';
import { CoupleStatsBody } from '../couple/CoupleStatsScreen';
import { DailyDigestBody } from '../digest/DailyDigestScreen';
import { WeeklyDigestBody } from '../digest/WeeklyDigestScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'Analytics'>;
type Tab = 'stats' | 'daily' | 'weekly';

export const AnalyticsScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('stats');

  const tabs = [
    { key: 'stats', label: t('hubs.analyticsTabStats') },
    { key: 'daily', label: t('hubs.analyticsTabDaily') },
    { key: 'weekly', label: t('hubs.analyticsTabWeekly') },
  ];

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('hubs.analyticsTitle')} onBack={() => navigation.goBack()} />
      <FilterTabs options={tabs} value={tab} onChange={(key) => setTab(key as Tab)} />
      {tab === 'stats' && <CoupleStatsBody />}
      {tab === 'daily' && <DailyDigestBody />}
      {tab === 'weekly' && <WeeklyDigestBody />}
    </ScreenContainer></ScreenBackground>
  );
};
