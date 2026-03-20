import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAccounts, getTransactions, getExpectedExpenses, saveExpectedExpense, deleteExpectedExpense, getEmis, getAvailableHistory, getForecastDuration } from '../services/storage';
import { generateProjections } from '../utils/projections';
import { PlusCircle, CheckCircle2, Circle, Trash2, ChevronDown, ChevronRight, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { format, addMonths, startOfMonth, differenceInMonths, isValid } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => currentYear - 3 + i); // -3 to +7 years

export default function Projections() {
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();
  const [timeline, setTimeline] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const [expandedMonths, setExpandedMonths] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [addingMonth, setAddingMonth] = useState(null);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [todayY, setTodayY] = useState(0);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const scrollRef = useRef(null);

  const loadData = async () => {
    const accs = await getAccounts(activeUser.id);
    const txs = await getTransactions(activeUser.id);
    const expected = await getExpectedExpenses(activeUser.id);
    const emis = await getEmis(activeUser.id);
    const history = await getAvailableHistory(activeUser.id);
    const duration = await getForecastDuration(activeUser.id);

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

    const projections = generateProjections(accs, txs, expected, emis, monthsForward, monthsBefore);
    setTimeline(projections);

    // Default expand today
    const currentKey = format(today, 'yyyy-MM');
    if (!Object.keys(expandedMonths).length) {
      setExpandedMonths({ [currentKey]: true });
    }
  };

  useEffect(() => {
    if (todayY > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, todayY - 20), animated: true });
      }, 600);
    }
  }, [todayY]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const toggleMonth = (key) => setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleSection = (monthKey, section) => setExpandedSections(prev => {
    const key = `${monthKey}-${section}`;
    return { ...prev, [key]: !prev[key] };
  });

  const handleSaveExpense = async (monthKey) => {
    if (!expName || !expAmount) return;
    await saveExpectedExpense(activeUser.id, {
      monthKey,
      name: expName,
      amount: parseFloat(expAmount) || 0,
      isDone: 0
    });
    setAddingMonth(null);
    setExpName('');
    setExpAmount('');
    setExpandedSections(prev => ({ ...prev, [`${monthKey}-expected`]: true }));
    loadData();
  };

  const handleDelete = async (id) => {
    await deleteExpectedExpense(id);
    loadData();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
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
                if (isCurrentMonth) setTodayY(e.nativeEvent.layout.y);
              }}
              style={[
                styles.monthCard, 
                { backgroundColor: cardBg, borderColor: isCurrentMonth ? theme.primary : theme.border },
                isCurrentMonth && { borderWidth: 1 }
              ]}
            >
              <TouchableOpacity 
                activeOpacity={0.7}
                style={[styles.monthHeader, { borderBottomColor: theme.border, borderBottomWidth: expandedMonths[month.monthKey] ? 1 : 0 }]} 
                onPress={() => toggleMonth(month.monthKey)}
              >
                <View style={styles.headerInfo}>
                  <Text style={[styles.monthLabel, { color: theme.text, fontSize: fs(18) }]}>{month.label}</Text>
                  {isCurrentMonth && (
                    <View style={[styles.currentBadge, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.currentText, { color: theme.primary, fontSize: fs(10) }]}>CURRENT</Text>
                    </View>
                  )}
                </View>

                <View style={[styles.netBadge, { backgroundColor: isPositive ? theme.success + '15' : theme.danger + '15' }]}>
                  <Text style={[styles.netAmount, { color: isPositive ? theme.success : theme.danger, fontSize: fs(16) }]}>
                    {isPositive ? '+' : ''}₹{net.toFixed(0)}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Summary Bar */}
              <View style={[styles.summaryBar, { borderBottomColor: theme.border }]}>
                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIcon, { backgroundColor: theme.success + '10' }]}>
                    <ArrowUpRight size={14} color={theme.success} />
                  </View>
                  <Text style={[styles.summaryLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>INCOME</Text>
                  <Text style={[styles.summaryVal, { color: theme.text, fontSize: fs(14) }]}>₹{month.totalInputs.toFixed(0)}</Text>
                </View>

                <View style={[styles.summaryItem, { borderLeftWidth: 1, borderLeftColor: theme.border, borderRightWidth: 1, borderRightColor: theme.border }]}>
                  <View style={[styles.summaryIcon, { backgroundColor: theme.danger + '10' }]}>
                    <ArrowDownLeft size={14} color={theme.danger} />
                  </View>
                  <Text style={[styles.summaryLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>EXPENSES</Text>
                  <Text style={[styles.summaryVal, { color: theme.text, fontSize: fs(14) }]}>₹{month.totalOutputs.toFixed(0)}</Text>
                </View>

                <View style={styles.summaryItem}>
                  <View style={[styles.summaryIcon, { backgroundColor: theme.primarySoft }]}>
                    <Wallet size={14} color={theme.primary} />
                  </View>
                  <Text style={[styles.summaryLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>SAVINGS</Text>
                  <Text style={[styles.summaryVal, { color: theme.text, fontSize: fs(14) }]}>₹{Math.max(0, net).toFixed(0)}</Text>
                </View>
              </View>

              {expandedMonths[month.monthKey] && (
                <View style={styles.detailsContainer}>

                  {/* Sections Rendering... */}
                  {/* (Keeping the section logic but with refined row styles) */}
                  {[
                    { title: 'Credit Cards', data: month.ccDetails, total: month.creditCardDue, key: 'cc', color: theme.text, icon: <TrendingDown size={14} color={theme.textMuted} /> },
                    { title: 'EMIs & Loans', data: month.loanDetails, total: month.emiDue, key: 'emi', color: theme.text, icon: <TrendingDown size={14} color={theme.textMuted} /> },
                    { title: 'Expected Income', data: month.expectedDetails.filter(d => d.type === 'INCOME'), total: month.expectedIncome, key: 'income', color: theme.success, icon: <TrendingUp size={14} color={theme.success} /> },
                    { title: 'Expected Expenses', data: month.expectedDetails.filter(d => d.type !== 'INCOME'), total: month.expectedDue, key: 'expected', color: theme.danger, icon: <TrendingDown size={14} color={theme.danger} />, canAdd: true }
                  ].map((sec) => (
                    sec.data.length > 0 || sec.canAdd ? (
                      <View key={sec.key} style={styles.section}>
                        <TouchableOpacity 
                          style={styles.sectionHeader} 
                          onPress={() => toggleSection(month.monthKey, sec.key)}
                        >
                          <View style={styles.sectionHeaderLeft}>
                            {expandedSections[`${month.monthKey}-${sec.key}`] ? <ChevronDown size={16} color={theme.primary} /> : <ChevronRight size={16} color={theme.textMuted} />}
                            <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(14) }]}>{sec.title}</Text>
                          </View>
                          <Text style={[styles.sectionTotal, { color: sec.color, fontSize: fs(14) }]}>
                            {sec.key === 'income' ? '+' : sec.key === 'cc' || sec.key === 'emi' || sec.key === 'expected' ? '-' : ''}₹{sec.total.toFixed(0)}
                          </Text>
                        </TouchableOpacity>

                        {expandedSections[`${month.monthKey}-${sec.key}`] && (
                          <View style={styles.sectionContent}>
                            {sec.data.map((item, i) => (
                              <View key={item.id || i} style={[styles.lineItem, item.isDone && styles.lineItemDone]}>
                                <View style={styles.checkRow}>
                                  {sec.key.includes('expected') || sec.key === 'income' ? (
                                    item.isDone ? <CheckCircle2 size={18} color={theme.success} /> : <Circle size={18} color={theme.textMuted} />
                                  ) : (
                                    <View style={{ width: 18, height: 18 }} />
                                  )}
                                  <Text style={[styles.lineName, { marginLeft: 8, color: theme.text, fontSize: fs(14) }, item.isDone && { textDecorationLine: 'line-through', color: theme.textSubtle }]}>
                                    {item.name}
                                  </Text>
                                </View>
                                <View style={styles.checkRow}>
                                  <Text style={[styles.lineVal, { color: theme.text, fontSize: fs(14) }, item.isDone && { color: theme.textSubtle }]}>₹{item.amount.toFixed(0)}</Text>
                                  {(sec.key === 'expected' || sec.key === 'income') && !item.isDone && (
                                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ marginLeft: 12 }}>
                                      <Trash2 size={16} color={theme.danger} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                            ))}

                            {sec.canAdd && (
                              <>
                                {addingMonth === month.monthKey ? (
                                  <View style={[styles.addForm, { backgroundColor: theme.background }]}>
                                    <TextInput style={[styles.inputName, { color: theme.text, borderColor: theme.border }]} placeholder="Name" placeholderTextColor={theme.textSubtle} value={expName} onChangeText={setExpName} />
                                    <TextInput style={[styles.inputAmount, { color: theme.text, borderColor: theme.border }]} placeholder="₹" placeholderTextColor={theme.textSubtle} keyboardType="numeric" value={expAmount} onChangeText={setExpAmount} />
                                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={() => handleSaveExpense(month.monthKey)}>
                                      <Text style={styles.saveBtnText}>Add</Text>
                                    </TouchableOpacity>
                                  </View>
                                ) : (
                                  <TouchableOpacity style={styles.quickAdd} onPress={() => {
                                    setAddingMonth(month.monthKey);
                                    setExpandedSections(prev => ({ ...prev, [`${month.monthKey}-expected`]: true }));
                                  }}>
                                    <PlusCircle size={16} color={theme.primary} />
                                    <Text style={[styles.quickAddText, { color: theme.primary, fontSize: fs(12) }]}>Add Expected Expense</Text>
                                  </TouchableOpacity>
                                )}
                              </>
                            )}
                          </View>
                        )}
                      </View>
                    ) : null
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
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
  
  summaryBar: { flexDirection: 'row', paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'transparent' }, // border added dynamically
  summaryItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  summaryIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  summaryLabel: { fontWeight: '600', marginBottom: 2 },
  summaryVal: { fontWeight: 'bold' },

  detailsContainer: { paddingBottom: 16 },
  section: { marginTop: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingVertical: 14 },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontWeight: 'bold', marginLeft: 12 },
  sectionTotal: { fontWeight: 'bold' },
  sectionContent: { paddingHorizontal: 16, paddingBottom: 16 },
  
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
});
