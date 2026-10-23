import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { navigationRef } from './navigationRef';
import { MainTabNavigator } from './MainTabNavigator';
import { HistoryScreen } from '../screens/history/HistoryScreen';
import { AddActionScreen } from '../screens/actions/AddActionScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SplashScreen } from '../screens/onboarding/SplashScreen';
import { LanguageSelectScreen } from '../screens/onboarding/LanguageSelectScreen';
import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { RoleSelectionScreen } from '../screens/onboarding/RoleSelectionScreen';
import { AvatarSelectionScreen } from '../screens/onboarding/AvatarSelectionScreen';
import { NameScreen } from '../screens/onboarding/NameScreen';
import { TutorialScreen } from '../screens/onboarding/TutorialScreen';
import { ConnectPartnerScreen } from '../screens/partner/ConnectPartnerScreen';
import { AccountScreen } from '../screens/account/AccountScreen';
import { RequestsScreen } from '../screens/requests/RequestsScreen';
import { RewardsScreen } from '../screens/rewards/RewardsScreen';
import { CoupleProfileScreen } from '../screens/couple/CoupleProfileScreen';
import { TasksScreen } from '../screens/tasks/TasksScreen';
import { PenaltiesScreen } from '../screens/penalties/PenaltiesScreen';
import { SharedGoalsScreen } from '../screens/goals/SharedGoalsScreen';
import { AchievementsScreen } from '../screens/achievements/AchievementsScreen';
import { GamesScreen } from '../screens/games/GamesScreen';
import { QuestionOfTheDayScreen } from '../screens/games/QuestionOfTheDayScreen';
import { PartnerQuizScreen } from '../screens/games/PartnerQuizScreen';
import { TruthOrDareScreen } from '../screens/games/TruthOrDareScreen';
import { EitherOrScreen } from '../screens/games/EitherOrScreen';
import { SupportCoupleUpScreen } from '../screens/support/SupportCoupleUpScreen';
import { ThemeStoreScreen } from '../screens/store/ThemeStoreScreen';
import { ThemePreviewScreen } from '../screens/store/ThemePreviewScreen';
import { CoupleDecorationsScreen } from '../screens/store/CoupleDecorationsScreen';
import { AppIconScreen } from '../screens/store/AppIconScreen';
import { NotificationTestScreen } from '../screens/dev/NotificationTestScreen';
import { DeleteAccountScreen } from '../screens/account/DeleteAccountScreen';
import { BlockedUsersScreen } from '../screens/account/BlockedUsersScreen';
import { PrivacyScreen } from '../screens/privacy/PrivacyScreen';
import { DataPermissionsScreen } from '../screens/privacy/DataPermissionsScreen';
import { ReportUserScreen } from '../screens/support/ReportUserScreen';
import { BondRateScreen } from '../screens/bond/BondRateScreen';
import { BondCollectionScreen } from '../screens/bond/BondCollectionScreen';
import { MonthlySummaryScreen } from '../screens/bond/MonthlySummaryScreen';
import { WishlistScreen } from '../screens/wishlist/WishlistScreen';
import { ComplimentsScreen } from '../screens/compliments/ComplimentsScreen';
import { MomentsScreen } from '../screens/moments/MomentsScreen';
import { ImportantDatesScreen } from '../screens/dates/ImportantDatesScreen';
import { CoupleStatsScreen } from '../screens/couple/CoupleStatsScreen';
import { WeeklyCoupleSummaryScreen } from '../screens/bond/WeeklyCoupleSummaryScreen';
import { HabitsScreen } from '../screens/habits/HabitsScreen';
import { PromisesScreen } from '../screens/promises/PromisesScreen';
import { DateIdeasScreen } from '../screens/dateideas/DateIdeasScreen';
import { WantsScreen } from '../screens/wants/WantsScreen';
import { SurpriseIdeasScreen } from '../screens/surprises/SurpriseIdeasScreen';
import { PlanBoardScreen } from '../screens/planboard/PlanBoardScreen';
import { CalendarScreen } from '../screens/calendar/CalendarScreen';
import { ShoppingListScreen } from '../screens/shopping/ShoppingListScreen';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { ExpenseHistoryScreen } from '../screens/expenses/ExpenseHistoryScreen';
import { FairSplitScreen } from '../screens/expenses/FairSplitScreen';
import { SavingsGoalScreen } from '../screens/savings/SavingsGoalScreen';
import { MoneySummaryScreen } from '../screens/budget/MoneySummaryScreen';
import { PurchaseRequestScreen } from '../screens/budget/PurchaseRequestScreen';
import { WeeklyChallengesScreen } from '../screens/progression/WeeklyChallengesScreen';
import { DateWheelScreen } from '../screens/progression/DateWheelScreen';
import { CoupleQuizScreen } from '../screens/progression/CoupleQuizScreen';
import { CoupleRewardChestScreen } from '../screens/progression/CoupleRewardChestScreen';
import { SecurityScreen } from '../screens/security/SecurityScreen';
import { PrivacyCenterScreen } from '../screens/privacy/PrivacyCenterScreen';
import { PrivacyDataScreen } from '../screens/settings/PrivacyDataScreen';
import { AboutScreen } from '../screens/settings/AboutScreen';
import { ActivityCenterScreen } from '../screens/activity/ActivityCenterScreen';
import { RemindersScreen } from '../screens/reminders/RemindersScreen';
import { DailyDigestScreen } from '../screens/digest/DailyDigestScreen';
import { WeeklyDigestScreen } from '../screens/digest/WeeklyDigestScreen';
import { DailyTasksScreen } from '../screens/daily/DailyTasksScreen';
import { DailyCalendarScreen } from '../screens/daily/DailyCalendarScreen';
import { AnalyticsScreen } from '../screens/analytics/AnalyticsScreen';
import { DailyHubScreen } from '../screens/daily/DailyHubScreen';
import { CoupleModulesScreen } from '../screens/couple/CoupleModulesScreen';
import { MoneyHubScreen } from '../screens/money/MoneyHubScreen';
import { AllSectionsScreen } from '../screens/catalog/AllSectionsScreen';
import { RouletteHubScreen } from '../screens/roulette/RouletteHubScreen';
import { IntimateRouletteScreen } from '../screens/roulette/IntimateRouletteScreen';
import { ShopRouletteScreen } from '../screens/roulette/ShopRouletteScreen';
import { WinningsScreen } from '../screens/winnings/WinningsScreen';
import { CoupleRouletteScreen } from '../screens/roulette/CoupleRouletteScreen';
import { WishRouletteScreen } from '../screens/roulette/WishRouletteScreen';
import { FinanceScreen } from '../screens/money/FinanceScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Language" component={LanguageSelectScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="AvatarSelection" component={AvatarSelectionScreen} />
        <Stack.Screen name="Name" component={NameScreen} />
        <Stack.Screen name="ConnectPartner" component={ConnectPartnerScreen} />
        <Stack.Screen name="Main" component={MainTabNavigator} />
        <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Account" component={AccountScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Requests" component={RequestsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Rewards" component={RewardsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleProfile" component={CoupleProfileScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Tasks" component={TasksScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Penalties" component={PenaltiesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SharedGoals" component={SharedGoalsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Games" component={GamesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="QuestionOfTheDay" component={QuestionOfTheDayScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PartnerQuiz" component={PartnerQuizScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="TruthOrDare" component={TruthOrDareScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="EitherOr" component={EitherOrScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Support" component={SupportCoupleUpScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ThemeStore" component={ThemeStoreScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ThemePreview" component={ThemePreviewScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleDecorations" component={CoupleDecorationsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="AppIcon" component={AppIconScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="BlockedUsers" component={BlockedUsersScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DataPermissions" component={DataPermissionsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ReportUser" component={ReportUserScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="BondRate" component={BondRateScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="BondCollection" component={BondCollectionScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MonthlySummary" component={MonthlySummaryScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Wishlist" component={WishlistScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Compliments" component={ComplimentsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Moments" component={MomentsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ImportantDates" component={ImportantDatesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleStats" component={CoupleStatsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="WeeklyCoupleSummary" component={WeeklyCoupleSummaryScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Habits" component={HabitsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Promises" component={PromisesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DateIdeas" component={DateIdeasScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Wants" component={WantsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SurpriseIdeas" component={SurpriseIdeasScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PlanBoard" component={PlanBoardScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Calendar" component={CalendarScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShoppingList" component={ShoppingListScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Budget" component={BudgetScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ExpenseHistory" component={ExpenseHistoryScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="FairSplit" component={FairSplitScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="SavingsGoal" component={SavingsGoalScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MoneySummary" component={MoneySummaryScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PurchaseRequests" component={PurchaseRequestScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="WeeklyChallenges" component={WeeklyChallengesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DateWheel" component={DateWheelScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleQuiz" component={CoupleQuizScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleRewardChest" component={CoupleRewardChestScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Security" component={SecurityScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PrivacyCenter" component={PrivacyCenterScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="PrivacyData" component={PrivacyDataScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="About" component={AboutScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ActivityCenter" component={ActivityCenterScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Reminders" component={RemindersScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DailyDigest" component={DailyDigestScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="WeeklyDigest" component={WeeklyDigestScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DailyTasks" component={DailyTasksScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DailyCalendar" component={DailyCalendarScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="DailyHub" component={DailyHubScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleModules" component={CoupleModulesScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="MoneyHub" component={MoneyHubScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Sections" component={AllSectionsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="RouletteHub" component={RouletteHubScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="IntimateRoulette" component={IntimateRouletteScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="ShopRoulette" component={ShopRouletteScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Savings" component={WinningsScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="CoupleRoulette" component={CoupleRouletteScreen} options={{ presentation: 'card' }} />
        {/* getId pins this to a single stack entry -- a fast double-tap on
            either entry point (Home's icon, the Rewards card) can otherwise
            fire navigate() twice before the first push settles, stacking two
            live screen instances (two wheels) on top of each other. */}
        <Stack.Screen
          name="WishRoulette"
          component={WishRouletteScreen}
          options={{ presentation: 'card' }}
          getId={() => 'wish-roulette'}
        />
        <Stack.Screen name="Finance" component={FinanceScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Add" component={AddActionScreen} options={{ presentation: 'card' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ presentation: 'card' }} />
        {__DEV__ && (
          <Stack.Screen name="NotificationTest" component={NotificationTestScreen} options={{ presentation: 'card' }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
