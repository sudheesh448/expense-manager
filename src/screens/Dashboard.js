import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, ScrollView, RefreshControl, View, Text, TouchableOpacity, Dimensions, FlatList, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { 
  getAccounts, getTransactions, getRecurringPayments, 
  getRecurringStats, getEmis, getMonthlyComparisonData, 
  getAvailableHistory, getCustomGraphData, getDb, getCategories,
  getTransactionsByMonth, getCCAccountDueInfo
} from '../services/storage';
import { addMonths, format, startOfMonth, subMonths, isSameMonth } from 'date-fns';
import { 
  ChevronLeft, ChevronRight, Landmark, Link, ArrowUpRight, ArrowDownLeft, RefreshCw,
  TrendingDown, TrendingUp, Wallet, Clock, Activity, PieChart, BarChart3, CreditCard,
  Calendar
} from 'lucide-react-native';
import PriorityAlerts from '../components/dashboard/PriorityAlerts';
import MonthlyInsights from '../components/dashboard/MonthlyInsights';
import SavingsOverviewCard from '../components/dashboard/SavingsOverviewCard';
import { getCurrencySymbol } from '../utils/currencyUtils';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  getLoanStats, calculateCreditCardAlerts, 
  groupSavingsAccounts, groupLiabilitiesAccounts 
} from '../utils/dashboardUtils';

