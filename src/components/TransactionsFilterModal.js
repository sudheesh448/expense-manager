import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, 
  TouchableOpacity, ScrollView, 
  TouchableWithoutFeedback 
} from 'react-native';
import { X, Filter, Calendar, CreditCard, Landmark, Check, FilterX } from 'lucide-react-native';
import DatePicker from './DatePicker';
import CustomDropdown from './CustomDropdown';
import { format, subMonths, startOfMonth } from 'date-fns';

const TRANSACTION_TYPES = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Income', value: 'INCOME' },
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Transfer', value: 'TRANSFER' },
  { label: 'EMI Payment', value: 'EMI_PAYMENT' },
  { label: 'EMI Fine', value: 'EMI_FINE' },
];

const ACCOUNT_TYPES = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Bank / Savings', value: 'BANK' },
  { label: 'Credit Card', value: 'CREDIT_CARD' },
  { label: 'Loan / Debt', value: 'LOAN' },
  { label: 'Investment', value: 'INVESTMENT' },
];

export default function TransactionsFilterModal({ 
  visible, 
  onClose, 
  filters, 
  setFilters, 
  accounts, 
  theme, 
  fs,
  insets 
}) {
  const [localFilters, setLocalFilters] = useState(filters);
  const [dateMode, setDateMode] = useState(filters.date ? 'DATE' : (filters.month ? 'MONTH' : 'NONE'));

  useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
      setDateMode(filters.date ? 'DATE' : (filters.month ? 'MONTH' : 'NONE'));
    }
  }, [visible, filters]);

  const handleApply = () => {
    setFilters(localFilters);
    onClose();
  };

  const handleClear = () => {
    const cleared = {
      type: 'ALL',
      accountId: 'ALL',
      accountType: 'ALL',
      month: null, // YYYY-MM
      date: null,  // Date object
    };
    setLocalFilters(cleared);
    setDateMode('NONE');
  };

  const months = Array.from({ length: 12 }).map((_, i) => {
    const d = subMonths(new Date(), i);
    return {
      label: format(d, 'MMMM yyyy'),
      value: format(d, 'yyyy-MM')
    };
  });

  const accountOptions = [
    { label: 'All Accounts', value: 'ALL' },
    ...accounts.map(acc => ({
      label: acc.name,
      value: acc.id
    }))
  ];

  const updateFilter = (key, value) => {
    setLocalFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <View style={[styles.modal, { backgroundColor: theme.surface, paddingBottom: (insets?.bottom || 20) + 10 }]}>
              <View style={[styles.header, { borderBottomColor: theme.border + '15' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Filter size={20} color={theme.primary} />
                  <Text style={[styles.title, { color: theme.text, fontSize: fs(18) }]}>Filter Transactions</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={24} color={theme.textSubtle} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                {/* Transaction Type */}
                <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>TRANSACTION TYPE</Text>
                <View style={styles.chipRow}>
                  {TRANSACTION_TYPES.map(type => (
                    <TouchableOpacity 
                      key={type.value}
                      style={[
                        styles.chip, 
                        { backgroundColor: localFilters.type === type.value ? theme.primary + '15' : theme.background, borderColor: localFilters.type === type.value ? theme.primary : theme.border }
                      ]}
                      onPress={() => updateFilter('type', type.value)}
                    >
                      <Text style={{ color: localFilters.type === type.value ? theme.primary : theme.textMuted, fontSize: fs(12), fontWeight: '700' }}>{type.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Date / Month Picker */}
                <View style={{ marginTop: 24 }}>
                  <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>TIME PERIOD</Text>
                  <View style={[styles.dateModeToggle, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <TouchableOpacity 
                      style={[styles.modeBtn, dateMode === 'NONE' && { backgroundColor: theme.surface, shadowColor: '#000', elevation: 2 }]}
                      onPress={() => { setDateMode('NONE'); updateFilter('month', null); updateFilter('date', null); }}
                    >
                      <Text style={{ color: dateMode === 'NONE' ? theme.text : theme.textSubtle, fontSize: fs(11), fontWeight: '700' }}>All Time</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modeBtn, dateMode === 'MONTH' && { backgroundColor: theme.surface, shadowColor: '#000', elevation: 2 }]}
                      onPress={() => { setDateMode('MONTH'); updateFilter('date', null); if(!localFilters.month) updateFilter('month', months[0].value); }}
                    >
                      <Text style={{ color: dateMode === 'MONTH' ? theme.text : theme.textSubtle, fontSize: fs(11), fontWeight: '700' }}>Monthly</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.modeBtn, dateMode === 'DATE' && { backgroundColor: theme.surface, shadowColor: '#000', elevation: 2 }]}
                      onPress={() => { setDateMode('DATE'); updateFilter('month', null); if(!localFilters.date) updateFilter('date', new Date()); }}
                    >
                      <Text style={{ color: dateMode === 'DATE' ? theme.text : theme.textSubtle, fontSize: fs(11), fontWeight: '700' }}>Specific Date</Text>
                    </TouchableOpacity>
                  </View>

                  {dateMode === 'MONTH' && (
                    <View style={{ marginTop: 12 }}>
                      <CustomDropdown 
                        options={months}
                        selectedValue={localFilters.month}
                        onSelect={(v) => updateFilter('month', v)}
                        theme={theme}
                        icon={Calendar}
                      />
                    </View>
                  )}

                  {dateMode === 'DATE' && (
                    <View style={{ marginTop: 12 }}>
                      <DatePicker 
                        date={localFilters.date ? new Date(localFilters.date) : new Date()}
                        onChange={(d) => updateFilter('date', d)}
                        theme={theme}
                        fs={fs}
                        containerStyle={{ marginBottom: 0 }}
                      />
                    </View>
                  )}
                </View>

                {/* Account Selection */}
                <View style={{ marginTop: 24 }}>
                  <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>SOURCE ACCOUNT</Text>
                  <CustomDropdown 
                    options={accountOptions}
                    selectedValue={localFilters.accountId}
                    onSelect={(v) => updateFilter('accountId', v)}
                    theme={theme}
                    icon={Landmark}
                  />
                </View>

                {/* Account Type */}
                <View style={{ marginTop: 24, marginBottom: 40 }}>
                  <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>ACCOUNT TYPE</Text>
                  <CustomDropdown 
                    options={ACCOUNT_TYPES}
                    selectedValue={localFilters.accountType}
                    onSelect={(v) => updateFilter('accountType', v)}
                    theme={theme}
                    icon={CreditCard}
                  />
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity 
                  style={[styles.clearBtn, { borderColor: theme.border }]}
                  onPress={handleClear}
                >
                  <FilterX size={18} color={theme.textSubtle} />
                  <Text style={{ color: theme.textSubtle, fontSize: fs(14), fontWeight: '700' }}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.applyBtn, { backgroundColor: theme.primary }]}
                  onPress={handleApply}
                >
                  <Check size={20} color="white" />
                  <Text style={{ color: 'white', fontSize: fs(15), fontWeight: '900' }}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    maxHeight: '85%',
    width: '100%' 
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 24,
    borderBottomWidth: 1 
  },
  title: { fontWeight: '900' },
  closeBtn: { padding: 4 },
  body: { paddingHorizontal: 24, paddingTop: 20 },
  sectionTitle: { fontWeight: '800', letterSpacing: 1, marginBottom: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 12, 
    borderWidth: 1 
  },
  dateModeToggle: { 
    flexDirection: 'row', 
    padding: 4, 
    borderRadius: 14, 
    borderWidth: 1 
  },
  modeBtn: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  footer: { 
    flexDirection: 'row', 
    gap: 12, 
    paddingHorizontal: 24, 
    paddingTop: 12 
  },
  clearBtn: { 
    flex: 1, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54, 
    borderRadius: 16, 
    borderWidth: 1 
  },
  applyBtn: { 
    flex: 2, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54, 
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8
  }
});
