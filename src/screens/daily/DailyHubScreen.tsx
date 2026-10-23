import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenBackground } from '../../components/common/ScreenBackground';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useTranslation } from '../../localization/useTranslation';
import { DailyTasksBody } from './DailyTasksScreen';
import { DailyCalendarBody } from './DailyCalendarScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'DailyHub'>;
type Tab = 'actions' | 'calendar';

export const DailyHubScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('actions');

  const tabs = [
    { key: 'actions', label: t('hubs.dailyTabActions') },
    { key: 'calendar', label: t('hubs.dailyTabCalendar') },
  ];

  return (
    <ScreenBackground>
    <ScreenContainer transparent>
      <ScreenHeader title={t('hubs.dailyTitle')} onBack={() => navigation.goBack()} />
      <FilterTabs options={tabs} value={tab} onChange={(key) => setTab(key as Tab)} />
      {tab === 'actions' && <DailyTasksBody navigation={navigation} />}
      {tab === 'calendar' && <DailyCalendarBody />}
    </ScreenContainer></ScreenBackground>
  );
};
