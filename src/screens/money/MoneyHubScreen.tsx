import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/types';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { ScreenHeader } from '../../components/common/ScreenHeader';
import { FilterTabs } from '../../components/common/FilterTabs';
import { useTranslation } from '../../localization/useTranslation';
import { BudgetBody } from '../budget/BudgetScreen';
import { ExpenseHistoryBody } from '../expenses/ExpenseHistoryScreen';
import { ShoppingListBody } from '../shopping/ShoppingListScreen';
import { SavingsGoalBody } from '../savings/SavingsGoalScreen';
import { FairSplitBody } from '../expenses/FairSplitScreen';
import { MoneySummaryBody } from '../budget/MoneySummaryScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'MoneyHub'>;
type Tab = 'budget' | 'expenses' | 'shopping' | 'savings' | 'fairSplit' | 'summary';

export const MoneyHubScreen = ({ navigation }: Props) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('budget');

  const tabs = [
    { key: 'budget', label: t('hubs.moneyTabBudget') },
    { key: 'expenses', label: t('hubs.moneyTabExpenses') },
    { key: 'shopping', label: t('hubs.moneyTabShopping') },
    { key: 'savings', label: t('hubs.moneyTabSavings') },
    { key: 'fairSplit', label: t('hubs.moneyTabFairSplit') },
    { key: 'summary', label: t('hubs.moneyTabSummary') },
  ];

  return (
    <ScreenContainer>
      <ScreenHeader title={t('hubs.moneyTitle')} onBack={() => navigation.goBack()} />
      <FilterTabs options={tabs} value={tab} onChange={(key) => setTab(key as Tab)} />
      {tab === 'budget' && <BudgetBody />}
      {tab === 'expenses' && <ExpenseHistoryBody />}
      {tab === 'shopping' && <ShoppingListBody />}
      {tab === 'savings' && <SavingsGoalBody />}
      {tab === 'fairSplit' && <FairSplitBody />}
      {tab === 'summary' && <MoneySummaryBody />}
    </ScreenContainer>
  );
};
