import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { addMonths, format } from 'date-fns';
import { Check, Info, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  getAccounts,
  getCategories,
  getEmis, getExpectedExpenses,
  payEmi, payExpectedExpense,
  saveCategory,
  saveEmi,
  saveTransaction,
  ensureSystemCategories
} from '../services/storage';
import { toUTC } from '../utils/dateUtils';

// Modular Components
import AmountHero from '../components/transactions/AmountHero';
import {
  AccountCategoryFields,
  EmiDetailsEntry, NoteDateFields,
  TransferDetails,
  UpcomingSettleFields
} from '../components/transactions/TransactionFields';
import TypeSelector from '../components/transactions/TypeSelector';
import { validateTransaction } from '../utils/transactionValidation';

const TRANSACTION_TYPES = [
  { label: 'Expense', value: 'EXPENSE', color: '#ef4444' },
  { label: 'Income', value: 'INCOME', color: '#10b981' },
  { label: 'Transfer', value: 'TRANSFER', color: '#3b82f6' },
  { label: 'CC Pay', value: 'CC_PAY', color: '#8b5cf6' },
];

export default function AddTransaction({ onClose, route }) {
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();
  const navigation = useNavigation();

  const [accounts, setAccounts] = useState([]);
  const [type, setType] = useState('EXPENSE');
  const [lockedType, setLockedType] = useState(false);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState(null);
  const [toAccountId, setToAccountId] = useState(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [tenure, setTenure] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [serviceCharge, setServiceCharge] = useState('');
  const [taxPercentage, setTaxPercentage] = useState('');

  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'error' });

  const [upcomingItems, setUpcomingItems] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedUpcomingId, setSelectedUpcomingId] = useState(null);
  const [upcomingType, setUpcomingType] = useState('EXPENSE');

  const showToast = (message, type = 'error') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast({ visible: false, message: '', type: 'error' }), 3000);
  };

  const loadData = useCallback(async () => {
    if (!activeUser) return;
    const [accs, emis, expected] = await Promise.all([
      getAccounts(activeUser.id),
      getEmis(activeUser.id),
      getExpectedExpenses(activeUser.id)
    ]);

    setAccounts(accs);
    if (accs.length > 0 && !accountId) setAccountId(accs[0].id);

    const activeEmis = emis.filter(e => e.paidMonths < e.tenure).map(e => ({ ...e, itemType: 'EMI' }));
    const activeExpected = expected.filter(e => e.isDone === 0).map(e => ({ ...e, itemType: 'EXPENSE' }));
    setUpcomingItems([...activeEmis, ...activeExpected]);

    // Ensure system categories and fetch
    await ensureSystemCategories(activeUser.id);
    const cats = await getCategories(activeUser.id, ['EXPENSE', 'EMI Payment', 'CC Limit Blockage', 'PAYMENT']);
    setCategories(cats);
  }, [activeUser]);

  useFocusEffect(useCallback(() => {
    setAmount(''); setNote(''); setToAccountId(null); setCategoryId(null); setDate(new Date());
    setTenure(''); setInterestRate(''); setServiceCharge(''); setTaxPercentage(''); setSelectedUpcomingId(null);
    loadData();
    if (route?.params?.type) { setType(route.params.type); setLockedType(!!route.params.locked); }
    else { setType('EXPENSE'); setLockedType(false); }
  }, [route?.params, loadData]));

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const cat = await saveCategory(activeUser.id, newCategoryName.trim(), 'EXPENSE');
    setCategories([...categories, cat]);
    setCategoryId(cat.id);
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  const handleSave = async () => {
    const err = validateTransaction(type, { amount, accountId, categoryId, toAccountId, tenure, selectedUpcomingId });
    if (err) { showToast(err); return; }

    if (type === 'PAY_UPCOMING') {
      const selectedItem = upcomingItems.find(i => i.id === selectedUpcomingId);
      if (!selectedItem) return;
      if (selectedItem.itemType === 'EMI') await payEmi(activeUser.id, selectedUpcomingId, accountId);
      else await payExpectedExpense(activeUser.id, selectedUpcomingId, accountId);
    } else if (type === 'EMI') {
      await saveEmi(activeUser.id, {
        accountId, amount: parseFloat(amount), emiDate: date.getDate(),
        tenure: parseInt(tenure, 10), interestRate: parseFloat(interestRate) || 0,
        serviceCharge: parseFloat(serviceCharge) || 0, taxPercentage: parseFloat(taxPercentage) || 0, note,
      });
    } else {
      let finalCategoryId = categoryId;
      const isCC = accounts.find(acc => acc.id === accountId)?.type === 'CREDIT_CARD';
      let finalType = type;

      if (type === 'EXPENSE' && isCC) {
        finalType = 'CC_EXPENSE';
      }

      const isSpecial = ['REPAY_LOAN', 'PAY_BORROWED', 'LEND_MONEY', 'COLLECT_REPAYMENT', 'CC_PAY'].includes(type);
      if (isSpecial) {
        if (type === 'CC_PAY') {
          const ccPayCat = categories.find(c => c.name.toLowerCase() === 'cc pay');
          if (ccPayCat) finalCategoryId = ccPayCat.id;
        } else {
          const loansCat = categories.find(c => c.name.toLowerCase() === 'loan repayment');
          if (loansCat) finalCategoryId = loansCat.id;
        }
      }

      await saveTransaction(activeUser.id, {
        type: type === 'CC_PAY' ? 'CC_PAY' : (isSpecial ? 'EXPENSE' : finalType),
        amount: parseFloat(amount), accountId,
        categoryId: (type === 'EXPENSE' || finalType === 'CC_EXPENSE' || type === 'CC_PAY' || isSpecial) ? finalCategoryId : null,
        toAccountId: (type === 'TRANSFER' || type === 'PAYMENT' || type === 'CC_PAY' || isSpecial) ? toAccountId : undefined,
        note: (type === 'REPAY_LOAN' || type === 'PAY_BORROWED') ? `${type.replace('_', ' ')}: ${note || 'Partial'}` :
          type === 'LEND_MONEY' ? `Lent: ${note}` : type === 'COLLECT_REPAYMENT' ? `Collected: ${note}` : note,
        date: toUTC(date, activeUser?.timezone),
      });
    }

    if (onClose) onClose(); else navigation.navigate('Dashboard');
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <CustomHeader
        title="Add Transaction"
        leftComponent={<View style={{ width: 40 }} />}
        rightComponent={
          <TouchableOpacity onPress={() => { if (onClose) onClose(); else navigation.goBack(); }} style={styles.headerBtn}>
            <X color={theme.textMuted} size={22} />
          </TouchableOpacity>
        }
        theme={theme}
        fs={fs}
      />

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, marginTop: 12 }]}>
          <Text style={[styles.cardHeader, { color: theme.textSubtle, marginBottom: 6 }]}>Transaction Type</Text>
          <TypeSelector type={type} setType={setType} lockedType={lockedType} theme={theme} transactionTypes={TRANSACTION_TYPES} />
        </View>

        <AmountHero amount={amount} setAmount={setAmount} type={type} theme={theme} autoFocus={type !== 'PAY_UPCOMING'} />

        <UpcomingSettleFields
          theme={theme} type={type} upcomingType={upcomingType} setUpcomingType={setUpcomingType}
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          selectedUpcomingId={selectedUpcomingId} setSelectedUpcomingId={(id) => {
            const item = upcomingItems.find(i => i.id === id);
            setSelectedUpcomingId(id);
            if (item) { setAmount(item.amount.toString()); setNote(item.type === 'INCOME' ? `Received ${item.name}` : `Paid ${item.name || item.note}`); }
          }}
          upcomingItems={upcomingItems} format={format} addMonths={addMonths}
        />

        <AccountCategoryFields
          theme={theme} type={type} accountId={accountId} setAccountId={setAccountId}
          accounts={
            type === 'EXPENSE' ? accounts.filter(acc => acc.type === 'BANK' || acc.type === 'CREDIT_CARD') :
              type === 'INCOME' ? accounts.filter(acc => acc.type === 'BANK') :
                type === 'TRANSFER' ? accounts.filter(acc => acc.type === 'BANK' || acc.type === 'INVESTMENT') :
                  type === 'PAYMENT' || type === 'CC_PAY' ? accounts.filter(acc => acc.type === 'BANK') :
                    type === 'PAY_UPCOMING' ? accounts.filter(acc => {
                      const item = upcomingItems.find(i => i.id === selectedUpcomingId);
                      if (item?.itemType === 'EXPENSE') {
                        if (item?.type === 'INCOME') return acc.type === 'BANK';
                        return acc.type === 'BANK' || acc.type === 'CREDIT_CARD';
                      }
                      return true;
                    }) : accounts
          }
          categoryId={categoryId} setCategoryId={setCategoryId} categories={categories.filter(c => c.isSystem !== 1)}
          showAddCategory={showAddCategory} setShowAddCategory={setShowAddCategory}
          newCategoryName={newCategoryName} setNewCategoryName={setNewCategoryName} handleCreateCategory={handleCreateCategory}
        />

        <TransferDetails 
          theme={theme} type={type} accountId={accountId} toAccountId={toAccountId} setToAccountId={setToAccountId} 
          accounts={
            type === 'TRANSFER' ? accounts.filter(acc => acc.type === 'BANK' || acc.type === 'INVESTMENT') : 
            type === 'PAYMENT' || type === 'CC_PAY' ? accounts.filter(acc => acc.type === 'CREDIT_CARD') :
            accounts
          } 
        />

        <EmiDetailsEntry
          theme={theme} type={type} amount={amount} tenure={tenure} setTenure={setTenure}
          interestRate={interestRate} setInterestRate={setInterestRate}
          serviceCharge={serviceCharge} setServiceCharge={setServiceCharge}
          taxPercentage={taxPercentage} setTaxPercentage={setTaxPercentage} fs={fs}
        />

        <NoteDateFields theme={theme} type={type} note={note} setNote={setNote} date={date} setDate={setDate} />

        <View style={{ padding: 25, alignItems: 'flex-end' }}>
          <TouchableOpacity
            style={[styles.roundSubmitBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
            onPress={handleSave}
            activeOpacity={0.8}
          >
            <Check color="white" size={28} strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {toast.visible && (
        <View style={[styles.toast, { backgroundColor: toast.type === 'error' ? '#ef4444' : '#10b981' }]}>
          <Info color="white" size={20} />
          <Text style={styles.toastText}>{toast.message.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { padding: 8, borderRadius: 20 },
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.2,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  selectionCard: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1.2,
    elevation: 1,
  },
  cardHeader: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
    opacity: 0.7
  },
  roundSubmitBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 10000,
    elevation: 10
  },
  toastText: { color: 'white', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
});