export default function Dashboard() {
  const { activeUser } = useAuth() || {};
  const { theme, fs, dashboardGraphs, customGraphs, graphOrder, setIsSettingsOpen } = useTheme();
  
  if (!activeUser) return null;
  const insets = useSafeAreaInsets();
  
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recurringStats, setRecurringStats] = useState({});
  const [emis, setEmis] = useState([]);
  const [availableHistory, setAvailableHistory] = useState([]);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const flatListRef = useRef(null);

  // Generate 36 month window (2024, 2025, 2026)
  const years = [2024, 2025, 2026];
  const monthsList = [];
  const now = startOfMonth(new Date());
  
  for (const y of years) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(y, m, 1);
      monthsList.push({
        monthKey: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy'),
        monthName: format(d, 'MMM'),
        year: y,
        monthIdx: m,
        dateObj: d,
        id: format(d, 'yyyy-MM'),
        isCurrent: isSameMonth(now, d)
      });
    }
  }

  // Find index of current month (initially)
  const currentMonthIndex = monthsList.findIndex(m => m.isCurrent);
  const [activeIndex, setActiveIndex] = useState(currentMonthIndex !== -1 ? currentMonthIndex : monthsList.length - 1);

  const loadData = async () => {
    if (!activeUser?.id) return;
    const db = await getDb();
    const accs = await getAccounts(db, activeUser.id);
    const txs = await getTransactions(db, activeUser.id);
    const recur = await getRecurringPayments(activeUser.id);
    const sipNames = accs.filter(a => a.type === 'SIP').map(a => a.name);
    const allStatNames = [...new Set([...recur.map(r => r.name), ...sipNames])];
    const stats = await getRecurringStats(db, activeUser.id, allStatNames);
    const fetchedEmis = await getEmis(db, activeUser.id);
    const history = await getAvailableHistory(db, activeUser.id);
    
    setAccounts(accs);
    setTransactions(txs);
    setRecurringStats(stats);
    setEmis(fetchedEmis);
    setAvailableHistory(history);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };


  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [activeUser.id])
  );

  const onScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    if (index >= 0 && index < monthsList.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const jumpToMonth = (index) => {
    setActiveIndex(index);
    setShowMonthSelector(false);
    setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  };

  // --- Process Data ---
  const alerts = calculateCreditCardAlerts(accounts, transactions);

  const sipAccounts = accounts.filter(a => a.type === 'SIP').map(acc => {
    const s = recurringStats[acc.name];
    const portfolioValue = Math.max(acc.balance || 0, acc.totalPaid || 0, s ? s.totalPaid : 0);
    return { ...acc, displayBalance: portfolioValue };
  });

  const creditCardAccounts = accounts.filter(a => a.type === 'CREDIT_CARD').map(acc => {
    const totalExpenses = transactions
      .filter(t => t.accountId === acc.id && (t.type === 'EXPENSE' || t.type === 'TRANSFER'))
      .reduce((sum, t) => sum + t.amount, 0);
    const totalPayments = transactions
      .filter(t => (t.toAccountId === acc.id && (t.type === 'PAYMENT' || t.type === 'TRANSFER' || t.type === 'EMI_PAYMENT' || t.type === 'EMI_LIMIT_RECOVERY')) ||
                   (t.accountId === acc.id && t.type === 'INCOME'))
      .reduce((sum, t) => sum + t.amount, 0);
    const nonEmiOutstanding = Math.max(0, totalExpenses - totalPayments);
    const cardEmis = emis.filter(e => e.accountId === acc.id);
    const emiOutstanding = cardEmis.reduce((sum, e) => sum + (e.amount * (e.tenure - e.paidMonths)), 0);
    
    return { 
      ...acc, 
      displayBalance: nonEmiOutstanding, 
      totalOutstanding: nonEmiOutstanding + emiOutstanding 
    };
  });

  const savingsData = groupSavingsAccounts(
    accounts, 
    accounts.filter(a => a.type === 'LENDED'),
    accounts.filter(a => a.type === 'INVESTMENT'),
    sipAccounts
  );

  const liabilitiesData = groupLiabilitiesAccounts(
    accounts.filter(a => a.type === 'LOAN'),
    accounts.filter(a => a.type === 'BORROWED'),
    creditCardAccounts
  );


  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <CustomHeader 
        title="Dashboard"
        showProfile={true}
        onProfilePress={() => setIsSettingsOpen(true)}
        theme={theme}
        fs={fs}
        rightIcon={<Calendar size={20} color={theme.primary} />}
        onRightIconPress={() => setShowMonthSelector(true)}
      />


      <ScrollView 
        ref={useRef(null)}
        style={[styles.container, { backgroundColor: theme.background }]} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        <PriorityAlerts alerts={alerts} theme={theme} fs={fs} />
        
        <SavingsOverviewCard 
          userId={activeUser.id} 
          theme={theme} 
          fs={fs} 
          currency={getCurrencySymbol(activeUser?.currency)} 
        />
        
        <FlatList
          ref={flatListRef}
          data={monthsList}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          initialScrollIndex={currentMonthIndex !== -1 ? currentMonthIndex : 0}
          getItemLayout={(data, index) => ({
            length: SLIDE_WIDTH,
            offset: SLIDE_WIDTH * index,
            index,
          })}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={{ width: SLIDE_WIDTH }}>
                 <MonthlyInsights 
                    userId={activeUser.id}
                    monthKey={item.monthKey}
                    label={item.label}
                    dateObj={item.dateObj}
                    theme={theme}
                    fs={fs}
                    currency={getCurrencySymbol(activeUser?.currency)}
                    onPressSelector={() => setShowMonthSelector(true)}
                />
            </View>
          )}
        />

        {/* Year/Month Selection Modal */}
        <Modal visible={showMonthSelector} transparent animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, maxHeight: '80%' }}>
                    <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold', marginBottom: 16 }}>Go to Month</Text>
                    
                    {/* Year Selector Row */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                        {years.map(y => (
                            <TouchableOpacity 
                                key={y} 
                                onPress={() => setPickerYear(y)}
                                style={{ 
                                    paddingVertical: 8, paddingHorizontal: 16, 
                                    backgroundColor: pickerYear === y ? theme.primary : theme.border, 
                                    borderRadius: 8, opacity: pickerYear === y ? 1 : 0.4 
                                }}
                            >
                                <Text style={{ color: pickerYear === y ? '#fff' : theme.text, fontWeight: 'bold' }}>{y}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Month Grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                        {Array.from({ length: 12 }).map((_, mIdx) => {
                            const date = new Date(pickerYear, mIdx, 1);
                            const mLabel = format(date, 'MMM');
                            const targetIdx = monthsList.findIndex(m => m.year === pickerYear && m.monthIdx === mIdx);
                            const isCurrent = isSameMonth(new Date(), date);
                            const isSelected = activeIndex === targetIdx;

                            return (
                                <TouchableOpacity 
                                    key={mIdx} 
                                    onPress={() => jumpToMonth(targetIdx)}
                                    style={{ 
                                        width: '30%', height: 50, justifyContent: 'center', alignItems: 'center',
                                        backgroundColor: isSelected ? theme.primarySubtle : (isCurrent ? 'rgba(0,0,0,0.02)' : 'transparent'),
                                        borderWidth: 1, borderColor: isCurrent ? theme.primary : theme.border,
                                        borderRadius: 12, opacity: targetIdx === -1 ? 0.2 : 1
                                    }}
                                    disabled={targetIdx === -1}
                                >
                                    <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }}>
                                        {mLabel}
                                    </Text>
                                    {isCurrent && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary, marginTop: 2 }} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TouchableOpacity onPress={() => setShowMonthSelector(false)} style={{ marginTop: 24, padding: 12, alignItems: 'center' }}>
                         <Text style={{ color: theme.textSubtle }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTitle: { fontWeight: '800', letterSpacing: -0.5, marginLeft: 8 },
  profileBtn: { 
    marginLeft: 8,
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 4, 
    shadowColor: '#000',
    shadowOpacity: 0.2, 
    shadowRadius: 5 
  },
  emptyState: { padding: 16, borderRadius: 12, justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontWeight: 'bold',
  },
});
