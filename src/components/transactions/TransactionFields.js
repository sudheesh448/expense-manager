import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Tag, Check, Calendar, Wallet, Landmark, TrendingUp, Info, Clock, Plus } from 'lucide-react-native';
import CustomDropdown from '../CustomDropdown';
import DatePicker from '../DatePicker';
import { getAccountLabel } from '../../utils/accountUtils';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';

export const AccountCategoryFields = ({ 
  theme, type, accountId, setAccountId, accounts, 
  categoryId, setCategoryId, categories, 
  showAddCategory, setShowAddCategory, newCategoryName, setNewCategoryName, handleCreateCategory 
}) => {
  const { activeUser } = useAuth();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      {type === 'EXPENSE' && (
        <View style={styles.fieldContainer}>
          <View style={[styles.fieldIcon, { backgroundColor: '#ef444411', width: 36, height: 36, borderRadius: 12 }]}>
            <Tag color="#ef4444" size={18} />
          </View>
          <View style={styles.fieldContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={[styles.label, { color: theme.textMuted }]}>CATEGORY</Text>
              <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 11 }}>
                  {showAddCategory ? 'CANCEL' : '+ NEW'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {showAddCategory ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput 
                  style={[styles.input, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} 
                  placeholder="e.g. Shopping" 
                  placeholderTextColor={theme.placeholder}
                  value={newCategoryName} 
                  onChangeText={setNewCategoryName} 
                />
                <TouchableOpacity 
                  style={{ backgroundColor: theme.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }} 
                  onPress={handleCreateCategory}
                >
                  <Check color="white" size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <CustomDropdown 
                placeholder="Select Category..."
                selectedValue={categoryId}
                onSelect={setCategoryId}
                containerStyle={{ marginBottom: 0 }}
                options={categories.map(c => ({ label: c.name, value: c.id }))}
              />
            )}
          </View>
        </View>
      )}
      {type === 'EMI' && (
        <View style={styles.fieldContainer}>
          <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '11', width: 36, height: 36, borderRadius: 12 }]}>
            <TrendingUp color={theme.primary} size={18} />
          </View>
          <View style={styles.fieldContent}>
            <CustomDropdown 
              label="CATEGORY"
              placeholder="Select Category..."
              selectedValue={categoryId}
              onSelect={setCategoryId}
              containerStyle={{ marginBottom: 0 }}
              options={categories.map(c => ({ label: c.name, value: c.id }))}
            />
          </View>
        </View>
      )}

      {/* Account Selector integrated here for cleaner flow */}
      <View style={[styles.fieldContainer, { marginBottom: 0, marginTop: (type === 'EXPENSE' || type === 'EMI') ? 12 : 0 }]}>
        <View style={[styles.fieldIcon, { backgroundColor: '#10b98111', width: 36, height: 36, borderRadius: 12 }]}>
          <Wallet color="#10b981" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <CustomDropdown 
            label={type === 'REPAY_LOAN' ? 'Debit FROM' : type === 'TRANSFER' ? 'Transfer FROM' : 'ACCOUNT'}
            placeholder="Select Account..."
            selectedValue={accountId}
            onSelect={setAccountId}
            showTabs={type === 'EXPENSE' || type === 'TRANSFER'}
            containerStyle={{ marginBottom: 0 }}
            options={accounts.map(a => ({ 
              label: getAccountLabel(a, accounts, getCurrencySymbol(activeUser?.currency)), 
              value: a.id,
              accountType: a.type
            }))}
          />
        </View>
      </View>
    </View>
  );
};

