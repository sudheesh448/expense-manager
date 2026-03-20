import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getEmis, getAccounts, payEmi, getExpectedExpenses, getTransactions, payExpectedExpense, getAvailableHistory } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { CheckCircle, TrendingUp, TrendingDown, Wallet, Clock, List, X, Check, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, isWithinInterval, addMonths } from 'date-fns';

export default function UpcomingPayments({ navigation }) {
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();
  const [items, setItems] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [accounts, setAccounts] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, savings: 0 });
  const [recentTx, setRecentTx] = useState([]);

  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [settleAccountId, setSettleAccountId] = useState(null);

  const [availableHistory, setAvailableHistory] = useState([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [tempYear, setTempYear] = useState(new Date().getFullYear().toString());

  const loadData = async () => {
    const now = selectedDate;
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const currentMonthKey = format(now, 'yyyy-MM');

    // 1. Fetch Upcoming/Pending
    const fetchedEmis = await getEmis(activeUser.id);
    const activeEmis = fetchedEmis
      .filter(e => e.paidMonths < e.tenure)
      .map(e => ({ ...e, itemType: 'EMI' }));

    const expected = await getExpectedExpenses(activeUser.id);
    const activeExpected = expected
      .filter(e => e.monthKey === currentMonthKey && e.isDone === 0)
      .map(e => ({ ...e, itemType: 'EXPENSE' }));

    const allPending = [...activeEmis, ...activeExpected];
    setItems(allPending);
    setTotalDue(allPending.reduce((s, i) => s + i.amount, 0));

    // 2. Fetch Month Transactions & Summary
    const allTx = await getTransactions(activeUser.id);
    const monthTx = allTx.filter(t => {
      const d = new Date(t.date);
      return isWithinInterval(d, { start: monthStart, end: monthEnd });
    });

    const income = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expenses = monthTx.filter(t => t.type === 'EXPENSE' || t.type === 'PAYMENT').reduce((s, t) => s + t.amount, 0);
    
    const pendingIncome = allPending.filter(i => i.type === 'INCOME').reduce((s, i) => s + i.amount, 0);
    const pendingExpense = allPending.filter(i => i.type !== 'INCOME').reduce((s, i) => s + i.amount, 0);

    setSummary({ 
      income, 
      expenses, 
      savings: income - expenses,
      forecastedIncome: income + pendingIncome,
      forecastedExpense: expenses + pendingExpense
    });
    setRecentTx(monthTx.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10));

    const accs = await getAccounts(activeUser.id);
    setAccounts(accs);

    const history = await getAvailableHistory(activeUser.id);
    setAvailableHistory(history);
  };

  useFocusEffect(React.useCallback(() => { loadData(); }, [selectedDate]));

  // Custom header completely removed to let global AppNavigator header show

  const changeMonth = (offset) => {
    setSelectedDate(prev => addMonths(prev, offset));
  };

  const getNextDateStr = (emiDay) => {
    const today = new Date();
    let month = today.getMonth(), year = today.getFullYear();
    if (today.getDate() > emiDay) {
      month++;
      if (month > 11) { month = 0; year++; }
    }
    const d = new Date(year, month, emiDay);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const getAccName = (id) => {
    const a = accounts.find(acc => acc.id === id);
    return a ? a.name : 'Unknown';
  };

  const openSettle = (item) => {
    setSelectedItem(item);
    // Find first bank account as default
    const bank = accounts.find(a => a.type === 'BANK');
    setSettleAccountId(bank?.id || null);
    setShowSettleModal(true);
  };

  const handleSettle = async () => {
    if (!settleAccountId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }
    try {
      if (selectedItem.itemType === 'EMI') {
        await payEmi(activeUser.id, selectedItem.id, settleAccountId);
      } else {
        await payExpectedExpense(activeUser.id, selectedItem.id, settleAccountId);
      }
      setShowSettleModal(false);
      loadData();
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      
      {/* Date Selector Sub-bar */}
      <View style={[styles.subHeader, { backgroundColor: theme.surface }]}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <ChevronLeft color={theme.primary} size={24} />
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => setShowHistoryModal(true)} style={styles.dateDisplay}>
          <Text style={[styles.dateText, { color: theme.text, fontSize: fs(18) }]}>
            {format(selectedDate, 'MMMM yyyy')}
          </Text>
          <ChevronRight color={theme.textSubtle} size={14} style={{ marginLeft: 4, transform: [{ rotate: '90deg' }] }} />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => changeMonth(1)} 
          disabled={format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM')} 
          style={[styles.navBtn, { opacity: format(selectedDate, 'yyyy-MM') === format(new Date(), 'yyyy-MM') ? 0.3 : 1 }]}
        >
          <ChevronRight color={theme.primary} size={24} />
        </TouchableOpacity>
      </View>
      
      <View style={{ marginBottom: 24 }}>
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18) }]}>Summary</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TrendingUp color={theme.success} size={20} />
              <Text style={{ color: theme.success, fontSize: fs(10), fontWeight: 'bold' }}>₹{(summary.forecastedIncome || 0).toFixed(0)}*</Text>
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 8 }}>Income</Text>
            <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold' }} numberOfLines={1} adjustsFontSizeToFit>₹{summary.income.toFixed(0)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, flex: 1 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TrendingDown color={theme.danger} size={20} />
              <Text style={{ color: theme.danger, fontSize: fs(10), fontWeight: 'bold' }}>₹{(summary.forecastedExpense || 0).toFixed(0)}*</Text>
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 8 }}>Expenses</Text>
            <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold' }} numberOfLines={1} adjustsFontSizeToFit>₹{summary.expenses.toFixed(0)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: theme.surface, flex: 1 }]}>
            <Wallet color={theme.primary} size={20} />
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 8 }}>Net Actual</Text>
            <Text style={{ color: summary.savings >= 0 ? theme.success : theme.danger, fontSize: fs(18), fontWeight: 'bold' }} numberOfLines={1} adjustsFontSizeToFit>₹{summary.savings.toFixed(0)}</Text>
          </View>
        </View>
        <Text style={{ color: theme.textSubtle, fontSize: fs(10), marginTop: 8, fontStyle: 'italic' }}>* Forecasted total including pending items</Text>
      </View>

      {/* 2. Pending Items */}
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Clock color={theme.warning} size={20} />
            <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Still Pending</Text>
          </View>
          <View style={{ backgroundColor: theme.warning + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: theme.warning, fontSize: fs(12), fontWeight: 'bold' }}>₹{totalDue.toFixed(0)}</Text>
          </View>
        </View>

        {items.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.surface }]}>
            <CheckCircle color={theme.success} size={24} />
            <Text style={{ color: theme.textSubtle, marginLeft: 12 }}>No pending items this month!</Text>
          </View>
        ) : (
          items.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => openSettle(item)}>
              <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                  {item.type === 'INCOME' ? <TrendingUp color={theme.success} size={16} /> : <TrendingDown color={theme.danger} size={16} />}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemNote, { color: theme.text, fontSize: fs(16) }]}>{item.name || item.note}</Text>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>
                      {item.itemType === 'EMI' ? `Due on: ${getNextDateStr(item.emiDate)}` : `Month: ${item.monthKey}`}
                      {item.type === 'INCOME' ? ' · Income' : ''}
                    </Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                  <Text style={[styles.itemAmount, { color: item.type === 'INCOME' ? theme.success : theme.danger, fontSize: fs(16) }]}>
                    {item.type === 'INCOME' ? '+' : ''}₹{item.amount.toFixed(0)}
                  </Text>
                  <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 4 }}>
                    <Text style={{ color: theme.primary, fontSize: fs(11), fontWeight: '700' }}>SETTLE</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* 3. Recent Transactions */}
      <View style={{ marginBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <List color={theme.primary} size={20} />
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Recent Activity</Text>
        </View>
        
        {recentTx.length === 0 ? (
          <Text style={{ color: theme.textSubtle, fontStyle: 'italic', textAlign: 'center', marginTop: 10 }}>No transactions yet this month.</Text>
        ) : (
          <View style={[styles.listContainer, { backgroundColor: theme.surface }]}>
            {recentTx.map((tx, idx) => (
              <View key={tx.id} style={[styles.txRow, { borderBottomWidth: idx === recentTx.length - 1 ? 0 : 1, borderBottomColor: theme.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '600' }} numberOfLines={1}>{tx.note || tx.category}</Text>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(11) }}>{format(new Date(tx.date), 'dd MMM')}</Text>
                </View>
                <Text style={{ color: tx.type === 'INCOME' ? theme.success : theme.text, fontSize: fs(14), fontWeight: 'bold' }}>
                  {tx.type === 'INCOME' ? '+' : '-'}₹{tx.amount.toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Settle Modal */}
      <Modal visible={showSettleModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Settle Item</Text>
              <TouchableOpacity onPress={() => setShowSettleModal(false)}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              <Text style={{ color: theme.textSubtle, marginBottom: 16 }}>
                Select {selectedItem?.type === 'INCOME' ? 'Bank Account to receive income' : 'Account to pay from'}
              </Text>

              <ScrollView style={{ maxHeight: 300 }}>
                {accounts
                  .filter(acc => selectedItem?.type === 'INCOME' ? acc.type === 'BANK' : true)
                  .map(acc => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.accountOption,
                      { backgroundColor: settleAccountId === acc.id ? theme.primary + '20' : theme.background, borderColor: settleAccountId === acc.id ? theme.primary : theme.border }
                    ]}
                    onPress={() => setSettleAccountId(acc.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontWeight: '600' }}>{acc.name}</Text>
                      <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Balance: ₹{acc.balance.toFixed(0)}</Text>
                    </View>
                    {settleAccountId === acc.id && <Check color={theme.primary} size={20} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.settleActionBtn, { backgroundColor: theme.primary, marginTop: 20 }]}
                onPress={handleSettle}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>
                  {selectedItem?.type === 'INCOME' ? 'Receive Income' : 'Mark as Paid'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* History Jump Modal */}
      <Modal visible={showHistoryModal} transparent animationType="slide">
        <SafeAreaView style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Select Month</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 20 }}>
              {/* Year Chips */}
              <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginBottom: 8, fontWeight: 'bold' }}>YEAR</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {[...new Set(availableHistory.map(m => m.split('-')[0]))].sort().map(yr => (
                  <TouchableOpacity 
                    key={yr} 
                    style={[styles.yearChip, { backgroundColor: tempYear === yr ? theme.primary : theme.background, borderColor: theme.border }]}
                    onPress={() => setTempYear(yr)}
                  >
                    <Text style={{ color: tempYear === yr ? '#fff' : theme.text }}>{yr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Month Grid */}
              <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginBottom: 8, fontWeight: 'bold' }}>MONTH</Text>
              <View style={styles.monthGrid}>
                {availableHistory
                  .filter(m => m.startsWith(tempYear))
                  .sort()
                  .map(m => {
                    const monthDate = new Date(m + '-01');
                    const isSelected = format(selectedDate, 'yyyy-MM') === m;
                    return (
                      <TouchableOpacity 
                        key={m} 
                        style={[styles.monthOption, { backgroundColor: isSelected ? theme.primary + '20' : theme.background, borderColor: isSelected ? theme.primary : theme.border }]}
                        onPress={() => {
                          setSelectedDate(monthDate);
                          setShowHistoryModal(false);
                        }}
                      >
                        <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }}>
                          {format(monthDate, 'MMMM')}
                        </Text>
                        {isSelected && <Check color={theme.primary} size={16} />}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12 },
  summaryCard: { borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  card: { borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemNote: { fontWeight: '700', flex: 1, marginRight: 8 },
  itemAmount: { fontWeight: '700' },
  emptyCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc' },
  listContainer: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  txRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: 10, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  navBtn: { padding: 8 },
  navTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  navTitle: { fontWeight: 'bold' },

  subHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  dateDisplay: { flexDirection: 'row', alignItems: 'center' },
  dateText: { fontWeight: 'bold' },

  yearChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthOption: { width: '48%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontWeight: 'bold' },
  accountOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  settleActionBtn: { padding: 16, borderRadius: 12 },
});
