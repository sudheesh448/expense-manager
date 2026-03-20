import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAccounts, saveTransaction, saveEmi, payEmi, payExpectedExpense, getEmis, getExpectedExpenses, getCategories, saveCategory } from '../services/storage';
import { format, addMonths } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import DatePicker from '../components/DatePicker';

import CustomDropdown from '../components/CustomDropdown';
import { 
  X, Check, TrendingDown, TrendingUp, ArrowRightLeft, 
  Wallet, Tag, Calendar, Clock, Landmark, Info, Plus 
} from 'lucide-react-native';

const TRANSACTION_TYPES = [
  { label: 'Expense',          value: 'EXPENSE',           icon: TrendingDown,   color: '#ef4444' },
  { label: 'Income',           value: 'INCOME',            icon: TrendingUp,     color: '#10b981' },
  { label: 'Transfer',         value: 'TRANSFER',          icon: ArrowRightLeft, color: '#3b82f6' },
  { label: 'CC Pay',           value: 'PAYMENT',           icon: ArrowRightLeft, color: '#8b5cf6' },
  { label: 'Repay Loan',       value: 'REPAY_LOAN',        icon: Landmark,       color: '#f59e0b' },
  { label: 'Pay Borrowed',     value: 'PAY_BORROWED',      icon: Landmark,       color: '#f59e0b' },
  { label: 'Lend Money',       value: 'LEND_MONEY',        icon: Wallet,         color: '#ec4899' },
  { label: 'Collect Repay',    value: 'COLLECT_REPAYMENT', icon: Wallet,         color: '#10b981' },
  { label: 'EMI',              value: 'EMI',               icon: Clock,          color: '#ec4899' },
  { label: 'Upcoming',         value: 'PAY_UPCOMING',      icon: Clock,          color: '#6366f1' },
];

