import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useTranslation } from '../../localization/useTranslation';
import { MomentsBody } from '../moments/MomentsScreen';
import { ImportantDatesBody } from '../dates/ImportantDatesScreen';
import { SharedGoalsBody } from '../goals/SharedGoalsScreen';
import { PromisesBody } from '../promises/PromisesScreen';
import { HabitsBody } from '../habits/HabitsScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CoupleModules'>;
type Tab = 'moments' | 'dates' | 'goals' | 'promises' | 'habits';

export const CoupleModulesScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('moments');

  const tabs = [
    { key: 'moments', label: t('hubs.coupleModulesTabMoments') },
    { key: 'dates', label: t('hubs.coupleModulesTabDates') },
    { key: 'goals', label: t('hubs.coupleModulesTabGoals') },
    { key: 'promises', label: t('hubs.coupleModulesTabPromises') },
    { key: 'habits', label: t('hubs.coupleModulesTabHabits') },
  ];

  return (
    <ScreenContainer>
      <ScreenHeader title={t('hubs.coupleModulesTitle')} onBack={() => navigation.goBack()} />
      <FilterTabs options={tabs} value={tab} onChange={(key) => setTab(key as Tab)} />
      {tab === 'moments' && <MomentsBody />}
      {tab === 'dates' && <ImportantDatesBody />}
      {tab === 'goals' && <SharedGoalsBody />}
      {tab === 'promises' && <PromisesBody />}
      {tab === 'habits' && <HabitsBody />}
    </ScreenContainer>
  );
};
