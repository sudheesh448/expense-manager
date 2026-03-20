import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TextInput, TouchableOpacity, Modal, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getAccounts, saveAccount, updateAccount, softDeleteAccount,
  getRecurringPayments, saveRecurringPayment, deleteRecurringPayment, getRecurringStats,
  stopRecurringPayment, restartRecurringPayment, pauseRecurringMonths, resumeRecurringMonths,
  getCategories, getAccountLogs,
  getEmis, deleteEmi, saveTransaction, deleteRecurringByAccountId, updateRecurringPayment
} from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DatePicker from '../components/DatePicker';
import CustomDropdown from '../components/CustomDropdown';
import { Edit2, Trash2, RefreshCw, Plus, X, Landmark, CreditCard, TrendingUp, Building2, BarChart2, ChevronRight, History, Users, HandCoins, Clock, Info } from 'lucide-react-native';

const SECTIONS = [
  { key: 'BANK',        label: 'Bank Accounts',    Icon: Landmark,   color: '#3b82f6' },
  { key: 'CREDIT_CARD', label: 'Credit Cards',      Icon: CreditCard, color: '#8b5cf6' },
  { key: 'INVESTMENT',  label: 'Investments',       Icon: TrendingUp, color: '#10b981' },
  { key: 'SIP',         label: 'SIPs',              Icon: BarChart2,  color: '#06b6d4' },
  { key: 'LOAN',        label: 'Loans',             Icon: Building2,  color: '#f59e0b' },
  { key: 'BORROWED',    label: 'Borrowed (Liability)', Icon: HandCoins, color: '#ef4444' },
  { key: 'LENDED',      label: 'Lended (Asset)',       Icon: Users,     color: '#10b981' },
  { key: 'EMI',         label: 'Credit Card EMIs',  Icon: Clock,     color: '#ec4899' },
  { key: 'RECURRING',   label: 'Monthly Recurring Items', Icon: RefreshCw,  color: '#ef4444' },
];

const differenceInMonths = (date1, date2) => {
  let months = (date1.getFullYear() - date2.getFullYear()) * 12;
  months -= date2.getMonth();
  months += date1.getMonth();
  return months <= 0 ? 0 : months;
};

