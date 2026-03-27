import { format } from 'date-fns';
import {
  ArrowDownLeft, ArrowUpRight,
  Calendar,
  CheckCircle,
  ChevronDown, ChevronUp,
  Clock,
  Landmark,
  Link,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  getAccounts,
  getCCAccountDueInfo, getExpectedExpenses,
  getTransactionsByMonth
} from '../../services/storage';
import { formatInTZ } from '../../utils/dateUtils';

export default function MonthOverviewContent({
  userId, monthKey, dateObj, isActive, theme, fs, currency, onOpenSettle, onPressSelector, refreshKey
}) {
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ income: 0, expenses: 0, savings: 0 });
  const [recentTx, setRecentTx] = useState([]);
  const [consumptionTxs, setConsumptionTxs] = useState([]);
  const [ccAccountsData, setCCAccountsData] = useState([]);
  const [bankAccountsData, setBankAccountsData] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Modal States
  const [showConsumptionModal, setShowConsumptionModal] = useState(false);
  const [showCCStatusModal, setShowCCStatusModal] = useState(false);
  const [showCCDetailModal, setShowCCDetailModal] = useState(false);
  const [showCashFlowModal, setShowCashFlowModal] = useState(false);
  const [selectedCCForTx, setSelectedCCForTx] = useState(null);
  const [expandedConsSections, setExpandedConsSections] = useState({});
  const [expandedBankSections, setExpandedBankSections] = useState({});
  const [expandedTxId, setExpandedTxId] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const accs = await getAccounts(userId);
      setAccounts(accs);

      // 1. Fetch Upcoming/Pending
      const expected = await getExpectedExpenses(userId);
      const allPending = expected
        .filter(e => e.monthKey === monthKey && e.isDone === 0)
        .map(e => ({
          ...e,
          itemType: e.type === 'SIP_PAY' ? 'SIP' : (e.linkedAccountId && e.name && e.name.startsWith('EMI:')) ? 'EMI' : 'EXPENSE'
        }))
        .sort((a, b) => (a.emiDate || a.anchorDay || 1) - (b.emiDate || b.anchorDay || 1));

      setItems(allPending);

      // 2. Summary & Recent (Transactions)
      const monthTx = await getTransactionsByMonth(userId, monthKey);

      const income = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0);
      const expActual = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
      const ccExpActual = monthTx.filter(t => t.type === 'CC_EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
      const emiActual = monthTx.filter(t => t.type === 'EMI_PAYMENT').reduce((s, t) => s + (t.amount || 0), 0);
      const ccPayActual = monthTx.filter(t => t.type === 'CC_PAY').reduce((s, t) => s + (t.amount || 0), 0);
      const sipActual = monthTx.filter(t => t.type === 'SIP_PAY').reduce((s, t) => s + (t.amount || 0), 0);

      const totalExpense = expActual + ccExpActual + emiActual;
      const cashOutflow = expActual + ccPayActual + emiActual + sipActual;

      let aggCCDue = 0;
      let aggCCUsage = 0;
      const ccAccountsStatus = [];
      const ccAccs = accs.filter(a => a.type === 'CREDIT_CARD');
      for (const card of ccAccs) {
        const info = await getCCAccountDueInfo(userId, card.id, dateObj);
        aggCCDue += info.totalAmountDue;
        aggCCUsage += info.currentCycleUsage;
        ccAccountsStatus.push({
          id: card.id, name: card.name, billedDue: info.totalAmountDue, unbilled: info.currentCycleUsage, cycles: info.cycles || []
        });
      }
      setCCAccountsData(ccAccountsStatus);

      // --- BANK FLOW ---
      const bankStatus = [];
      const bankAccs = accs.filter(a => a.type === 'BANK');
      for (const bank of bankAccs) {
        const bankTx = monthTx.filter(t => t.accountId === bank.id || t.toAccountId === bank.id);
        const bankIncome = bankTx.filter(t => (t.type === 'INCOME' && t.accountId === bank.id) || (t.toAccountId === bank.id)).reduce((s, t) => s + (t.amount || 0), 0);
        const bankOutflow = bankTx.filter(t => (t.accountId === bank.id && t.type !== 'INCOME' && t.toAccountId !== bank.id)).reduce((s, t) => s + (t.amount || 0), 0);
        bankStatus.push({ id: bank.id, name: bank.name, income: bankIncome, outflow: bankOutflow, transactions: bankTx });
      }
      setBankAccountsData(bankStatus);

      const pendingIncome = allPending.filter(i => i.type === 'INCOME').reduce((s, i) => s + (i.amount || 0), 0);
      const pendingSIP = allPending.filter(i => i.type === 'SIP_PAY').reduce((s, i) => s + (i.amount || 0), 0);
      const pendingExpense = allPending.filter(i => i.type !== 'INCOME' && i.type !== 'SIP_PAY').reduce((s, i) => s + (i.amount || 0), 0);

      const forecastedInc = income + pendingIncome;
      const forecastedOut = cashOutflow + pendingExpense + pendingSIP;
      const forecastedSipTotal = sipActual + pendingSIP;

      setSummary({
        income, expenses: totalExpense, expActual, ccExpActual, emiActual,
        outflow: cashOutflow, ccUsage: aggCCUsage, totalCCUsage: aggCCDue,
        sipActual,
        savings: (income - (cashOutflow - sipActual)), // Realized Savings = Income - Consumption
        forecastedIncome: forecastedInc,
        forecastedExpense: totalExpense + pendingExpense,
        forecastedOutflow: forecastedOut,
        forecastedSIP: forecastedSipTotal,
        forecastedSavings: forecastedInc - (forecastedOut - forecastedSipTotal) // Forecasted Savings = Total Income - Total Consumption
      });
      setConsumptionTxs(monthTx.filter(t => ['EXPENSE', 'CC_EXPENSE', 'EMI_PAYMENT'].includes(t.type)));
      setRecentTx(monthTx);
      setLoading(false);
    } catch (error) {
      console.error('Error loading MonthOverviewContent data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActive && !hasLoaded) {
      loadData();
      setHasLoaded(true);
    }
  }, [isActive, hasLoaded]);

  // When refreshing from outside (focus or settle), re-load only if currently active
  useEffect(() => {
    if (isActive && hasLoaded && refreshKey > 0) {
      loadData();
    }
  }, [refreshKey]);

  const getNextDateStr = (emiDay, specificMonthKey) => {
    const today = new Date();
    let month = today.getMonth(), year = today.getFullYear();
    if (specificMonthKey) {
      const [y, m] = specificMonthKey.split('-').map(Number);
      year = y; month = m - 1;
    } else if (today.getDate() > emiDay) {
      month++;
      if (month > 11) { month = 0; year++; }
    }
    const d = new Date(year, month, emiDay);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
  };

  const getAccName = (id) => {
    const a = accounts.find(acc => acc.id === id);
    if (!a) return 'Unknown';
    const typeMap = { 'BANK': 'Bank', 'CREDIT_CARD': 'CC', 'LOAN': 'Loan', 'EMI': 'EMI', 'INVESTMENT': 'Inv' };
    return `${a.name} (${typeMap[a.type] || a.type || 'Acc'})`;
  };

  if (!isActive && !hasLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
         <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Loading {format(dateObj, 'MMM yyyy')}...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
        <ActivityIndicator color={theme.primary} />
        <Text style={{ color: theme.textSubtle, fontSize: fs(11), marginTop: 12 }}>Fetching records...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Summary of {format(dateObj, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={onPressSelector} style={{ padding: 4 }}>
            <Calendar size={18} color={theme.primary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.unifiedCard, { backgroundColor: theme.surface }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5 }}>NET SAVINGS</Text>
              <Text style={{ color: (summary.income - summary.outflow) >= 0 ? theme.success : theme.danger, fontSize: fs(24), fontWeight: 'bold' }}>
                {currency}{Math.round(summary.income - summary.outflow)}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: fs(9), marginTop: 2 }}>
                Includes {currency}{Math.round(summary.sipActual)} in investments
              </Text>
            </View>
            <View style={{ backgroundColor: (summary.income - summary.outflow) >= 0 ? theme.success + '20' : theme.danger + '20', padding: 10, borderRadius: 12 }}>
              <Wallet color={(summary.income - summary.outflow) >= 0 ? theme.success : theme.danger} size={28} />
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.3, marginBottom: 16 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowConsumptionModal(true)}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>CONSUMPTION</Text>
              <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold' }}>{currency}{(summary.expenses || 0).toFixed(0)}</Text>
              <Text style={{ color: theme.textSubtle, fontSize: fs(8), marginTop: 4 }}>
                {`B:${Math.round(summary.expActual)} | C:${Math.round(summary.ccExpActual)} | E:${Math.round(summary.emiActual)}`}
              </Text>
            </TouchableOpacity>
            <View style={{ width: 1, backgroundColor: theme.border, opacity: 0.2, marginHorizontal: 16 }} />
            <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowCashFlowModal(true)}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 }}>CASH FLOW</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TrendingUp color={theme.success} size={12} />
                <Text style={{ color: theme.success, fontSize: fs(13), fontWeight: 'bold' }}>{currency}{(summary.income || 0).toFixed(0)}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <TrendingDown color={theme.danger} size={12} />
                <Text style={{ color: theme.danger, fontSize: fs(13), fontWeight: 'bold' }}>{currency}{(summary.outflow || 0).toFixed(0)}</Text>
              </View>
              {(summary.sipActual > 0 || summary.forecastedSIP > 0) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <ArrowUpRight color={theme.primary} size={12} />
                  <Text style={{ color: theme.primary, fontSize: fs(13), fontWeight: 'bold' }}>{currency}{(summary.sipActual || 0).toFixed(0)}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <View style={{ height: 1, backgroundColor: theme.border, opacity: 0.3, marginTop: 16, marginBottom: 12 }} />
          <TouchableOpacity
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            onPress={() => setShowCCStatusModal(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Link color="#8b5cf6" size={16} />
              <Text style={{ color: theme.textSubtle, fontSize: fs(11), fontWeight: '600' }}>CC STATUS</Text>
            </View>
            <Text style={{ color: "#8b5cf6", fontSize: fs(12), fontWeight: 'bold' }}>
              Due: {currency}{(summary.totalCCUsage || 0).toFixed(0)} | Unbilled: {currency}{(summary.ccUsage || 0).toFixed(0)}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontStyle: 'italic' }}>* Forecasted total including scheduled</Text>
          <Text style={{ color: (summary.forecastedIncome - summary.forecastedOutflow) >= 0 ? theme.success : theme.danger, fontSize: fs(10), fontWeight: 'bold' }}>
            Forecasted Savings: {currency}{(summary.forecastedIncome - summary.forecastedOutflow).toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <TouchableOpacity onPress={() => setActiveTab('pending')} style={[styles.tab, activeTab === 'pending' && { backgroundColor: theme.primary + '15' }]}>
          <Text style={[styles.tabText, { color: activeTab === 'pending' ? theme.primary : theme.textSubtle }]}>STILL PENDING</Text>
          {activeTab === 'pending' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('activity')} style={[styles.tab, activeTab === 'activity' && { backgroundColor: theme.primary + '15' }]}>
          <Text style={[styles.tabText, { color: activeTab === 'activity' ? theme.primary : theme.textSubtle }]}>RECENT ACTIVITY</Text>
          {activeTab === 'activity' && <View style={[styles.activeIndicator, { backgroundColor: theme.primary }]} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'pending' ? (
        <View style={{ marginBottom: 40 }}>
          {items.length === 0 ? (
            <View style={[styles.emptyActivity, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <CheckCircle color={theme.success} size={24} />
              <Text style={{ color: theme.textSubtle, marginLeft: 12 }}>No pending items this month!</Text>
            </View>
          ) : (
            items.map((item) => (
              <TouchableOpacity key={item.id} style={[styles.card, { backgroundColor: theme.surface }]} onPress={() => onOpenSettle(item)}>
                <View style={styles.cardHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                    {item.type === 'INCOME' ? <TrendingUp color={theme.success} size={16} /> :
                      item.type === 'SIP_PAY' ? <ArrowUpRight color={theme.primary} size={16} /> :
                        <TrendingDown color={theme.danger} size={16} />}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemNote, { color: theme.text, fontSize: fs(16) }]}>{item.name || item.note}</Text>
                      <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>
                        {item.itemType === 'EMI' ? `Due on: ${getNextDateStr(item.anchorDay || item.emiDate || 1, item.monthKey)}` : `Month: ${item.monthKey}`}
                        {item.type === 'INCOME' ? ' · Income' : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={[styles.itemAmount, { color: item.type === 'INCOME' ? theme.success : theme.danger, fontSize: fs(16) }]}>
                      {item.type === 'INCOME' ? '+' : ''}{currency}{item.amount.toFixed(0)}
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
      ) : (
        <View style={{ marginBottom: 40 }}>
          {recentTx.length === 0 ? (
            <View style={[styles.emptyActivity, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Clock color={theme.textMuted} size={24} style={{ marginBottom: 8 }} />
              <Text style={{ color: theme.textSubtle, fontSize: fs(13), textAlign: 'center' }}>No transactions yet this month.</Text>
            </View>
          ) : (
            recentTx.map((tx, idx) => {
              const amount = Number(tx.amount || 0);
              const type = (tx.type || '').toUpperCase();
              const isIncome = type === 'INCOME';
              const isTransfer = type === 'TRANSFER' || type === 'PAYMENT';
              const isEmi = type === 'EMI_PAYMENT' || type === 'EMI';
              const isExpanded = expandedTxId === tx.id;
              const Icon = isIncome ? ArrowDownLeft : isTransfer ? RefreshCw : ArrowUpRight;
              const statusColor = isIncome ? theme.success : (isTransfer || isEmi) ? '#0ea5e9' : theme.text;
              return (
                <TouchableOpacity key={tx.id || `tx-${idx}`} style={[styles.card, { backgroundColor: theme.surface, borderColor: isExpanded ? statusColor : 'transparent', borderWidth: isExpanded ? 1 : 0 }]} onPress={() => setExpandedTxId(isExpanded ? null : tx.id)}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.txIconContainer, { backgroundColor: statusColor + '15', marginRight: 12 }]}>
                      <Icon size={18} color={statusColor} strokeWidth={2.5} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemNote, { color: theme.text, fontSize: fs(15) }]} numberOfLines={isExpanded ? undefined : 1}>{tx.note || tx.category || (isEmi ? 'EMI Payment' : 'Transaction')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                        <Text style={{ color: theme.textSubtle, fontSize: fs(11) }}>{formatInTZ(tx.date, 'UTC', 'h:mm a')}</Text>
                        {(tx.category || tx.accountName) && (
                          <><Text style={{ color: theme.textSubtle, fontSize: fs(11), marginHorizontal: 4 }}>•</Text><Text style={{ color: theme.textSubtle, fontSize: fs(11) }} numberOfLines={1}>{tx.category || tx.accountName || ''}</Text></>
                        )}
                      </View>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                      <Text style={[styles.itemAmount, { color: isIncome ? theme.success : theme.text, fontSize: fs(16) }]}>
                        {isIncome ? '+' : '-'}{currency}{amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Text>
                      {(isEmi || type.includes('EMI')) && (
                        <View style={{ backgroundColor: theme.primary + '10', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 }}>
                          <Text style={{ color: theme.primary, fontSize: fs(9), fontWeight: '800', textTransform: 'uppercase' }}>EMI</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  {isExpanded && (
                    <View style={[styles.expandedDetails, { backgroundColor: theme.isDark ? '#1e293b40' : '#f8fafc' }]}>
                      <View style={{ gap: 8 }}>
                        <View style={styles.expandedInfoRow}>
                          <View style={[styles.infoIconWrapper, { backgroundColor: theme.primarySoft }]}><Landmark size={12} color={theme.primary} /></View>
                          <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Account</Text>
                          <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]}>{getAccName(tx.accountId)}</Text>
                        </View>
                        {tx.toAccountId && (
                          <View style={styles.expandedInfoRow}>
                            <View style={[styles.infoIconWrapper, { backgroundColor: '#10b98115' }]}><RefreshCw size={12} color="#10b981" /></View>
                            <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Destination</Text>
                            <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]}>{getAccName(tx.toAccountId)}</Text>
                          </View>
                        )}
                        <View style={styles.expandedInfoRow}>
                          <View style={[styles.infoIconWrapper, { backgroundColor: '#94a3b815' }]}><Clock size={12} color="#64748b" /></View>
                          <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Date</Text>
                          <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]}>{formatInTZ(tx.date, 'UTC', 'dd MMM yyyy, h:mm a')}</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      )}

      {/* Consumption Breakdown Modal */}
      <Modal visible={showConsumptionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border, height: '80%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Consumption Details</Text>
                <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>{format(dateObj, 'MMMM yyyy')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowConsumptionModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              {['EXPENSE', 'CC_EXPENSE', 'EMI_PAYMENT'].map(type => {
                const filtered = consumptionTxs.filter(t => t.type === type);
                if (filtered.length === 0) return null;
                const label = type === 'EXPENSE' ? 'Direct Spends' : type === 'CC_EXPENSE' ? 'CC Spends' : 'EMI Payments';
                const color = type === 'EXPENSE' ? theme.danger : type === 'CC_EXPENSE' ? '#8b5cf6' : '#f59e0b';
                const isExpanded = !!expandedConsSections[type];
                const sectionTotal = filtered.reduce((s, t) => s + (t.amount || 0), 0);
                return (
                  <View key={type} style={{ marginBottom: 16 }}>
                    <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border }} onPress={() => setExpandedConsSections(prev => ({ ...prev, [type]: !prev[type] }))}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 4, height: 20, backgroundColor: color, borderRadius: 2 }} />
                        <Text style={{ color: theme.text, fontSize: fs(13), fontWeight: 'bold' }}>{label}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ color: color, fontSize: fs(13), fontWeight: 'bold' }}>{currency}{sectionTotal.toFixed(0)}</Text>
                        {isExpanded ? <ChevronUp size={16} color={theme.textSubtle} /> : <ChevronDown size={16} color={theme.textSubtle} />}
                      </View>
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={{ backgroundColor: theme.background, marginTop: 8, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: theme.border + '40' }}>
                        {filtered.map((item, idx) => (
                          <View key={item.id} style={[styles.txRow, { borderBottomWidth: idx < filtered.length - 1 ? 0.5 : 0, borderBottomColor: theme.border }]}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: theme.text, fontSize: fs(13), fontWeight: '600' }} numberOfLines={1}>{item.category || 'Expense'}</Text>
                              <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>{format(new Date(item.date), 'MMM d')} • {item.note || ''}</Text>
                            </View>
                            <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold' }}>{currency}{(item.amount || 0).toFixed(0)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CC Status Breakdown Modal */}
      <Modal visible={showCCStatusModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border, height: '60%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Credit Card Status</Text>
              <TouchableOpacity onPress={() => setShowCCStatusModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              {ccAccountsData.map((item) => (
                <TouchableOpacity key={item.id} style={{ backgroundColor: theme.background, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }} onPress={() => { setSelectedCCForTx(item); setShowCCDetailModal(true); }}>
                  <Text style={{ color: theme.text, fontSize: fs(15), fontWeight: 'bold', marginBottom: 10 }}>{item.name}</Text>
                  <View style={{ flexDirection: 'row', gap: 20 }}>
                    <View><Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>BILLED</Text><Text style={{ color: "#8b5cf6", fontSize: fs(15), fontWeight: '700' }}>{currency}{Math.round(item.billedDue)}</Text></View>
                    <View><Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>UNBILLED</Text><Text style={{ color: theme.text, fontSize: fs(15), fontWeight: '700' }}>{currency}{Math.round(item.unbilled)}</Text></View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cash Flow Details Modal */}
      <Modal visible={showCashFlowModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border, height: '80%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Cash Flow Details</Text>
              <TouchableOpacity onPress={() => setShowCashFlowModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              {bankAccountsData.map((item) => (
                <View key={item.id} style={{ marginBottom: 16 }}>
                  <TouchableOpacity style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 12, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border }} onPress={() => setExpandedBankSections(prev => ({ ...prev, [item.id]: !prev[item.id] }))}>
                    <Text style={{ color: theme.text, fontWeight: 'bold' }}>{item.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Text style={{ color: theme.success }}>+{currency}{Math.round(item.income)}</Text>
                      <Text style={{ color: theme.danger }}>-{currency}{Math.round(item.outflow)}</Text>
                    </View>
                  </TouchableOpacity>
                  {expandedBankSections[item.id] && (
                    <View style={{ backgroundColor: theme.background, marginTop: 4, borderRadius: 12, padding: 8 }}>
                      {item.transactions.map(t => (
                        <View key={t.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
                          <Text style={{ color: theme.textSubtle, fontSize: fs(11), flex: 1 }}>{t.note || t.category}</Text>
                          <Text style={{ color: t.accountId === item.id ? theme.danger : theme.success, fontSize: fs(11) }}>{currency}{Math.round(t.amount)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* CC Specific Transaction Modal */}
      <Modal visible={showCCDetailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border, height: '80%' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>{selectedCCForTx?.name}</Text>
              <TouchableOpacity onPress={() => setShowCCDetailModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1, padding: 16 }}>
              {selectedCCForTx?.cycles?.map((cycle) => (
                <View key={cycle.key} style={{ marginBottom: 16 }}>
                  <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: fs(12), marginBottom: 4 }}>{format(new Date(cycle.start), 'MMM d')} - {format(new Date(cycle.end), 'MMM d')}</Text>
                  <View style={{ backgroundColor: theme.background, borderRadius: 8, padding: 8 }}>
                    {cycle.transactions.map(tx => (
                      <View key={tx.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                        <Text style={{ color: theme.textSubtle, fontSize: fs(11), flex: 1 }}>{tx.note || tx.category}</Text>
                        <Text style={{ color: tx.type === 'CC_EXPENSE' ? theme.danger : theme.success, fontSize: fs(11) }}>{currency}{Math.round(tx.amount)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12, letterSpacing: 0.5 },
  unifiedCard: { borderRadius: 20, padding: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8, position: 'relative' },
  tabText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  activeIndicator: { position: 'absolute', bottom: -4, width: 20, height: 3, borderRadius: 2 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemNote: { fontWeight: '600' },
  itemAmount: { fontWeight: 'bold' },
  emptyActivity: { padding: 30, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1 },
  txIconContainer: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  expandedDetails: { marginTop: 12, padding: 12, borderRadius: 12, gap: 12 },
  expandedInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIconWrapper: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  expandedInfoLabel: { flex: 1 },
  expandedInfoValue: { fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, borderTopWidth: 1, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontWeight: 'bold' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 }
});