export default function AddTransaction({ onClose, route }) {
  const { activeUser } = useAuth();
  const { theme } = useTheme();
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
  
  // Category state
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Pay upcoming state
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedUpcomingId, setSelectedUpcomingId] = useState(null);
  const [upcomingType, setUpcomingType] = useState('EXPENSE');

  useFocusEffect(
    React.useCallback(() => {
      loadAccounts();
      if (route?.params?.type) {
        setType(route.params.type);
        setLockedType(!!route.params.locked);
      } else {
        setLockedType(false);
      }
    }, [route?.params, loadAccounts])
  );

  const loadAccounts = async () => {
    const data = await getAccounts(activeUser.id);
    setAccounts(data);
    if (data.length > 0 && !accountId) {
      setAccountId(data[0].id);
    }
    
    const fetchedEmis = await getEmis(activeUser.id);
    const activeEmis = fetchedEmis.filter(e => e.paidMonths < e.tenure).map(e => ({ ...e, itemType: 'EMI' }));
    
    const expected = await getExpectedExpenses(activeUser.id);
    const activeExpected = expected.filter(e => e.isDone === 0).map(e => ({ ...e, itemType: 'EXPENSE' }));
    
    setUpcomingItems([...activeEmis, ...activeExpected]);
    setSelectedMonth(format(new Date(), 'yyyy-MM'));
    
    // Categories
    const fetchedCategories = await getCategories(activeUser.id, 'EXPENSE');
    setCategories(fetchedCategories);
    
    // Ensure "Loan Repayment" category exists for loan repayment
    if (!fetchedCategories.some(c => c.name.toLowerCase() === 'loan repayment')) {
      await saveCategory(activeUser.id, 'Loan Repayment', 'EXPENSE');
      const updatedCats = await getCategories(activeUser.id, 'EXPENSE');
      setCategories(updatedCats);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    const cat = await saveCategory(activeUser.id, newCategoryName.trim(), 'EXPENSE');
    setCategories([...categories, cat]);
    setCategoryId(cat.id);
    setNewCategoryName('');
    setShowAddCategory(false);
  };

  const handleSave = async () => {
    if (type === 'PAY_UPCOMING') {
      const selectedItem = upcomingItems.find(i => i.id === selectedUpcomingId);
      if (!selectedItem || !accountId) return;
      
      if (selectedItem.itemType === 'EMI') {
         await payEmi(activeUser.id, selectedUpcomingId, accountId);
      } else {
         await payExpectedExpense(activeUser.id, selectedUpcomingId, accountId);
      }
      
      setAmount('');
      setNote('');
      setSelectedUpcomingId(null);
      if (onClose) onClose();
      else navigation.navigate('Dashboard');
      return;
    }

    if (!amount || !accountId) return;
    if ((type === 'TRANSFER' || type === 'PAYMENT') && !toAccountId) return;
    if (type === 'EMI' && !tenure) return;

    if (type === 'EMI') {
      await saveEmi(activeUser.id, {
        accountId,
        amount: parseFloat(amount),
        emiDate: date.getDate(),
        tenure: parseInt(tenure, 10),
        interestRate: parseFloat(interestRate) || 0,
        note,
      });
    } else {
      // For repayments, we want it to be an EXPENSE in the "Loan Repayment" category
      let finalCategoryId = categoryId;
      const isLoanRepayment = type === 'REPAY_LOAN' || type === 'PAY_BORROWED';
      const isLendedAction = type === 'LEND_MONEY' || type === 'COLLECT_REPAYMENT';
      
      const isRepayment = isLoanRepayment || type === 'COLLECT_REPAYMENT';
      
      if (isRepayment || type === 'LEND_MONEY') {
        const loansCat = categories.find(c => c.name.toLowerCase() === 'loan repayment');
        if (loansCat) {
          finalCategoryId = loansCat.id;
        }
      }

      await saveTransaction(activeUser.id, {
        type: (isLoanRepayment || type === 'LEND_MONEY' || type === 'COLLECT_REPAYMENT') ? 'EXPENSE' : type,
        amount: parseFloat(amount),
        accountId,
        categoryId: (type === 'EXPENSE' || isLoanRepayment || isLendedAction) ? finalCategoryId : null,
        toAccountId: (type === 'TRANSFER' || type === 'PAYMENT' || isLoanRepayment || isLendedAction) ? toAccountId : undefined,
        note: isLoanRepayment ? `${type === 'REPAY_LOAN' ? 'Loan' : 'Borrowed'} Repayment: ${note || 'Partial Payment'}` : 
              type === 'LEND_MONEY' ? `Lent Money: ${note || 'Initial'}` :
              type === 'COLLECT_REPAYMENT' ? `Collected Repayment: ${note || 'Partial'}` : note,
        date: date.toISOString(),
      });
    }

    setAmount('');
    setNote('');
    setTenure('');
    setCategoryId(null);
    if (onClose) onClose();
    else navigation.navigate('Dashboard');
  };


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
          <Check color={theme.primary} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Add Transaction</Text>
        <TouchableOpacity onPress={() => { if (onClose) onClose(); else navigation.goBack(); }} style={styles.headerBtn}>
          <X color={theme.textMuted} size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Amount Section */}
        <View style={[styles.amountContainer, { backgroundColor: theme.surface }]}>
          <Text style={[styles.amountLabel, { color: theme.textMuted }]}>
            {type === 'EMI' ? 'PURCHASE AMOUNT' : 'AMOUNT'}
          </Text>
          <View style={styles.amountInputRow}>
            <Text style={[styles.currencySymbol, { color: theme.textSubtle }]}>₹</Text>
            <TextInput 
              style={[styles.amountInput, { color: theme.text }]} 
              placeholder="0.00"
              placeholderTextColor={theme.textSubtle}
              keyboardType="numeric"
              autoFocus={true}
              value={amount} 
              onChangeText={setAmount} 
            />
          </View>
        </View>

        {/* Type Selector (Dropdown - Concise) */}
        <View style={styles.fieldContainer}>
          <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '22', marginTop: 4 }]}>
            <Info color={theme.primary} size={20} />
          </View>
          <View style={styles.fieldContent}>
            <CustomDropdown 
              label="TRANSACTION TYPE"
              selectedValue={type}
              disabled={lockedType}
              onSelect={(val) => {
                if (lockedType) return;
                setType(val);
                if (val === 'PAY_UPCOMING') setUpcomingType('EXPENSE');
              }}
              options={TRANSACTION_TYPES.map(t => ({ label: t.label, value: t.value }))}
            />
          </View>
        </View>

        {type === 'PAY_UPCOMING' ? (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>ITEM TYPE</Text>
              <View style={styles.chipRow}>
                <TouchableOpacity 
                  style={[styles.chip, { backgroundColor: upcomingType === 'EXPENSE' ? theme.primary : theme.surface, borderColor: upcomingType === 'EXPENSE' ? theme.primary : theme.border }]}
                  onPress={() => { setUpcomingType('EXPENSE'); setSelectedUpcomingId(null); }}
                >
                  <Text style={{ color: upcomingType === 'EXPENSE' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>EXPENSES</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.chip, { backgroundColor: upcomingType === 'INCOME' ? theme.primary : theme.surface, borderColor: upcomingType === 'INCOME' ? theme.primary : theme.border }]}
                  onPress={() => { setUpcomingType('INCOME'); setSelectedUpcomingId(null); }}
                >
                  <Text style={{ color: upcomingType === 'INCOME' ? '#fff' : theme.text, fontWeight: '700', fontSize: 13 }}>INCOMES</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: '#3b82f622', marginTop: 4 }]}>
                <Calendar color="#3b82f6" size={20} />
              </View>
              <View style={styles.fieldContent}>
                <CustomDropdown 
                  label="Target Month"
                  placeholder="Select Month..."
                  selectedValue={selectedMonth}
                  onSelect={setSelectedMonth}
                  options={Array.from({length: 6}).map((_, i) => {
                    const m = format(addMonths(new Date(), i), 'yyyy-MM');
                    return { label: m, value: m };
                  })}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '22', marginTop: 4 }]}>
                <Check color={theme.primary} size={20} />
              </View>
              <View style={styles.fieldContent}>
                <CustomDropdown 
                  label={upcomingType === 'INCOME' ? 'Income to Receive' : 'Item to Pay'}
                  placeholder="Choose Item..."
                  selectedValue={selectedUpcomingId}
                  onSelect={(id) => {
                     const item = upcomingItems.find(i => i.id === id);
                     setSelectedUpcomingId(id);
                     if (item) {
                       setAmount(item.amount.toString());
                       setNote(item.type === 'INCOME' ? `Received ${item.name}` : `Paid ${item.name || item.note}`);
                     }
                  }}
                  options={upcomingItems
                    .filter(item => {
                      const isCorrectMonth = item.itemType === 'EMI' || item.monthKey === selectedMonth;
                      const isCorrectType = upcomingType === 'INCOME' ? item.type === 'INCOME' : (item.type === 'EXPENSE' || !item.type || item.itemType === 'EMI');
                      return isCorrectMonth && isCorrectType;
                    })
                    .map(item => ({ label: `${item.name || item.note} (₹${item.amount})`, value: item.id }))}
                />
              </View>
            </View>

            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: '#10b98122', marginTop: 4 }]}>
                <Wallet color="#10b981" size={20} />
              </View>
              <View style={styles.fieldContent}>
                <CustomDropdown 
                  label={upcomingType === 'INCOME' ? 'Receive INTO' : 'Pay FROM'}
                  placeholder="Select Account..."
                  selectedValue={accountId}
                  onSelect={setAccountId}
                  options={accounts
                    .filter(a => upcomingType === 'INCOME' ? a.type === 'BANK' : (a.type === 'BANK' || a.type === 'CREDIT_CARD'))
                    .map(a => ({ label: a.name, value: a.id, accountType: a.type }))}
                />
              </View>
            </View>
          </>
        ) : (
          <>

            {type === 'EMI' && (
              <View style={styles.fieldContainer}>
                <View style={[styles.fieldIcon, { backgroundColor: '#f59e0b22', marginTop: 4 }]}>
                  <TrendingUp color="#f59e0b" size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>Interest Rate (% p.a.)</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                    placeholder="0.00%" 
                    placeholderTextColor={theme.textSubtle}
                    keyboardType="numeric"
                    value={interestRate} 
                    onChangeText={setInterestRate} 
                  />
                  {amount && tenure && (
                    <View style={{ marginTop: 8, padding: 10, backgroundColor: theme.primary + '11', borderRadius: 8 }}>
                      <Text style={{ color: theme.text, fontSize: 12 }}>
                        Monthly EMI: <Text style={{ fontWeight: 'bold', color: theme.primary }}>
                          ₹{((parseFloat(amount) + (parseFloat(amount) * (parseFloat(interestRate) || 0) / 100 * (parseInt(tenure, 10) || 1) / 12)) / (parseInt(tenure, 10) || 1)).toFixed(2)}
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {type === 'EMI' && (
              <View style={styles.fieldContainer}>
                <View style={[styles.fieldIcon, { backgroundColor: '#ec489922', marginTop: 4 }]}>
                  <Clock color="#ec4899" size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>Tenure (Months)</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                    placeholder="e.g. 12" 
                    placeholderTextColor={theme.textSubtle}
                    keyboardType="numeric"
                    value={tenure} 
                    onChangeText={setTenure} 
                  />
                </View>
              </View>
            )}

            {/* Category Section */}
            {type === 'EXPENSE' && (
              <View style={styles.fieldContainer}>
                <View style={[styles.fieldIcon, { backgroundColor: '#ef444422', marginTop: 4 }]}>
                  <Tag color="#ef4444" size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textMuted }}>Category</Text>
                    <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                      <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>
                        {showAddCategory ? 'Cancel' : '+ New'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  
                  {showAddCategory ? (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput 
                        style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                        placeholder="e.g. Shopping" 
                        placeholderTextColor={theme.textSubtle}
                        value={newCategoryName} 
                        onChangeText={setNewCategoryName} 
                      />
                      <TouchableOpacity 
                        style={{ backgroundColor: theme.success, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }} 
                        onPress={handleCreateCategory}
                      >
                        <Plus color="white" size={20} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <CustomDropdown 
                      placeholder="Select Category..."
                      selectedValue={categoryId}
                      onSelect={setCategoryId}
                      options={categories.map(c => ({ label: c.name, value: c.id }))}
                    />
                  )}
                </View>
              </View>
            )}

            {/* Account Section */}
            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '22', marginTop: 4 }]}>
                <Wallet color={theme.primary} size={20} />
              </View>
              <View style={styles.fieldContent}>
                <CustomDropdown 
                  label={type === 'REPAY_LOAN' ? 'Debit FROM' : type === 'TRANSFER' ? 'Transfer FROM' : 'Account'}
                  placeholder="Select Account..."
                  selectedValue={accountId}
                  onSelect={setAccountId}
                  options={(
                    type === 'EMI'      ? accounts.filter(a => a.type === 'CREDIT_CARD') :
                    type === 'INCOME'   ? accounts.filter(a => a.type === 'BANK') :
                    type === 'TRANSFER' ? accounts.filter(a => a.type === 'BANK' || a.type === 'INVESTMENT' || a.type === 'SIP' || a.type === 'LENDED') :
                    (type === 'REPAY_LOAN' || type === 'PAY_BORROWED' || type === 'LEND_MONEY') ? accounts.filter(a => a.type === 'BANK') :
                    type === 'COLLECT_REPAYMENT' ? accounts.filter(a => a.type === 'LENDED') :
                    type === 'PAYMENT'  ? accounts.filter(a => a.type === 'BANK') :
                    type === 'EXPENSE'  ? accounts.filter(a => a.type === 'BANK' || a.type === 'CREDIT_CARD') :
                    accounts
                  ).map(a => ({ label: a.name, value: a.id, accountType: a.type }))}
                />
              </View>
            </View>

            {/* Target Account (Transfers/Repayments) */}
            {(type === 'TRANSFER' || type === 'PAYMENT' || type === 'REPAY_LOAN' || type === 'PAY_BORROWED' || type === 'LEND_MONEY' || type === 'COLLECT_REPAYMENT') && (
              <View style={styles.fieldContainer}>
                <View style={[styles.fieldIcon, { backgroundColor: '#8b5cf622', marginTop: 4 }]}>
                  <Landmark color="#8b5cf6" size={20} />
                </View>
                <View style={styles.fieldContent}>
                  <CustomDropdown 
                    label={type === 'PAYMENT' ? 'Pay TO (Credit Card)' : 
                           type === 'REPAY_LOAN' ? 'Credit TO (Loan)' : 'Target Account'}
                    placeholder="Select Target..."
                    selectedValue={toAccountId}
                    onSelect={setToAccountId}
                    options={
                      type === 'PAYMENT' ? accounts.filter(a => a.type === 'CREDIT_CARD').map(a => ({ label: a.name, value: a.id })) :
                      type === 'REPAY_LOAN' ? accounts.filter(a => a.type === 'LOAN').map(a => ({ label: a.name, value: a.id })) :
                      type === 'PAY_BORROWED' ? accounts.filter(a => a.type === 'BORROWED').map(a => ({ label: a.name, value: a.id })) :
                      type === 'LEND_MONEY' ? accounts.filter(a => a.type === 'LENT').map(a => ({ label: a.name, value: a.id })) :
                      type === 'COLLECT_REPAYMENT' ? accounts.filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id })) :
                      accounts.filter(a => (a.type === 'BANK' || a.type === 'INVESTMENT' || a.type === 'SIP' || a.type === 'LENT') && a.id !== accountId).map(a => ({ label: a.name, value: a.id }))
                    }
                  />
                </View>
              </View>
            )}

            {/* Note Section */}
            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: theme.border, marginTop: 4 }]}>
                <Info color={theme.textMuted} size={20} />
              </View>
              <View style={styles.fieldContent}>
                <Text style={[styles.label, { color: theme.textMuted }]}>Note / Description</Text>
                <TextInput 
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]} 
                  placeholder="e.g. Groceries" 
                  placeholderTextColor={theme.textSubtle}
                  value={note} 
                  onChangeText={setNote} 
                />
              </View>
            </View>

            {/* Date Section */}
            <View style={styles.fieldContainer}>
              <View style={[styles.fieldIcon, { backgroundColor: '#3b82f622', marginTop: 4 }]}>
                <Calendar color="#3b82f6" size={20} />
              </View>
              <View style={styles.fieldContent}>
                <DatePicker label={type === 'EMI' ? 'EMI Day (Monthly)' : 'Transaction Date'} date={date} onChange={setDate} />
              </View>
            </View>
          </>
        )}

        {/* Save Button (Always last for ergonomics) */}
        <View style={{ padding: 16, marginTop: 10, paddingBottom: 40 }}>
          <TouchableOpacity 
            style={[styles.submitBtn, { backgroundColor: theme.primary, shadowColor: theme.primary }]} 
            onPress={handleSave}
          >
            <Text style={styles.submitBtnText}>
              {type === 'PAY_UPCOMING' ? 'Settle Payment' : 'Save Transaction'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerBtn: {
    padding: 8,
  },
  amountContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 32,
    fontWeight: '300',
    marginRight: 4,
  },
  amountInput: {
    fontSize: 48,
    fontWeight: '700',
    padding: 0,
    minWidth: 100,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  typeSelector: {
    paddingRight: 16,
    gap: 10,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    gap: 8,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  fieldIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
  },
  input: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  submitBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 18,
  },
});