export const UpcomingSettleFields = ({ 
  theme, type, upcomingType, setUpcomingType, selectedMonth, setSelectedMonth, 
  selectedUpcomingId, setSelectedUpcomingId, upcomingItems, format, addMonths 
}) => {
  const { activeUser } = useAuth();
  if (type !== 'PAY_UPCOMING') return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.section, { marginBottom: 12 }]}>
        <Text style={[styles.sectionLabel, { color: theme.textMuted, marginBottom: 8 }]}>ITEM TYPE</Text>
        <View style={[styles.chipRow, { marginBottom: 0 }]}>
          <TouchableOpacity 
            style={[styles.chip, { backgroundColor: upcomingType === 'EXPENSE' ? theme.primary : theme.surface, borderColor: upcomingType === 'EXPENSE' ? theme.primary : theme.border }]}
            onPress={() => { setUpcomingType('EXPENSE'); setSelectedUpcomingId(null); }}
          >
            <Text style={[styles.chipText, { color: upcomingType === 'EXPENSE' ? '#fff' : theme.text }]}>EXPENSES</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.chip, { backgroundColor: upcomingType === 'INCOME' ? theme.primary : theme.surface, borderColor: upcomingType === 'INCOME' ? theme.primary : theme.border }]}
            onPress={() => { setUpcomingType('INCOME'); setSelectedUpcomingId(null); }}
          >
            <Text style={[styles.chipText, { color: upcomingType === 'INCOME' ? '#fff' : theme.text }]}>INCOMES</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.fieldContainer, { marginTop: 12 }]}>
        <View style={[styles.fieldIcon, { backgroundColor: '#3b82f611', width: 36, height: 36, borderRadius: 12 }]}>
          <Calendar color="#3b82f6" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <CustomDropdown 
            label="Target Month"
            selectedValue={selectedMonth}
            onSelect={setSelectedMonth}
            containerStyle={{ marginBottom: 0 }}
            options={Array.from({length: 6}).map((_, i) => {
              const m = format(addMonths(new Date(), i), 'yyyy-MM');
              return { label: m, value: m };
            })}
          />
        </View>
      </View>

      <View style={[styles.fieldContainer, { marginBottom: 0, marginTop: 12 }]}>
        <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '11', width: 36, height: 36, borderRadius: 12 }]}>
          <Check color={theme.primary} size={18} />
        </View>
        <View style={styles.fieldContent}>
          <CustomDropdown 
            label={upcomingType === 'INCOME' ? 'Income to Receive' : 'Item to Pay'}
            placeholder="Choose Item..."
            selectedValue={selectedUpcomingId}
            onSelect={setSelectedUpcomingId}
            containerStyle={{ marginBottom: 0 }}
            options={upcomingItems
              .filter(item => {
                const isCorrectMonth = item.itemType === 'EMI' || item.monthKey === selectedMonth;
                const isCorrectType = upcomingType === 'INCOME' ? item.type === 'INCOME' : (item.type === 'EXPENSE' || !item.type || item.itemType === 'EMI');
                return isCorrectMonth && isCorrectType;
              })
              .map(item => ({ label: `${item.name || item.note} (${getCurrencySymbol(activeUser?.currency)}${item.amount})`, value: item.id }))}
          />
        </View>
      </View>
    </View>
  );
};

export const TransferDetails = ({ theme, type, accountId, toAccountId, setToAccountId, accounts }) => {
  const { activeUser } = useAuth();
  const needsTarget = ['TRANSFER', 'PAYMENT', 'REPAY_LOAN', 'PAY_BORROWED', 'LEND_MONEY', 'COLLECT_REPAYMENT', 'CC_PAY'].includes(type);
  if (!needsTarget) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.fieldContainer, { marginBottom: 0 }]}>
        <View style={[styles.fieldIcon, { backgroundColor: '#8b5cf611', width: 36, height: 36, borderRadius: 12 }]}>
          <Landmark color="#8b5cf6" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <CustomDropdown 
            label={type === 'PAYMENT' || type === 'CC_PAY' ? 'Pay TO (Credit Card)' : type === 'REPAY_LOAN' ? 'Credit TO (Loan)' : 'Target Account'}
            placeholder="Select Target..."
            selectedValue={toAccountId}
            onSelect={setToAccountId}
            showTabs={type === 'TRANSFER'}
            containerStyle={{ marginBottom: 0 }}
            options={accounts
              .filter(a => a.id !== accountId)
              .map(a => ({ 
                label: getAccountLabel(a, accounts, getCurrencySymbol(activeUser?.currency)), 
                value: a.id,
                accountType: a.type
              }))
            }
          />
        </View>
      </View>
    </View>
  );
};

