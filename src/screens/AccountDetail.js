import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import {
  Archive,
  ChevronLeft,
  Plus,
  ShieldAlert, ShieldPlus
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Storage & Utils
import {
  deleteBudget,
  deleteRecurringByAccountId,
  deleteRecurringPayment,
  getAccounts,
  getBudgets,
  getCategories,
  getDb,
  getExpectedExpenses,
  getRecurringPayments,
  restartRecurringPayment,
  softDeleteAccount,
  stopRecurringPayment
} from '../services/storage';
import { getCurrencySymbol } from '../utils/currencyUtils';


// Modular Components
import { AccountCard, RecurringCard } from '../components/accounts/AccountCards';
import AddBudgetModal from '../components/accounts/AddBudgetModal';
import AddEditAccountModal from '../components/accounts/AddEditAccountModal';
import AddFineModal from '../components/accounts/AddFineModal';
import AddRecurringModal from '../components/accounts/AddRecurringModal';
import BudgetCard from '../components/accounts/cards/BudgetCard';
import ConvertToEmiModal from '../components/accounts/ConvertToEmiModal';
import ForecloseEmiModal from '../components/accounts/ForecloseEmiModal';
import PausePickerModal from '../components/accounts/PausePickerModal';
import RepayLoanModal from '../components/accounts/RepayLoanModal';
import LoanForecloseModal from '../components/loans/LoanForecloseModal';

const SECTION_CONFIG = {
  'BANK': { label: 'Bank Accounts', color: '#3b82f6' },
  'CREDIT_CARD': { label: 'Credit Cards', color: '#8b5cf6' },
  'INVESTMENT': { label: 'Investments', color: '#10b981' },
  'SIP': { label: 'SIPs', color: '#06b6d4' },
  'LOAN': { label: 'Loans', color: '#f59e0b' },
  'BORROWED': { label: 'Borrowed (Liability)', color: '#ef4444' },
  'LENDED': { label: 'Lended (Asset)', color: '#10b981' },
  'EMI': { label: 'Credit Card EMIs', color: '#ec4899' },
  'RECURRING': { label: 'Monthly Schedules', color: '#ef4444' },
};

export default function AccountDetail() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();

  const { sectionKey, showClosed } = route.params || {};
  const config = SECTION_CONFIG[sectionKey] || { label: 'Details', color: theme.primary };
  const pageTitle = showClosed ? 'Closed EMIs' : config.label;

  const [accounts, setAccounts] = useState([]);
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [expectedExpenses, setExpectedExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('EXPENSE');
  const [budgets, setBudgets] = useState([]);

  // Modals Visibility
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRecurForm, setShowRecurForm] = useState(false);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [showConverModal, setShowConvertModal] = useState(false);
  const [showPausePicker, setShowPausePicker] = useState(false);
  const [showAddFineModal, setShowAddFineModal] = useState(false);
  const [showForecloseModal, setShowForecloseModal] = useState(false);
  const [showLoanForecloseModal, setShowLoanForecloseModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  // State for focused items
  const [editingId, setEditingId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [selectedRecurring, setSelectedRecurring] = useState(null);

  // PIN Verification State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');

  const displayCategories = useMemo(() => categories?.filter(c => c.isSystem !== 1) || [], [categories]);

  const loadData = useCallback(async () => {
    if (!activeUser) return;
    setRefreshing(true);
    const [accs, recurs, cats, exps, buds] = await Promise.all([
      getAccounts(activeUser.id),
      getRecurringPayments(activeUser.id),
      getCategories(activeUser.id, ['EXPENSE', 'INCOME']),
      getExpectedExpenses(activeUser.id),
      getBudgets(activeUser.id)
    ]);
    setAccounts(accs);
    setRecurringPayments(recurs);
    setCategories(cats);
    setExpectedExpenses(exps);
    setBudgets(buds);
    setRefreshing(false);
  }, [activeUser]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const items = useMemo(() => {
    if (sectionKey === 'RECURRING') {
      if (activeTab === 'BUDGET') return budgets || [];

      // Combine Recurring Rule Templates with Standalone Scheduled Items (one-offs)
      const allItems = [
        ...(recurringPayments || []),
        ...(expectedExpenses || []).filter(ee => ee.isStandalone === 1)
      ];

      return allItems
        .filter(item => item && (item.isDeleted === 0 || item.isDeleted === null))
        .filter(item => {
          const type = (item.type || 'EXPENSE').toUpperCase();
          return type === activeTab;
        })
        .map(item => ({ ...item, status: item.status || 'ACTIVE' }));
    }
    let baseItems = (accounts || []).filter(acc => acc && acc.type === sectionKey);

    if (sectionKey === 'CREDIT_CARD') {
      return baseItems.map(cc => ({ ...cc, totalUsage: cc.balance || 0 }));
    } else if (sectionKey === 'EMI') {
      baseItems = baseItems.filter(acc => showClosed ? acc.isClosed : !acc.isClosed);
    }
    return baseItems;
  }, [accounts, recurringPayments, budgets, expectedExpenses, sectionKey, showClosed, activeTab]);

  const recurringStats = useMemo(() => {
    const stats = {};
    (recurringPayments || []).forEach(rp => {
      if (!rp) return;
      const sessions = activeUser?.sessions || [];
      const relevant = sessions.filter(s => s.details && s.details.includes(rp.name));
      const year = new Date().getFullYear();
      stats[rp.name] = {
        totalPaid: relevant.reduce((sum, s) => {
          const match = s.details && (s.details.match(/[^0-9\s,]{1,5}\s?([\d,.]+)/));
          return sum + (match ? parseFloat(match[1].replace(/,/g, '')) : 0);
        }, 0),
        yearPaid: relevant.filter(s => s.timestamp && new Date(s.timestamp).getFullYear() === year).reduce((sum, s) => {
          const match = s.details && (s.details.match(/[^0-9\s,]{1,5}\s?([\d,.]+)/));
          return sum + (match ? parseFloat(match[1].replace(/,/g, '')) : 0);
        }, 0),
        timesTotal: relevant.length
      };
    });
    return stats;
  }, [recurringPayments, activeUser?.sessions]);

  // Handlers
  const openAddForm = () => { setEditingId(null); setSelectedItem(null); setShowAddForm(true); };
  const openEditForm = (item) => { setEditingId(item.id); setSelectedItem(item); setShowAddForm(true); };

  const handleDeleteAccount = (item) => {
    if (item.type === 'EMI' || item.type === 'CREDIT_CARD') {
      setSelectedItem(item);
      setPinValue('');
      setPinError('');
      setShowPinModal(true);
    } else {
      Alert.alert('Delete Account', 'This will permanently remove this account and all history. Continue?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const db = await getDb();
            await softDeleteAccount(db, item.id);
            loadData();
          }
        }
      ]);
    }
  };

  const confirmSecureDelete = async () => {
    if (pinValue !== activeUser.pin) {
      setPinError('Incorrect PIN');
      setPinValue('');
      return;
    }
    setShowPinModal(false);
    const db = await getDb();
    await softDeleteAccount(db, selectedItem.id);
    loadData();
  };

  const handleDeleteRecurring = (id) => {
    Alert.alert('Delete Recurring', 'Stop and delete this recurring item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteRecurringPayment(id); loadData(); } }
    ]);
  };

  const handleStopRecurring = async (item) => {
    Alert.alert('Stop Recurring', 'No more auto-transactions will be created for this. You can restart later.', [
      { text: 'Cancel' },
      { text: 'Stop', onPress: async () => { await stopRecurringPayment(item.id); loadData(); } }
    ]);
  };

  const handleRestartRecurring = async (item) => {
    await restartRecurringPayment(item.id);
    loadData();
  };

  const handleRevertFromEmi = async (item) => {
    Alert.alert('Revert to Loan', 'Convert this EMI back to a standard reducing balance loan?', [
      { text: 'No' },
      {
        text: 'Revert', onPress: async () => {
          const db = await getDb();
          await Promise.all([
            updateLoanInfo(db, item.id, { ...item, isEmi: 0, loanTenure: (item.loanTenure || 0) / 12 }),
            deleteRecurringByAccountId(item.id)
          ]);
          loadData();
        }
      }
    ]);
  };

  const handleDeleteBudget = (budget) => {
    Alert.alert('Delete Budget', `Are you sure you want to delete "${budget.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteBudget(budget.id); loadData(); } }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CustomHeader
        title={pageTitle}
        showProfile={false}
        leftComponent={
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronLeft color={theme.text} size={28} />
          </TouchableOpacity>
        }
        theme={theme}
        fs={fs}
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        {sectionKey === 'RECURRING' && (
          <View style={[styles.tabContainer, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {['EXPENSE', 'INCOME', 'BUDGET'].map(tab => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && { backgroundColor: theme.primary }
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[
                  styles.tabText,
                  { color: activeTab === tab ? 'white' : theme.textSubtle, fontSize: fs(12) }
                ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {!refreshing && items.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyText, { color: theme.textMuted, fontSize: fs(14) }]}>
              {showClosed ? 'No closed items found.' : 'No items found. Tap + to add.'}
            </Text>
          </View>
        )}
        {items.map(item => (
          sectionKey === 'RECURRING' ? (
            activeTab === 'BUDGET' ? (
              <BudgetCard
                key={item.id} item={item} categories={categories}
                theme={theme} fs={fs} onDelete={handleDeleteBudget}
                onEdit={(b) => { setSelectedBudget(b); setShowBudgetModal(true); }}
              />
            ) : (
              <RecurringCard
                key={item.id} item={item} theme={theme} fs={fs}
                onPause={(i) => { setSelectedItem(i); setShowPausePicker(true); }}
                onStop={handleStopRecurring} onRestart={handleRestartRecurring}
                onDelete={(i) => handleDeleteRecurring(i.id)}
                onEdit={(i) => { setSelectedRecurring(i); setShowRecurForm(true); }}
              />
            )
          ) : (
            <AccountCard
              key={item.id} item={item} theme={theme} fs={fs} color={config.color}
              accounts={accounts}
              onEdit={openEditForm} onDelete={() => handleDeleteAccount(item)}
              onRefresh={loadData}
              onPauseMonth={(r) => { setSelectedItem(r); setShowPausePicker(true); }}
              onForeclose={(i) => {
                setSelectedItem(i);
                if (['LOAN', 'BORROWED', 'LENDED'].includes(i.type)) {
                  setShowLoanForecloseModal(true);
                } else {
                  setShowForecloseModal(true);
                }
              }}
              onRepay={(i) => {
                setSelectedItem(i);
                setShowRepayModal(true);
              }}
              onConvert={(i) => { setSelectedItem(i); setShowConvertModal(true); }}
              onRevert={handleRevertFromEmi}
              onCalendar={(i) => {
                const target = ['LOAN', 'BORROWED', 'LENDED'].includes(i.type) ? 'LoanDetails' : 'EmiDetails';
                navigation.navigate(target, { accountId: i.id });
              }}
              onAddFine={(i) => { setSelectedItem(i); setShowAddFineModal(true); }}
              onPauseRecurring={(r) => { setSelectedItem(r); setShowPausePicker(true); }}
              onStopRecurring={handleStopRecurring} onRestartRecurring={handleRestartRecurring}
            />
          )
        ))}
      </ScrollView>

      {!showClosed && (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: sectionKey === 'EMI' ? '#ec4899' : (sectionKey === 'RECURRING' ? '#ef4444' : theme.primary) }]}
          onPress={() => sectionKey === 'RECURRING' ? setShowRecurForm(true) : openAddForm()}
        >
          <Plus color="#FFF" size={24} />
        </TouchableOpacity>
      )}

      {sectionKey === 'EMI' && !showClosed && (
        <TouchableOpacity
          style={[styles.archiveBtn, { backgroundColor: '#10b981', borderColor: '#10b981' }]}
          onPress={() => navigation.push('AccountDetail', { sectionKey: 'EMI', showClosed: true })}
        >
          <Archive color="#FFF" size={20} />
        </TouchableOpacity>
      )}

      {sectionKey === 'RECURRING' && !showClosed && (
        <TouchableOpacity
          style={[styles.archiveBtn, { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }]}
          onPress={() => setShowBudgetModal(true)}
        >
          <ShieldPlus color="#FFF" size={20} />
        </TouchableOpacity>
      )}

      {/* Modular Modals */}
      <AddEditAccountModal
        visible={showAddForm} editingId={editingId} accountData={selectedItem}
        openSection={{ ...config, key: sectionKey }} accounts={accounts} activeUser={activeUser}
        expenseCategories={displayCategories}
        onClose={() => setShowAddForm(false)} onSuccess={loadData}
      />

      <AddRecurringModal
        visible={showRecurForm} accounts={accounts} activeUser={activeUser}
        expenseCategories={displayCategories}
        initialData={selectedRecurring}
        onClose={() => { setShowRecurForm(false); setSelectedRecurring(null); }}
        onSuccess={loadData}
      />

      <RepayLoanModal
        visible={showRepayModal} item={selectedItem} accounts={accounts}
        activeUser={activeUser}
        onClose={() => setShowRepayModal(false)} onSuccess={loadData}
      />

      <ConvertToEmiModal
        visible={showConverModal} item={selectedItem} accounts={accounts}
        activeUser={activeUser}
        onClose={() => setShowConvertModal(false)} onSuccess={loadData}
      />

      <PausePickerModal
        visible={showPausePicker} item={selectedItem}
        onClose={() => setShowPausePicker(false)} onSuccess={loadData}
      />

      <AddFineModal
        visible={showAddFineModal} item={selectedItem} accounts={accounts}
        onClose={() => setShowAddFineModal(false)}
        onSuccess={loadData}
      />

      <ForecloseEmiModal
        visible={showForecloseModal} item={selectedItem} accounts={accounts}
        activeUser={activeUser}
        onClose={() => setShowForecloseModal(false)} onSuccess={loadData}
      />

      <LoanForecloseModal
        visible={showLoanForecloseModal} item={selectedItem} accounts={accounts}
        activeUser={activeUser}
        onClose={() => setShowLoanForecloseModal(false)} onSuccess={loadData}
      />

      <AddBudgetModal
        visible={showBudgetModal}
        activeUser={activeUser}
        categories={displayCategories}
        initialData={selectedBudget}
        onClose={() => { setShowBudgetModal(false); setSelectedBudget(null); }}
        onSuccess={loadData}
      />

      {/* PIN VERIFICATION MODAL */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 28, width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ShieldAlert color={theme.danger} size={24} />
              <Text style={{ color: theme.danger, fontSize: fs(18), fontWeight: 'bold' }}>Security Check</Text>
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(14), marginBottom: 20 }}>
              {selectedItem?.type === 'CREDIT_CARD'
                ? "This action will permanently delete this Credit Card and ALL associated EMI accounts and scheduled payments. All transactions will be preserved for history.\n\nEnter your 4-digit PIN to confirm."
                : `This will delete the EMI account and the remaining balance of ${getCurrencySymbol(activeUser?.currency)}${(selectedItem?.ccRemaining || selectedItem?.balance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} will be added back to your credit card's remaining limit.\n\nEnter your 4-digit PIN to confirm.`}
            </Text>
            <TextInput
              style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: pinError ? theme.danger : theme.border, borderRadius: 10, padding: 14, fontSize: fs(18), color: theme.text, letterSpacing: 8, textAlign: 'center', marginBottom: 8 }}
              keyboardType="numeric" maxLength={4} secureTextEntry value={pinValue} onChangeText={(v) => { setPinValue(v); setPinError(''); }} placeholder="••••" placeholderTextColor={theme.textSubtle} autoFocus
            />
            {pinError ? <Text style={{ color: theme.danger, fontSize: fs(12), marginBottom: 12, textAlign: 'center' }}>{pinError}</Text> : <View style={{ height: 20 }} />}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }} onPress={() => setShowPinModal(false)}>
                <Text style={{ color: theme.textSubtle, fontWeight: '600', fontSize: fs(15) }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.danger, alignItems: 'center' }} onPress={confirmSecureDelete}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(15) }}>Confirm Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backBtn: { padding: 4, marginLeft: -4 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    top: 55,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 20
  },
  archiveBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 70,
    top: 55,
    borderWidth: 1,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 20
  },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    marginBottom: 20
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabText: {
    fontWeight: '800',
    letterSpacing: 0.5
  }
});