export default function Accounts() {
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();

  const [accounts, setAccounts]           = useState([]);
  const [recurringList, setRecurringList] = useState([]);
  const [recurringStats, setRecurringStats] = useState({});  // keyed by name

  // Which section detail modal is open
  const [openSection, setOpenSection] = useState(null); // e.g. { key, label, Icon, color }

  // Add/Edit account modal
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingId, setEditingId]             = useState(null);
  const [acName, setAcName]                   = useState('');
  const [acBalance, setAcBalance]             = useState('');
  const [acSipAmount, setAcSipAmount]         = useState('');  // SIP monthly deduction
  const [billingDay, setBillingDay]           = useState(new Date());
  const [dueDay, setDueDay]                   = useState(new Date());
  const [acCategoryId, setAcCategoryId]       = useState('');
  // Loan specific
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acInterestRate, setAcInterestRate]   = useState('');
  const [acFineRate, setAcFineRate]           = useState('');
  const [acTenure, setAcTenure]               = useState('');
  const [acLoanStartDate, setAcLoanStartDate] = useState(new Date());
  const [acIsEmi, setAcIsEmi] = useState(false);

  // Add recurring modal
  const [showRecurForm, setShowRecurForm] = useState(false);
  const [rName, setRName]               = useState('');
  const [rAmount, setRAmount]           = useState('');
  const [rScheduleType, setRScheduleType] = useState('DYNAMIC');
  const [rAnchorDay, setRAnchorDay]     = useState('1');
  const [rCycleDays, setRCycleDays]     = useState('30');
  const [rCustomDays, setRCustomDays]   = useState('');
  const [rStartDate, setRStartDate]     = useState(new Date());
  const [rCategoryId, setRCategoryId]   = useState('');
  const [rType, setRType]               = useState('EXPENSE');

  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [repayModal, setRepayModal] = useState(null); // { item, amount, bankId }
  const [emiModal, setEmiModal]     = useState(null); // { item, tenureMonths }
  const [accountLogs, setAccountLogs]           = useState([]);

  // Pause modal
  const [pauseModal, setPauseModal]         = useState(null);  // { item, mode: 'PAUSE'|'RESUME' }
  const [pausedSelection, setPausedSelection] = useState(new Set()); // monthKeys

  const [expenseCategories, setExpenseCategories] = useState([]);

  const loadData = async () => {
    const accs  = await getAccounts(activeUser.id);
    const recur = await getRecurringPayments(activeUser.id);
    await getEmis(activeUser.id);
    const sipNames = accs.filter(a => a.type === 'SIP').map(a => a.name);
    const allStatNames = [...new Set([...recur.map(r => r.name), ...sipNames])];
    const stats = await getRecurringStats(activeUser.id, allStatNames);
    const cats  = await getCategories(activeUser.id, 'EXPENSE');
    setExpenseCategories(cats);

    // Link SIP accounts to their auto-generated recurring payment entries
    const enhancedAccs = accs.map(a => {
      if (a.type === 'SIP') {
        const r = recur.find(req => (req.linkedAccountId === a.id) || (req.name === a.name && req.note === 'SIP'));
        if (r) a.recurring = r;
      }
      if (a.type === 'LOAN' || a.type === 'BORROWED') {
        const r = recur.find(req => req.linkedAccountId === a.id);
        if (r) a.recurring = r;
      }
      return a;
    });

    setAccounts(enhancedAccs);
    setRecurringList(recur);
    setRecurringStats(stats);
  };

  const loadLogs = async () => {
    const logs = await getAccountLogs(activeUser.id);
    setAccountLogs(logs);
  };

  useFocusEffect(React.useCallback(() => { loadData(); }, []));

  const navigation = useNavigation();
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={{ marginRight: 16, padding: 8 }}
          onPress={() => {
            setShowHistoryModal(true);
            loadLogs();
          }}
        >
          <History color={theme.text} size={22} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme.text]);

  // ── Account CRUD ──────────────────────────────────────────────
  const openAddForm = () => {
    setEditingId(null); setAcName(''); setAcBalance(''); setAcSipAmount('');
    setBillingDay(new Date()); setDueDay(new Date());
    setAcCategoryId('');
    setAcLoanPrincipal(''); setAcInterestRate(''); setAcFineRate(''); setAcTenure('');
    setAcLoanStartDate(new Date());
    setAcIsEmi(false);
    setShowAccountForm(true);
  };

  const openEditForm = (acc) => {
    setEditingId(acc.id); setAcName(acc.name); setAcBalance(acc.balance.toString());
    setAcSipAmount(acc.sipAmount ? acc.sipAmount.toString() : '');
    setAcCategoryId(acc.categoryId || '');
    setAcLoanPrincipal(acc.loanPrincipal ? acc.loanPrincipal.toString() : '');
    setAcInterestRate(acc.loanInterestRate ? acc.loanInterestRate.toString() : '');
    setAcFineRate(acc.loanFinePercentage ? acc.loanFinePercentage.toString() : '');
    setAcTenure(acc.loanTenure ? acc.loanTenure.toString() : '');
    setAcLoanStartDate(acc.loanStartDate ? new Date(acc.loanStartDate) : new Date());
    setAcIsEmi(acc.isEmi === 1);
    if (acc.billingDay) { const d = new Date(); d.setDate(acc.billingDay); setBillingDay(d); }
    if (acc.dueDay)     { const d = new Date(); d.setDate(acc.dueDay);     setDueDay(d); }
    setShowAccountForm(true);
  };

  const handleSaveAccount = async () => {
    if (!acName.trim()) return;
    const type = openSection?.key;
    const sipDay = billingDay.getDate();
    const isLoanLike = type === 'LOAN' || type === 'BORROWED' || type === 'LENDED';
    const data = {
      name: acName.trim(), type,
      balance: parseFloat(acBalance) || 0,
      billingDay: (type === 'CREDIT_CARD' || type === 'SIP') ? sipDay : null,
      dueDay:     type === 'CREDIT_CARD' ? dueDay.getDate() : null,
      sipAmount:  type === 'SIP' ? parseFloat(acSipAmount) || 0 : null,
      categoryId: type === 'SIP' ? acCategoryId || null : null,
      loanPrincipal: isLoanLike ? parseFloat(acLoanPrincipal) || 0 : null,
      loanInterestRate: isLoanLike ? parseFloat(acInterestRate) || 0 : null,
      loanFinePercentage: isLoanLike ? parseFloat(acFineRate) || 0 : null,
      loanTenure: isLoanLike ? parseInt(acTenure, 10) || 0 : null,
      loanStartDate: isLoanLike ? acLoanStartDate.toISOString() : null,
      isEmi: isLoanLike ? (acIsEmi ? 1 : 0) : 0,
    };
    let acc;
    if (editingId) acc = await updateAccount({ id: editingId, ...data });
    else           acc = await saveAccount(activeUser.id, data);

    // Auto-generate monthly bill entries for new SIPs
    if (!editingId && type === 'SIP' && data.sipAmount > 0 && acc) {
      await saveRecurringPayment(activeUser.id, {
        name: acName.trim(),
        amount: data.sipAmount,
        accountId: accounts.find(a => a.type === 'BANK')?.id || '',
        scheduleType: 'FIXED',
        anchorDay: sipDay,
        cycleDays: 0,
        nextDueDate: new Date().toISOString(),
        note: 'SIP',
        categoryId: acCategoryId || null,
        linkedAccountId: acc.id
      });
    }
    setShowAccountForm(false);
    loadData();
  };

  const handleRevertToOneTime = async (item) => {
    Alert.alert(
      'Revert to One-time',
      `Are you sure you want to revert "${item.name}" back to a one-time payment? This will delete all scheduled EMI payments.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Revert', 
          onPress: async () => {
            await updateAccount({ id: item.id, isEmi: 0 });
            await deleteRecurringByAccountId(item.id);
            loadData();
          }
        }
      ]
    );
  };

  const confirmRepayment = async () => {
    if (!repayModal || !repayModal.bankId) {
      Alert.alert('Selection Required', 'Please select a bank account for the repayment.');
      return;
    }
    const { item, amount, bankId } = repayModal;
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    try {
      await saveTransaction(activeUser.id, {
        type: 'EXPENSE',
        amount: numAmt,
        date: new Date().toISOString(),
        accountId: bankId,
        toAccountId: item.id,
        note: `Repayment for loan: ${item.name}`,
        categoryId: item.categoryId
      });

      // Update loan balance
      // Interest is accrued at the moment of repayment.
      const stats = getLoanStats(item);
      const newBalance = Math.max(0, stats.closeTodayAmount - numAmt);
      
      // Update account with new principal and reset start date to today
      // (Interest will accrue on the new principal from this date onwards)
      await updateAccount({ 
        id: item.id, 
        balance: newBalance,
        loanStartDate: new Date().toISOString()
      });

      // If it's an EMI loan, recalculate and update the recurring payment amount
      if (item.isEmi === 1 && item.recurring && newBalance > 0) {
        // Find remaining tenure
        const years_original = item.loanTenure || 0;
        const loanStart = new Date(item.loanStartDate);
        const monthsPassed = Math.max(0, differenceInMonths(new Date(), loanStart));
        const remainingMonths = Math.max(1, (years_original * 12) - monthsPassed);

        const r = (item.loanInterestRate || 0) / 1200;
        let emi_new = newBalance / remainingMonths;
        if (r > 0) {
          emi_new = (newBalance * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
        }

        if (emi_new > 0) {
          await updateRecurringPayment({
            id: item.recurring.id,
            amount: emi_new
          });
        }
      }

      // If balance is 0, delete recurring payments
      if (newBalance <= 0) {
        await deleteRecurringByAccountId(item.id);
      }

      setRepayModal(null);
      loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record repayment.');
    }
  };

  const promptRepayLoan = (item) => {
    const stats = getLoanStats(item);
    const amount = stats.closeTodayAmount !== undefined ? stats.closeTodayAmount : (item.balance || 0);
    setRepayModal({ item, amount: amount.toFixed(2), bankId: '' });
  };

  const promptConvertToEmi = (item) => {
    setEmiModal({ item, tenureMonths: '12' });
  };

  const confirmEmiConversion = async () => {
    if (!emiModal) return;
    const { item, tenureMonths } = emiModal;
    const months = parseInt(tenureMonths, 10);
    if (isNaN(months) || months <= 0) {
      Alert.alert('Invalid Tenure', 'Please enter a valid positive number of months.');
      return;
    }
    
    const stats = getLoanStats(item);
    if (stats.remainingTotal <= 0) {
      Alert.alert('No Outstanding Amount', 'This loan has no outstanding amount to convert to EMI.');
      return;
    }
    const emiAmount = stats.remainingTotal / months;

    try {
      await Promise.all([
        updateAccount({
          id: item.id,
          loanTenure: months / 12,
          loanStartDate: new Date().toISOString(),
          isEmi: 1
        }),
        saveRecurringPayment(activeUser.id, {
          name: `EMI: ${item.name}`,
          amount: emiAmount,
          type: 'EXPENSE',
          scheduleType: 'FIXED',
          anchorDay: new Date().getDate(),
          status: 'ACTIVE',
          note: `EMI for ${item.name}`,
          categoryId: null,
          accountId: accounts.find(a => a.type === 'BANK')?.id || '',
          linkedAccountId: item.id
        })
      ]);
      setEmiModal(null);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to convert loan to EMI.');
    }
  };

  const handleDeleteAccount = (acc) => {
    const isEmi = acc.type === 'EMI';
    const message = isEmi 
      ? `Close EMI "${acc.name}"?\nThis will settle the remaining balance (₹${(acc.balance || 0).toFixed(2)}) back to your linked Credit Card and stop all future payments.`
      : `Remove "${acc.name}"?\nTransactions are preserved.`;

    Alert.alert(isEmi ? 'Close EMI Account' : 'Close Account', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
          if (acc.type === 'SIP' && acc.recurring) {
            await deleteRecurringPayment(acc.recurring.id);
          }
          await softDeleteAccount(acc.id);
          loadData();
      } },
    ]);
  };

  // ── Recurring CRUD ────────────────────────────────────────────
  const handleSaveRecurring = async () => {
    if (!rName.trim() || !rAmount) return;
    const bank = accounts.find(a => a.type === 'BANK') || accounts[0];
    const days = rCycleDays === 'CUSTOM' ? parseInt(rCustomDays, 10) : parseInt(rCycleDays, 10);
    await saveRecurringPayment(activeUser.id, {
      name: rName.trim(),
      amount: parseFloat(rAmount),
      accountId: bank?.id || '',
      scheduleType: rScheduleType,
      anchorDay:    rScheduleType === 'FIXED' ? parseInt(rAnchorDay, 10) || 1 : null,
      cycleDays:    rScheduleType === 'DYNAMIC' ? days : 0,
      nextDueDate:  rScheduleType === 'DYNAMIC' ? rStartDate.toISOString() : new Date().toISOString(),
      note: '',
      categoryId:   rCategoryId || null,
      type:         rType
    });
    setRName(''); setRAmount(''); setRScheduleType('DYNAMIC'); setRAnchorDay('1');
    setRCycleDays('30'); setRCustomDays(''); setRCategoryId(''); setRType('EXPENSE');
    setShowRecurForm(false);
    loadData();
  };

  const handleDeleteRecurring = (item) => {
    Alert.alert('Remove', `Remove "${item.name}"? This deletes all scheduled future payments.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteRecurringPayment(item.id); loadData(); } },
    ]);
  };

  const handleStop = (item) => {
    Alert.alert(
      'Stop Recurring',
      `Stop "${item.name}"?\nAll upcoming scheduled payments will be removed. You can restart later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: async () => { await stopRecurringPayment(item.id); loadData(); } },
      ]
    );
  };

  const handleRestart = (item) => {
    Alert.alert(
      'Restart Recurring',
      `Restart "${item.name}"?\nAll upcoming months will be regenerated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart', onPress: async () => { await restartRecurringPayment(item.id); loadData(); } },
      ]
    );
  };

  // Generate next N months as { label, monthKey }
  const getUpcomingMonths = (n = 24) => {
    const months = [];
    const d = new Date();
    for (let i = 0; i < n; i++) {
      const year  = d.getFullYear();
      const month = d.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      months.push({ monthKey, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) });
      d.setMonth(d.getMonth() + 1);
    }
    return months;
  };

  const openPauseModal = (item) => {
    const alreadyPaused = new Set(JSON.parse(item.pausedMonths || '[]'));
    setPausedSelection(alreadyPaused);
    setPauseModal({ item, mode: alreadyPaused.size > 0 ? 'RESUME' : 'PAUSE' });
  };

  const togglePauseMonth = (mk) => {
    setPausedSelection(prev => {
      const next = new Set(prev);
      if (next.has(mk)) next.delete(mk); else next.add(mk);
      return next;
    });
  };

  const confirmPauseAction = async () => {
    const { item } = pauseModal;
    const currentlyPaused  = new Set(JSON.parse(item.pausedMonths || '[]'));
    const toResume = [...currentlyPaused].filter(m => !pausedSelection.has(m));
    const toPause  = [...pausedSelection].filter(m => !currentlyPaused.has(m));
    if (toPause.length > 0)  await pauseRecurringMonths(item.id, toPause);
    if (toResume.length > 0) await resumeRecurringMonths(item.id, toResume);
    setPauseModal(null);
    loadData();
  };

  // ── Helpers ───────────────────────────────────────────────────
  const sectionTotal = (key) => {
    if (key === 'RECURRING') return recurringList.reduce((s, r) => s + r.amount, 0);
    
    return accounts.filter(a => a.type === key).reduce((s, a) => {
      const loan = getLoanStats(a);
      return s + (loan.isLoan ? loan.remainingTotal : a.balance);
    }, 0);
  };

  const sectionSipPaidTotal = () => {
    return accounts.filter(a => a.type === 'SIP').reduce((s, a) => {
      const stats = recurringStats[a.name];
      const fromStats = stats ? stats.totalPaid : 0;
      const fromDb = a.totalPaid || 0;
      // Aggressive fallback: use the highest detected value from balance or transaction history
      return s + Math.max(a.balance || 0, fromDb, fromStats);
    }, 0);
  };

  const sectionCount = (key) => {
    if (key === 'RECURRING') return recurringList.length;
    return accounts.filter(a => a.type === key).length;
  };

  const sectionItems = (key) => {
    if (key === 'RECURRING') return recurringList;
    return accounts.filter(a => a.type === key);
  };

  const getLoanStats = (item) => {
    const isLoan = item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'LENDED' || item.type === 'EMI';
    if (!isLoan || !item.loanPrincipal || !item.loanInterestRate || !item.loanTenure) {
      return { 
        isLoan: false, 
        remainingTotal: item.balance || 0,
        closeTodayAmount: item.balance || 0,
        emi: 0,
        totalInterest: 0,
        fineAmount: 0
      };
    }

    const loanStart = new Date(item.loanStartDate);
    const P_current = item.balance || 0;
    const annualRate = item.loanInterestRate || 0;
    const monthsPassed = Math.max(0, differenceInMonths(new Date(), loanStart));
    const years_original = item.loanTenure || 0;
    const n_original = years_original * 12;
    const r = annualRate / 1200;

    let emi_current = 0;
    let totalRepayable_current = P_current;
    let totalInterest_current = 0;
    let remainingMonths_projected = Math.max(0, n_original - monthsPassed);

    if (item.isEmi === 1) {
      if (r > 0 && remainingMonths_projected > 0) {
        emi_current = (P_current * r * Math.pow(1 + r, remainingMonths_projected)) / (Math.pow(1 + r, remainingMonths_projected) - 1);
        totalRepayable_current = emi_current * remainingMonths_projected;
        totalInterest_current = totalRepayable_current - P_current;
      } else if (remainingMonths_projected > 0) {
        emi_current = P_current / remainingMonths_projected;
        totalRepayable_current = P_current;
        totalInterest_current = 0;
      }
    } else {
      // One-time payable at end (Simple Interest)
      totalInterest_current = P_current * (annualRate / 100) * years_original;
      totalRepayable_current = P_current + totalInterest_current;
      remainingMonths_projected = Math.max(0, n_original - monthsPassed);
    }

    let fineAmount = 0;
    if (monthsPassed > n_original && item.loanFinePercentage > 0) {
      const overdueMonths = monthsPassed - n_original;
      fineAmount = P_current * (item.loanFinePercentage / 100) * overdueMonths;
    }

    const closeTodayAmount = (item.isEmi === 1) 
      ? (P_current + fineAmount) 
      : (P_current + (P_current * (annualRate / 100) * (monthsPassed / 12)) + fineAmount);

    return { 
      isLoan: true, 
      isEmi: item.isEmi === 1,
      emi: emi_current, 
      totalRepayable: totalRepayable_current + fineAmount, 
      totalInterest: totalInterest_current, 
      remainingMonths: remainingMonths_projected, 
      remainingTotal: totalRepayable_current + fineAmount,
      closeTodayAmount: closeTodayAmount,
      principal: P_current,
      rate: annualRate,
      fineRate: item.loanFinePercentage || 0,
      fineAmount,
      tenureYears: years_original
    };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView style={[styles.container, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 40 }}>

      {SECTIONS.map(sec => {
        const count = sectionCount(sec.key);
        const total = sectionTotal(sec.key);
        const { Icon } = sec;
        return (
          <TouchableOpacity
            key={sec.key}
            style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => setOpenSection(sec)}
            activeOpacity={0.75}
          >
            <View style={[styles.tileIcon, { backgroundColor: sec.color + '22' }]}>
              <Icon color={sec.color} size={24} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[styles.tileLabel, { color: theme.text, fontSize: fs(16) }]}>{sec.label}</Text>
              <Text style={[styles.tileSub, { color: theme.textSubtle, fontSize: fs(12) }]}>
                {count} item{count !== 1 ? 's' : ''}
                {count > 0 && sec.key === 'SIP' ? `  ·  Portfolio: ₹${sectionSipPaidTotal().toFixed(2)}` : (count > 0 && sec.key !== 'RECURRING') ? `  ·  ₹${Math.abs(total).toFixed(2)}` : ''}
              </Text>
            </View>
            <ChevronRight color={theme.textSubtle} size={20} />
          </TouchableOpacity>
        );
      })}

      {/* ── Section Detail Modal ─────────────────────────────────── */}
      <Modal
        visible={!!openSection}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenSection(null)}
      >
        {openSection && (
          <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background }]}>
            {/* Header */}
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setOpenSection(null)}>
                <X color={theme.text} size={22} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>{openSection.label}</Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: openSection.color }]}
                onPress={() => {
                  if (openSection.key === 'RECURRING') {
                    setRName(''); setRAmount(''); setRCycleDays('30'); setRCustomDays(''); 
                    setRStartDate(new Date()); setRCategoryId(''); setShowRecurForm(true);
                  } else if (openSection.key === 'EMI') {
                    setOpenSection(null);
                    navigation.navigate('Add', { type: 'EMI', locked: true });
                  } else {
                    openAddForm();
                  }
                }}
              >
                <Plus color="white" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              {sectionItems(openSection.key).length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: theme.textSubtle, fontSize: fs(14) }]}>
                    No {openSection.label.toLowerCase()} yet.{'\n'}Tap + to add one.
                  </Text>
                </View>
              ) : (
                sectionItems(openSection.key).map(item => (
                  <View key={item.id} style={[styles.card, { backgroundColor: theme.surface, borderLeftColor: openSection.color }]}>
                    {openSection.key === 'RECURRING' ? (
                      <View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
                              <View style={[styles.statusBadge, {
                                backgroundColor:
                                  item.status === 'STOPPED' ? '#ef444422' :
                                  item.status === 'PAUSED'  ? '#f59e0b22' : '#10b98122'
                                }]}>
                                <Text style={{ fontSize: fs(10), fontWeight: '700',
                                  color: item.status === 'STOPPED' ? '#ef4444' : item.status === 'PAUSED' ? '#f59e0b' : '#10b981'
                                }}>{item.status || 'ACTIVE'}</Text>
                              </View>
                            </View>
                            <Text style={[styles.cardSub, { color: theme.textMuted, fontSize: fs(12) }]}>
                              {item.scheduleType === 'FIXED' ? `Every month on ${item.anchorDay}th` : `Every ${item.cycleDays} days`}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[styles.cardAmount, { color: item.type === 'INCOME' ? theme.success : theme.danger, fontSize: fs(17) }]}>
                              {item.type === 'INCOME' ? '+' : ''}₹{item.amount.toFixed(2)}
                            </Text>
                          </View>
                        </View>

                        {/* Action buttons strip */}
                        <View style={[styles.actionStrip, { borderTopColor: theme.border, marginTop: 12 }]}>
                          {(item.status !== 'STOPPED') && (
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openPauseModal(item)}>
                              <Text style={{ fontSize: fs(11), color: '#f59e0b', fontWeight: '600' }}>
                                {item.status === 'PAUSED' ? '⏸ Edit Pause' : '⏸ Pause'}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {(item.status !== 'STOPPED') && (
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleStop(item)}>
                              <Text style={{ fontSize: fs(11), color: theme.danger, fontWeight: '600' }}>⏹ Stop</Text>
                            </TouchableOpacity>
                          )}
                          {item.status === 'STOPPED' && (
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleRestart(item)}>
                              <Text style={{ fontSize: fs(11), color: '#10b981', fontWeight: '600' }}>▶ Restart</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteRecurring(item)}>
                            <Text style={{ fontSize: fs(11), color: theme.danger, fontWeight: '600' }}>🗑 Delete</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Stats row */}
                        {(() => {
                          const s = recurringStats[item.name];
                          if (!s || s.timesTotal === 0) return (
                            <Text style={{ color: theme.textSubtle, fontSize: fs(11), marginTop: 10 }}>No payments recorded yet.</Text>
                          );
                          const year = new Date().getFullYear();
                          return (
                            <View style={[styles.statsRow, { borderTopColor: theme.border, marginTop: 12 }]}>
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.primary, fontSize: fs(15) }]}>₹{s.yearPaid.toFixed(2)}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Paid in {year}</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(15) }]}>₹{s.totalPaid.toFixed(2)}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Total Paid</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(15) }]}>{s.timesTotal}×</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Times Paid</Text>
                              </View>
                            </View>
                          );
                        })()}
                      </View>
                    ) : (
                      <View>
                        {/* TOP ROW: Name & Total */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
                            {/* Cycle info or SIP info */}
                            {item.type === 'CREDIT_CARD' && item.billingDay && (
                              <Text style={[styles.cardSub, { color: theme.textMuted, fontSize: fs(11) }]}>
                                Cycle: {item.billingDay}th · Due: {item.dueDay}th
                              </Text>
                            )}
                          </View>
                          
                          {(item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'LENDED' || item.type === 'EMI') ? (
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={[styles.cardAmount, { color: (item.type === 'LENDED' ? theme.success : theme.danger), fontSize: fs(18) }]}>
                                ₹{(getLoanStats(item).remainingTotal).toFixed(2)}
                              </Text>
                              <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>Rem. Total</Text>
                            </View>
                          ) : (
                            item.type !== 'SIP' && (
                              <View style={{ alignItems: 'flex-end' }}>
                                <Text style={[styles.cardAmount, { color: theme.success, fontSize: fs(18) }]}>
                                  ₹{(item.balance || 0).toFixed(2)}
                                </Text>
                              </View>
                            )
                          )}
                        </View>

                        {/* MIDDLE: Stats Box (Full Width) */}
                        {(() => {
                          const loan = getLoanStats(item);
                          if (!loan.isLoan) return null;
                          return (
                            <View style={{ marginTop: 12, padding: 12, backgroundColor: theme.background, borderRadius: 8, borderWidth: 1, borderColor: theme.border }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Principal</Text>
                                <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{loan.principal.toFixed(2)}</Text>
                              </View>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Interest Rate</Text>
                                <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>{loan.rate}% ({loan.isEmi ? 'EMI' : 'One-time'})</Text>
                              </View>
                              {loan.isEmi && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Monthly EMI</Text>
                                  <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{loan.emi.toFixed(2)}</Text>
                                </View>
                              )}
                              <View style={{ borderTopWidth: 1, borderTopColor: theme.border, marginTop: 6, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: theme.danger, fontSize: fs(12), fontWeight: 'bold' }}>Close Today</Text>
                                <Text style={{ color: theme.danger, fontSize: fs(12), fontWeight: 'bold' }}>₹{loan.closeTodayAmount.toFixed(2)}</Text>
                              </View>
                            </View>
                          );
                        })()}

                        {/* BOTTOM ROW: Actions & Tools */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                          {/* Left: Action Buttons */}
                          {(item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'EMI') ? (
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              <TouchableOpacity 
                                style={[styles.actionBtn, { backgroundColor: theme.primary + '22', borderRadius: 8, paddingHorizontal: 12 }]}
                                onPress={() => promptRepayLoan(item)}
                              >
                                <Text style={{ fontSize: fs(11), color: theme.primary, fontWeight: '700' }}>💸 Repay</Text>
                              </TouchableOpacity>

                              {item.type !== 'EMI' && (
                                !getLoanStats(item).isEmi ? (
                                  <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: '#8b5cf622', borderRadius: 8, paddingHorizontal: 12 }]}
                                    onPress={() => promptConvertToEmi(item)}
                                  >
                                    <Text style={{ fontSize: fs(11), color: '#8b5cf6', fontWeight: '700' }}>🔄 Convert</Text>
                                  </TouchableOpacity>
                                ) : (
                                  <TouchableOpacity 
                                    style={[styles.actionBtn, { backgroundColor: '#f59e0b22', borderRadius: 8, paddingHorizontal: 12 }]}
                                    onPress={() => handleRevertToOneTime(item)}
                                  >
                                    <Text style={{ fontSize: fs(11), color: '#f59e0b', fontWeight: '700' }}>🔄 Revert</Text>
                                  </TouchableOpacity>
                                )
                              )}
                            </View>
                          ) : <View />}

                          {/* Right: Icon Tools */}
                          <View style={{ flexDirection: 'row', gap: 16 }}>
                            {item.type !== 'EMI' && (
                              <TouchableOpacity onPress={() => openEditForm(item)}>
                                <Edit2 color={theme.textMuted} size={18} />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => handleDeleteAccount(item)}>
                              <Trash2 color={theme.danger} size={18} />
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* SIP Portfolio Stats */}
                        {item.type === 'SIP' && (() => {
                          const s = recurringStats[item.name];
                          const total = Math.max(item.balance || 0, item.totalPaid || 0, s?.totalPaid || 0);
                          if (total === 0 && (!s || s.timesTotal === 0)) return null;
                          const year = new Date().getFullYear();
                          return (
                            <View style={[styles.statsRow, { backgroundColor: theme.background, marginTop: 12, borderRadius: 8, padding: 8, borderTopWidth: 0 }]}>
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.primary, fontSize: fs(15) }]}>₹{(s?.yearPaid || 0).toFixed(2)}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Paid in {year}</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(15) }]}>₹{total.toFixed(2)}</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Portfolio Value</Text>
                              </View>
                              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
                              <View style={styles.statBox}>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(15) }]}>{s?.timesTotal || 0}×</Text>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Times Paid</Text>
                              </View>
                            </View>
                          );
                        })()}

                        {/* SIP Recurring Actions */}
                        {item.type === 'SIP' && item.recurring && (
                           <View style={[styles.actionStrip, { borderTopColor: theme.border, marginTop: 12 }]}>
                             {(item.recurring.status !== 'STOPPED') && (
                               <TouchableOpacity style={styles.actionBtn} onPress={() => openPauseModal(item.recurring)}>
                                 <Text style={{ fontSize: fs(11), color: '#f59e0b', fontWeight: '600' }}>
                                   {item.recurring.status === 'PAUSED' ? '⏸ Edit Pause' : '⏸ Pause'}
                                 </Text>
                               </TouchableOpacity>
                             )}
                             {(item.recurring.status !== 'STOPPED') && (
                               <TouchableOpacity style={styles.actionBtn} onPress={() => handleStop(item.recurring)}>
                                 <Text style={{ fontSize: fs(11), color: theme.danger, fontWeight: '600' }}>⏹ Stop</Text>
                               </TouchableOpacity>
                             )}
                             {item.recurring.status === 'STOPPED' && (
                               <TouchableOpacity style={styles.actionBtn} onPress={() => handleRestart(item.recurring)}>
                                 <Text style={{ fontSize: fs(11), color: '#10b981', fontWeight: '600' }}>▶ Restart</Text>
                               </TouchableOpacity>
                             )}
                           </View>
                         )}
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── Add/Edit Account Modal ──────────────────────────────── */}
      <Modal
        visible={showAccountForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAccountForm(false)}
      >
        <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background }]}>
          <ScrollView style={[styles.modalWrap, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowAccountForm(false)}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>
              {editingId ? 'Edit Account' : `Add ${openSection?.label}`}
            </Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={{ padding: 16 }}>
            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Account Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
              placeholder={
                openSection?.key === 'BANK' ? 'e.g. HDFC Savings' :
                openSection?.key === 'CREDIT_CARD' ? 'e.g. SBI SimplySave' :
                openSection?.key === 'LOAN' ? 'e.g. Home Loan' :
                openSection?.key === 'SIP' ? 'e.g. HDFC Mid Cap Fund' : 'e.g. Mutual Fund'
              }
              placeholderTextColor={theme.textSubtle}
              value={acName} onChangeText={setAcName}
            />
            {!(openSection?.key === 'LOAN' || openSection?.key === 'BORROWED' || openSection?.key === 'LENDED') && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>
                  {openSection?.key === 'CREDIT_CARD' ? 'Credit Limit / Available (₹)' :
                   openSection?.key === 'SIP' ? 'Current Portfolio Value (₹)' :
                   openSection?.key === 'INVESTMENT' ? 'Current Value (₹)' : 'Balance (₹)'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="0.00" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
              </>
            )}
            {openSection?.key === 'CREDIT_CARD' && (
              <>
                <DatePicker label="Billing Cycle Day" date={billingDay} onChange={setBillingDay} />
                <DatePicker label="Payment Due Day"   date={dueDay}     onChange={setDueDay} />
              </>
            )}
            {openSection?.key === 'SIP' && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Monthly SIP Amount (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 5000" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acSipAmount} onChangeText={setAcSipAmount}
                />
                
                <View style={{ marginTop: 12 }}>
                  <CustomDropdown
                    label="Investment Category (Optional)"
                    options={expenseCategories.map(c => ({ label: c.name, value: c.id }))}
                    selectedValue={acCategoryId}
                    onSelect={setAcCategoryId}
                    placeholder="Select SIP Category..."
                  />
                </View>

                <DatePicker label="SIP Date (1-31)" date={billingDay} onChange={setBillingDay} mode="date" />
                <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 4 }}>
                  ₹{acSipAmount || '0'} will be added to Bills every month on the {billingDay.getDate()}{['st','nd','rd'][billingDay.getDate()-1]||'th'}.
                </Text>
              </>
            )}
            {(openSection?.key === 'LOAN' || openSection?.key === 'BORROWED' || openSection?.key === 'LENDED') && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Total Claimed Amount (Principal) (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 100000" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acLoanPrincipal} onChangeText={(val) => { setAcLoanPrincipal(val); if(!editingId) setAcBalance(val); }}
                />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Outstanding Amount (₹)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="0.00" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Annual Interest Rate (%)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 10.5" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acInterestRate} onChangeText={setAcInterestRate}
                />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Tenure (Years)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 5" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acTenure} onChangeText={setAcTenure}
                />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Fine Percentage (%) for Missed Payments</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 2.0" placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={acFineRate} onChangeText={setAcFineRate}
                />
                <DatePicker label="Loan Taken Date" date={acLoanStartDate} onChange={setAcLoanStartDate} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, backgroundColor: theme.surface, padding: 12, borderRadius: 8 }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: theme.text, fontSize: fs(15), fontWeight: '600' }}>Is this an EMI Loan?</Text>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(11) }}>EMI calculates interest monthly. One-time calculates at tenure end.</Text>
                  </View>
                  <Switch 
                    value={acIsEmi}
                    onValueChange={setAcIsEmi}
                    trackColor={{ false: theme.border, true: theme.primary }}
                  />
                </View>
                {acLoanPrincipal && acInterestRate && acTenure && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: '#f59e0b11', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b33' }}>
                    {(() => {
                      const P = parseFloat(acBalance || acLoanPrincipal) || 0;
                      const R = parseFloat(acInterestRate) || 0;
                      const T = parseFloat(acTenure) || 0;
                      
                      let totalInt = 0;
                      let emi = 0;
                      if (acIsEmi) {
                        const r = R / 1200;
                        const n = T * 12;
                        if (r > 0 && n > 0) {
                          emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
                          totalInt = (emi * n) - P;
                        }
                      } else {
                        totalInt = P * (R / 100) * T;
                      }

                      return (
                        <>
                          <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold', marginBottom: 8 }}>Loan Summary (Projected)</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Total Interest</Text>
                            <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{totalInt.toFixed(2)}</Text>
                          </View>
                          {acIsEmi && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                              <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Est. Monthly EMI</Text>
                              <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{emi.toFixed(2)}</Text>
                            </View>
                          )}
                          <View style={{ borderTopWidth: 1, borderTopColor: '#f59e0b33', marginTop: 8, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ color: '#f59e0b', fontSize: fs(13), fontWeight: 'bold' }}>Total Repayable</Text>
                            <Text style={{ color: '#f59e0b', fontSize: fs(13), fontWeight: 'bold' }}>₹{(P + totalInt).toFixed(2)}</Text>
                          </View>
                        </>
                      );
                    })()}
                  </View>
                )}
              </>
            )}
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} onPress={handleSaveAccount}>
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>{editingId ? 'Update' : 'Add Account'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>

      {/* ── Add Recurring Modal ─────────────────────────────────── */}
      <Modal
        visible={showRecurForm}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRecurForm(false)}
      >
        <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background }]}>
          <ScrollView style={[styles.modalWrap, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowRecurForm(false)}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>Add Recurring Item</Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={{ padding: 16 }}>
            <View style={[styles.chipRow, { marginBottom: 16 }]}>
              {[['Expense', 'EXPENSE', '#ef4444'], ['Income', 'INCOME', '#10b981']].map(([lbl, val, col]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, { flex: 1, justifyContent: 'center', backgroundColor: rType === val ? col : theme.surface, borderColor: rType === val ? col : theme.border }]}
                  onPress={() => setRType(val)}
                >
                  <Text style={[styles.chipText, { textAlign: 'center', color: rType === val ? 'white' : theme.text, fontSize: fs(13), fontWeight: '700' }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Name / Purpose</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
              placeholder={rType === 'INCOME' ? 'e.g. Salary, Rent, Dividends' : 'e.g. Mobile, WiFi, Rent, Netflix'}
              placeholderTextColor={theme.textSubtle}
              value={rName} onChangeText={setRName}
            />
            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Amount (₹)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
              placeholder="0.00" placeholderTextColor={theme.textSubtle}
              keyboardType="numeric" value={rAmount} onChangeText={setRAmount}
            />

            {rType === 'EXPENSE' && (
              <View style={{ marginTop: 12 }}>
                <CustomDropdown
                  label="Expense Category (Optional)"
                  options={expenseCategories.map(c => ({ label: c.name, value: c.id }))}
                  selectedValue={rCategoryId}
                  onSelect={setRCategoryId}
                  placeholder="Select Expense Category..."
                />
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Schedule Type</Text>
            <View style={styles.chipRow}>
              {[['🗓 Fixed Date', 'FIXED'], ['🔄 Dynamic (Days)', 'DYNAMIC']].map(([lbl, val]) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, { flex: 1, justifyContent: 'center', backgroundColor: rScheduleType === val ? '#ef4444' : theme.surface, borderColor: rScheduleType === val ? '#ef4444' : theme.border }]}
                  onPress={() => setRScheduleType(val)}
                >
                  <Text style={[styles.chipText, { textAlign: 'center', color: rScheduleType === val ? 'white' : theme.text, fontSize: fs(13) }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {rScheduleType === 'FIXED' ? (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Day of Month (1–31)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 1 for 1st, 15 for 15th"
                  placeholderTextColor={theme.textSubtle}
                  keyboardType="numeric" value={rAnchorDay} onChangeText={setRAnchorDay}
                />
                <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 6 }}>
                  An entry is created every month on this date. No recalculation on payment.
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Repeats Every</Text>
                <View style={styles.chipRow}>
                  {[['7 days', '7'], ['28 days', '28'], ['30 days', '30'], ['90 days', '90'], ['Custom', 'CUSTOM']].map(([lbl, val]) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.chip, { backgroundColor: rCycleDays === val ? '#ef4444' : theme.surface, borderColor: rCycleDays === val ? '#ef4444' : theme.border }]}
                      onPress={() => setRCycleDays(val)}
                    >
                      <Text style={[styles.chipText, { color: rCycleDays === val ? 'white' : theme.text, fontSize: fs(13) }]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {rCycleDays === 'CUSTOM' && (
                  <>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Custom Days</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                      placeholder="e.g. 45" placeholderTextColor={theme.textSubtle}
                      keyboardType="numeric" value={rCustomDays} onChangeText={setRCustomDays}
                    />
                  </>
                )}
                <DatePicker label="First Due Date" date={rStartDate} onChange={setRStartDate} />
                <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 6 }}>
                  Pay early → next due = expiry + {rCycleDays === 'CUSTOM' ? rCustomDays || '?' : rCycleDays}d.{'\n'}
                  Pay late → next due = payment date + {rCycleDays === 'CUSTOM' ? rCustomDays || '?' : rCycleDays}d.
                </Text>
              </>
            )}

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: rType === 'INCOME' ? '#10b981' : '#ef4444' }]} onPress={handleSaveRecurring}>
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>Add Recurring {rType === 'INCOME' ? 'Income' : 'Payment'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>

      {/* ── Pause Month Picker Modal ────────────────────────────── */}
      <Modal
        visible={!!pauseModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPauseModal(null)}
      >
        {pauseModal && (
          <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setPauseModal(null)}>
                <X color={theme.text} size={22} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>
                Pause months for {pauseModal.item.name}
              </Text>
              <TouchableOpacity onPress={confirmPauseAction}>
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: fs(15) }}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 16 }}>
                Tap months to pause (grey out). Tap again to resume. Selected months will have no scheduled payment.
              </Text>
              <View style={styles.chipRow}>
                {getUpcomingMonths(24).map(({ monthKey, label }) => {
                  const isPaused = pausedSelection.has(monthKey);
                  return (
                    <TouchableOpacity
                      key={monthKey}
                      style={[styles.chip, {
                        backgroundColor: isPaused ? '#f59e0b' : theme.surface,
                        borderColor:     isPaused ? '#f59e0b' : theme.border,
                      }]}
                      onPress={() => togglePauseMonth(monthKey)}
                    >
                      <Text style={[styles.chipText, { color: isPaused ? 'white' : theme.text, fontSize: fs(13) }]}>
                        {isPaused ? '⏸ ' : ''}{label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

        {/* Account History Modal */}
        <Modal
          visible={showHistoryModal}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowHistoryModal(false)}
        >
          <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background, flex: 1 }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <X color={theme.text} size={22} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>Account Sessions History</Text>
              <View style={{ width: 22 }} />
            </View>
            
            <FlatList
              data={accountLogs}
              keyExtractor={item => item.id}
              contentContainerStyle={{ padding: 16 }}
              renderItem={({ item }) => (
                <View style={[styles.logItem, { borderLeftColor: item.action === 'CREATED' ? '#10b981' : item.action === 'DELETED' ? '#ef4444' : '#3b82f6', backgroundColor: theme.surface }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontWeight: '700', fontSize: fs(12), color: item.action === 'CREATED' ? '#10b981' : item.action === 'DELETED' ? '#ef4444' : '#3b82f6' }}>
                      {item.action}
                    </Text>
                    <Text style={{ fontSize: fs(10), color: theme.textSubtle }}>
                      {new Date(item.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <Text style={{ color: theme.text, fontSize: fs(13) }}>{item.details}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <History color={theme.textSubtle} size={40} opacity={0.3} />
                  <Text style={{ color: theme.textSubtle, marginTop: 12, textAlign: 'center' }}>No account history found.</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>

        {/* Repay Loan Modal */}
        <Modal
          visible={!!repayModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setRepayModal(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, width: '100%', padding: 20 }}>
              <Text style={{ fontSize: fs(18), fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Repay Loan: {repayModal?.item.name}</Text>
              
              <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 8 }}>Repayment Amount (₹)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, marginBottom: 16 }]}
                value={repayModal?.amount}
                onChangeText={(val) => setRepayModal(prev => ({ ...prev, amount: val }))}
                keyboardType="numeric"
                autoFocus
              />

              <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 8 }}>Select Payment Source (Bank)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                {accounts.filter(a => a.type === 'BANK').map(bank => (
                  <TouchableOpacity 
                    key={bank.id}
                    onPress={() => setRepayModal(prev => ({ ...prev, bankId: bank.id }))}
                    style={{ 
                      padding: 12, 
                      borderRadius: 10, 
                      borderWidth: 2, 
                      borderColor: repayModal?.bankId === bank.id ? theme.primary : theme.border,
                      backgroundColor: repayModal?.bankId === bank.id ? theme.primary + '11' : theme.surface,
                      marginRight: 10,
                      minWidth: 100,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '700', fontSize: fs(13) }}>{bank.name}</Text>
                    <Text style={{ color: theme.textMuted, fontSize: fs(11) }}>₹{bank.balance.toFixed(0)}</Text>
                  </TouchableOpacity>
                ))}
                {accounts.filter(a => a.type === 'BANK').length === 0 && (
                  <Text style={{ color: theme.danger, fontSize: fs(12) }}>No bank accounts found! Add one first.</Text>
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}
                  onPress={() => setRepayModal(null)}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.primary, alignItems: 'center' }}
                  onPress={confirmRepayment}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Convert to EMI Modal */}
        <Modal
          visible={!!emiModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setEmiModal(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 16, width: '100%', padding: 20 }}>
              <Text style={{ fontSize: fs(18), fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Convert to EMI: {emiModal?.item.name}</Text>
              
              <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 8 }}>Loan Tenure (Months)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, color: theme.text, marginBottom: 20 }]}
                value={emiModal?.tenureMonths}
                onChangeText={(val) => setEmiModal(prev => ({ ...prev, tenureMonths: val }))}
                keyboardType="numeric"
                autoFocus
                placeholder="e.g. 12"
              />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }}
                  onPress={() => setEmiModal(null)}
                >
                  <Text style={{ color: theme.text, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#8b5cf6', alignItems: 'center' }}
                  onPress={confirmEmiConversion}
                >
                  <Text style={{ color: 'white', fontWeight: '700' }}>Convert</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  pageTitle: { fontWeight: '800', marginBottom: 16, marginTop: 4 },
  tile: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 1, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  tileIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontWeight: '700' },
  tileSub: { marginTop: 3 },
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: '700' },
  addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { textAlign: 'center', lineHeight: 24 },
  card: { borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4 },
  cardName: { fontWeight: '600' },
  cardSub: { marginTop: 4 },
  cardAmount: { fontWeight: '700' },
  fieldLabel: { fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: 'white', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontWeight: '600' },
  statsRow: { flexDirection: 'row', marginTop: 14, paddingTop: 12, borderTopWidth: 1 },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { fontWeight: '700' },
  statLabel: { marginTop: 3 },
  statDivider: { width: 1, marginHorizontal: 4 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  actionStrip: { flexDirection: 'row', gap: 4, marginTop: 12, paddingTop: 10, borderTopWidth: 1, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'transparent' },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
});