export const EmiDetailsEntry = ({ theme, type, amount, tenure, setTenure, interestRate, setInterestRate, serviceCharge, setServiceCharge, taxPercentage, setTaxPercentage, fs }) => {
  const { activeUser } = useAuth();
  if (type !== 'EMI') return null;

  const P = parseFloat(amount) || 0;
  const r = (parseFloat(interestRate) || 0) / 1200;
  const n = parseInt(tenure, 10) || 1;
  const taxRate = (parseFloat(taxPercentage) || 0) / 100;
  const sc = parseFloat(serviceCharge) || 0;
  let emi = P / n;
  if (r > 0) emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.fieldContainer}>
        <View style={[styles.fieldIcon, { backgroundColor: '#f59e0b11', width: 36, height: 36, borderRadius: 12 }]}>
          <TrendingUp color="#f59e0b" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <Text style={[styles.label, { color: theme.textMuted }]}>INTEREST RATE (% P.A.)</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="0.00%" keyboardType="numeric" value={interestRate} onChangeText={setInterestRate} />
        </View>
      </View>

      <View style={styles.fieldContainer}>
        <View style={[styles.fieldIcon, { backgroundColor: '#ec489911', width: 36, height: 36, borderRadius: 12 }]}>
          <Clock color="#ec4899" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <Text style={[styles.label, { color: theme.textMuted }]}>TENURE (MONTHS)</Text>
          <TextInput style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="e.g. 12" keyboardType="numeric" value={tenure} onChangeText={setTenure} />
        </View>
      </View>

      <View style={[styles.fieldContainer, { marginBottom: 0 }]}>
        <View style={[styles.fieldIcon, { backgroundColor: '#8b5cf611', width: 36, height: 36, borderRadius: 12 }]}>
          <Tag color="#8b5cf6" size={18} />
        </View>
        <View style={styles.fieldContent}>
          <Text style={[styles.label, { color: theme.textMuted }]}>TAX & CHARGES</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Service Charge" keyboardType="numeric" value={serviceCharge} onChangeText={setServiceCharge} />
            <TextInput style={[styles.input, { flex: 1, backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} placeholder="Tax %" keyboardType="numeric" value={taxPercentage} onChangeText={setTaxPercentage} />
          </View>
        </View>
      </View>

      {amount > 0 && (
        <View style={{ marginTop: 4, padding: 12, backgroundColor: theme.primary + '11', borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(11) }}>Reducing Balance EMI:</Text>
            <Text style={{ color: theme.text, fontSize: fs(11), fontWeight: 'bold' }}>{getCurrencySymbol(activeUser?.currency)}{emi.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, borderTopWidth: 0.5, borderTopColor: theme.border, paddingTop: 4 }}>
            <Text style={{ color: theme.text, fontSize: 13, fontWeight: '700' }}>Initial Total Outflow:</Text>
            <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '900' }}>{getCurrencySymbol(activeUser?.currency)}{(emi + (taxRate > 0 ? (P * r * taxRate) : 0)).toFixed(2)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export const NoteDateFields = ({ theme, type, note, setNote, date, setDate }) => {
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.fieldContainer}>
        <View style={[styles.fieldIcon, { backgroundColor: theme.textMuted + '11', width: 36, height: 36, borderRadius: 12 }]}>
          <Info color={theme.textMuted} size={18} />
        </View>
        <View style={styles.fieldContent}>
          <Text style={[styles.label, { color: theme.textMuted }]}>NOTE / DESCRIPTION</Text>
          <TextInput 
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]} 
            placeholder={type === 'INCOME' ? "Salary" : "e.g. Groceries"} 
            placeholderTextColor={theme.textSubtle}
            value={note} 
            onChangeText={setNote} 
          />
        </View>
      </View>

      {type !== 'PAY_UPCOMING' && (
        <View style={[styles.fieldContainer, { marginBottom: 0 }]}>
          <View style={[styles.fieldIcon, { backgroundColor: '#3b82f611', width: 36, height: 36, borderRadius: 12 }]}>
            <Calendar color="#3b82f6" size={18} />
          </View>
          <View style={styles.fieldContent}>
            <DatePicker label={type === 'EMI' ? 'EMI Day (Monthly)' : 'TRANSACTION DATE'} date={date} onChange={setDate} />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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
  cardHeader: { 
    fontSize: 9, 
    fontWeight: '900', 
    letterSpacing: 1, 
    marginBottom: 10, 
    textTransform: 'uppercase',
    opacity: 0.7
  },
  fieldContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 10, 
    gap: 10 
  },
  fieldIcon: { 
    width: 32, 
    height: 32, 
    borderRadius: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  fieldContent: { flex: 1 },
  label: { 
    fontSize: 10, 
    fontWeight: '800', 
    marginBottom: 4,
    letterSpacing: 0.2
  },
  input: { 
    paddingVertical: 10,
    paddingHorizontal: 12, 
    borderRadius: 12, 
    borderWidth: 1.2, 
    fontSize: 13, 
    fontWeight: '600' 
  },
  section: { marginBottom: 12 },
  sectionLabel: { 
    fontSize: 9, 
    fontWeight: '900', 
    marginBottom: 6,
    letterSpacing: 0.4
  },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  chip: { 
    flex: 1, 
    paddingVertical: 10, 
    borderRadius: 14, 
    borderWidth: 1.2, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  chipText: { fontWeight: '900', fontSize: 10, letterSpacing: 0.6 },
});
