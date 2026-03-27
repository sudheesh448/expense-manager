import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { 
  getAccounts, getTransactions, getExpectedExpenses, saveExpectedExpense, 
  deleteExpectedExpense, getAvailableHistory, getForecastDuration, 
  getBudgets, getCategories, stabilizeSIPExpenses, generateAllRecurringExpenses, getDb 
} from '../services/storage';
import { generateProjections } from '../utils/projections';
import { PlusCircle, CheckCircle2, Circle, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft, CreditCard } from 'lucide-react-native';
import CustomHeader from '../components/CustomHeader';
import MonthDetailModal from '../components/forecast/MonthDetailModal';
import { format, addMonths, subMonths, startOfMonth, differenceInMonths, isValid } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getCurrencySymbol } from '../utils/currencyUtils';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 3 + i); // -3 to +7 years

export default function Projections() {
  const { activeUser } = useAuth() || {};
  const { theme, fs, setIsSettingsOpen } = useTheme();
  const [timeline, setTimeline] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  if (!activeUser) return null;

  const [selectedMonth, setSelectedMonth] = useState(null);
  const [todayY, setTodayY] = useState(0);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const [shouldScroll, setShouldScroll] = useState(false);
  const scrollRef = useRef(null);
  const hasScrolledInitial = useRef(false);
  const layoutOffsets = useRef({});

  const loadData = async (isSilent = false) => {
    if (!activeUser?.id) return;
    if (!isSilent) setLoading(true);
    try {
      const database = await getDb();
      // Ensure all recurring systems are topped up
      await stabilizeSIPExpenses(database, activeUser.id);
      await generateAllRecurringExpenses(activeUser.id);
      
      const accs = await getAccounts(activeUser.id);
      const txs = await getTransactions(activeUser.id);
      const expected = await getExpectedExpenses(activeUser.id);
      const history = await getAvailableHistory(activeUser.id);
      const duration = await getForecastDuration(activeUser.id);
      const buds = await getBudgets(activeUser.id);

      // Fetch categories to exclude from CC Due (Limit Blockage/Recovery)
      // We use a robust fetch with fallbacks for system categories
      let excludeIds = [];
      try {
        const limitCats = await getCategories(activeUser.id, ['CC Limit Blockage', 'CC Limit Recovery', 'EMI Limit Blockage', 'EMI Limit Recovery']);
        excludeIds = limitCats.map(c => c.id);
      } catch (catError) {
        console.warn('Could not fetch exclusion categories:', catError);
      }

      const today = new Date();
      const todayStart = startOfMonth(today);

      // Calculate monthsBefore from the very first history record to today
      let monthsBefore = 3; // default
      if (history.length > 0) {
        const dbStartParts = history[0].split('-'); // yyyy-MM
        const dbStartDate = new Date(parseInt(dbStartParts[0]), parseInt(dbStartParts[1]) - 1, 1);
        monthsBefore = Math.max(0, differenceInMonths(todayStart, dbStartDate));
      }

      const monthsForward = duration + 1; // current month + duration forward

      const projections = generateProjections(accs, txs, expected, buds, monthsForward, monthsBefore, excludeIds);
      setTimeline(projections);
    } catch (error) {
      console.error('Error loading Projections data:', error);
    } finally {
      setLoading(false);
    }
  };

    useEffect(() => {
        if (todayY !== null && shouldScroll && !hasScrolledInitial.current && timeline.length > 0) {
            const currentIndex = timeline.findIndex(m => m.monthKey === todayKey);
            let targetY = todayY;
            
            if (currentIndex > 0) {
                const prevMonthKey = timeline[currentIndex - 1].monthKey;
                const prevY = layoutOffsets.current ? layoutOffsets.current[prevMonthKey] : undefined;
                if (prevY !== undefined) {
                    targetY = prevY;
                }
            } else if (currentIndex === 0) {
                targetY = 0;
            }

            scrollRef.current?.scrollTo({
                y: Math.max(0, targetY - 10),
                animated: true
            });
            hasScrolledInitial.current = true;
            setShouldScroll(false);
        }
    }, [todayY, shouldScroll, timeline]);

  useFocusEffect(
    React.useCallback(() => {
      setShouldScroll(true);
      hasScrolledInitial.current = false;
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleMonth = (month) => {
    setSelectedMonth(month);
  };

  const handleSaveItem = async (mKey, name, amount, type) => {
    if (!name || !amount) return;
    try {
      await saveExpectedExpense(activeUser.id, {
        monthKey: mKey,
        name: name,
        amount: parseFloat(amount),
        type: type || 'EXPENSE',
        isDone: 0
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteExpectedExpense(id);
      loadData();
    } catch (e) {
      console.error(e);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <CustomHeader 
        title="Forecast"
        showProfile={true}
        onProfilePress={() => setIsSettingsOpen(true)}
        theme={theme}
        fs={fs}
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: fs(14), fontWeight: '600' }}>Calculating Projections...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={[styles.container, { backgroundColor: theme.background }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
        >
        {timeline.map((month, index) => {
          const isCurrentMonth = month.monthKey === todayKey;
          const cardBg = theme.surface;
          const net = month.totalInputs - month.totalOutputs;
          const isPositive = net >= 0;

          return (
            <View 
              key={index} 
              onLayout={(e) => {
                if (layoutOffsets.current) {
                  layoutOffsets.current[month.monthKey] = e.nativeEvent.layout.y;
                }
                if (isCurrentMonth) setTodayY(e.nativeEvent.layout.y);
              }}
              style={[
                styles.monthCard, 
                { backgroundColor: theme.background }
              ]}
            >
              <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => toggleMonth(month)}
                style={[styles.unifiedCard, { backgroundColor: theme.surface, borderColor: isCurrentMonth ? theme.primary : 'transparent', borderWidth: isCurrentMonth ? 1 : 0 }]}
              >
                {/* Header: Month & Net Savings */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold' }}>{month.label}</Text>
                        {isCurrentMonth ? (
                            <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: theme.primary, fontSize: fs(9), fontWeight: '800' }}>CURRENT</Text>
                            </View>
                        ) : month.status === 'HISTORICAL' ? (
                            <View style={{ backgroundColor: theme.textMuted + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: theme.textMuted, fontSize: fs(9), fontWeight: '800' }}>STATISTICS</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5, marginTop: 4 }}>
                        {month.status === 'HISTORICAL' ? 'ACTUAL NET SAVINGS' : 'PREDICTED NET SAVINGS'}
                    </Text>
                    <Text style={{ color: isPositive ? theme.success : theme.danger, fontSize: fs(22), fontWeight: 'bold' }}>
                      {getCurrencySymbol(activeUser?.currency)}{(month.status === 'HISTORICAL' ? (month.actualInputs - month.actualOutputs) : net).toFixed(0)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: isPositive ? theme.success + '20' : theme.danger + '20', padding: 10, borderRadius: 12 }}>
                    <Wallet color={isPositive ? theme.success : theme.danger} size={28} />
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.3, marginBottom: 16 }} />

                {/* Body: Consumption & Cash Flow */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>CONSUMPTION</Text>
                    <Text style={{ color: theme.text, fontSize: fs(16), fontWeight: 'bold' }}>
                        {getCurrencySymbol(activeUser?.currency)}{(month.status === 'HISTORICAL' ? month.actualOutputs : month.totalOutputs).toFixed(0)}
                    </Text>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(8), marginTop: 4 }}>
                      {month.status === 'HISTORICAL' 
                        ? `Forecasted: ${getCurrencySymbol(activeUser?.currency)}${Math.round(month.totalOutputs)}`
                        : `Sched: ${getCurrencySymbol(activeUser?.currency)}${Math.round(month.expectedDue)} | CC: ${getCurrencySymbol(activeUser?.currency)}${Math.round(month.creditCardDue)}${month.totalInvestments > 0 ? ` | Invest: ${getCurrencySymbol(activeUser?.currency)}${Math.round(month.totalInvestments)}` : ''}`}
                    </Text>
                  </View>

                  <View style={{ width: 1, backgroundColor: theme.border, opacity: 0.2, marginHorizontal: 16 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>CASH FLOW</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TrendingUp color={theme.success} size={12} />
                      <Text style={{ color: theme.success, fontSize: fs(12), fontWeight: 'bold' }}>
                        {getCurrencySymbol(activeUser?.currency)}{(month.status === 'HISTORICAL' ? month.actualInputs : month.totalInputs).toFixed(0)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <TrendingDown color={theme.danger} size={12} />
                      <Text style={{ color: theme.danger, fontSize: fs(12), fontWeight: 'bold' }}>
                        {getCurrencySymbol(activeUser?.currency)}{(month.status === 'HISTORICAL' ? month.actualOutputs : month.totalOutputs).toFixed(0)}
                      </Text>
                    </View>
                    {month.totalInvestments > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <ArrowUpRight color={theme.primary} size={12} />
                        <Text style={{ color: theme.primary, fontSize: fs(12), fontWeight: 'bold' }}>
                          {getCurrencySymbol(activeUser?.currency)}{month.totalInvestments.toFixed(0)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.3, marginTop: 16, marginBottom: 12 }} />

                {/* Footer: CC Status */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CreditCard color="#8b5cf6" size={16} />
                    <Text style={{ color: theme.textSubtle, fontSize: fs(11), fontWeight: '600' }}>FORECASTED CC DUE</Text>
                  </View>
                  <Text style={{ color: "#8b5cf6", fontSize: fs(12), fontWeight: 'bold' }}>
                    {getCurrencySymbol(activeUser?.currency)}{month.creditCardDue.toFixed(0)}
                  </Text>
                </View>
              </TouchableOpacity>

            </View>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
      )}

      <MonthDetailModal
          visible={!!selectedMonth}
          onClose={() => setSelectedMonth(null)}
          month={selectedMonth ? timeline.find(m => m.monthKey === selectedMonth.monthKey) : null}
          theme={theme}
          fs={fs}
          activeUser={activeUser}
          getCurrencySymbol={getCurrencySymbol}
          onDelete={handleDelete}
          onSaveItem={handleSaveItem}
        />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  monthCard: { borderRadius: 16, marginBottom: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 16 },
  headerInfo: { flexDirection: 'row', alignItems: 'center' },
  monthLabel: { fontWeight: 'bold' },
  currentBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginLeft: 12 },
  currentText: { fontWeight: 'bold' },
  netBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  netAmount: { fontWeight: 'bold' },
  
  unifiedCard: { borderRadius: 20, padding: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },

  detailsContainer: { paddingBottom: 16 },
  
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  lineItemDone: { opacity: 0.5 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  lineName: { fontWeight: '500' },
  lineVal: { fontWeight: 'bold' },
  
  quickAdd: { flexDirection: 'row', alignItems: 'center', marginTop: 12, opacity: 0.8 },
  quickAddText: { fontWeight: 'bold', marginLeft: 8 },
  
  addForm: { flexDirection: 'row', marginTop: 16, padding: 12, borderRadius: 12, alignItems: 'center' },
  inputName: { flex: 2, height: 40, borderBottomWidth: 1, paddingHorizontal: 8, marginRight: 8 },
  inputAmount: { flex: 1, height: 40, borderBottomWidth: 1, paddingHorizontal: 8, marginRight: 8 },
  saveBtn: { paddingHorizontal: 16, height: 40, borderRadius: 8, justifyContent: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' },

  tableBlock: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tableHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#00000010' },
  tableContent: { padding: 12 },

  // Reused styles from previous sections
  sectionTitle: { fontWeight: 'bold', marginLeft: 12 },
  sectionTotal: { fontWeight: 'bold' },
});
