import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { saveRecurringPayment, saveCategory } from '../../services/storage';
import DatePicker from '../DatePicker';
import CustomDropdown from '../CustomDropdown';
import { Tag, Check } from 'lucide-react-native';
import CustomHeader from '../CustomHeader';
import { useTheme } from '../../context/ThemeContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';

export default function AddRecurringModal({ visible, accounts, activeUser, expenseCategories, onClose, onSuccess, initialData }) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const [rName, setRName]               = useState('');
  const [rAmount, setRAmount]           = useState('');
  const [rScheduleType, setRScheduleType] = useState('DYNAMIC');
  const [rAnchorDay, setRAnchorDay]     = useState('1');
  const [rCycleDays, setRCycleDays]     = useState('30');
  const [rCustomDays, setRCustomDays]   = useState('');
  const [rStartDate, setRStartDate]     = useState(new Date());
  const [rCategoryId, setRCategoryId]   = useState('');
  const [rType, setRType]               = useState('EXPENSE');

  // New Category States
  const [localCategories, setLocalCategories] = useState(expenseCategories || []);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (visible && initialData) {
      setRName(initialData.name || '');
      setRAmount(initialData.amount?.toString() || '');
      setRScheduleType(initialData.scheduleType || 'DYNAMIC');
      setRAnchorDay(initialData.anchorDay?.toString() || '1');
      setRCycleDays(initialData.cycleDays?.toString() || '30');
      setRStartDate(initialData.nextDueDate ? new Date(initialData.nextDueDate) : new Date());
      setRCategoryId(initialData.categoryId || '');
      setRType(initialData.type || 'EXPENSE');
    } else if (visible) {
      setRName(''); setRAmount(''); setRScheduleType('DYNAMIC'); setRAnchorDay('1');
      setRCycleDays('30'); setRCustomDays(''); setRCategoryId(''); setRType('EXPENSE');
      setRStartDate(new Date());
    }
  }, [visible, initialData]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const cat = await saveCategory(activeUser.id, newCategoryName.trim(), 'EXPENSE');
      setLocalCategories([...localCategories, cat]);
      setRCategoryId(cat.id);
      setNewCategoryName('');
      setShowAddCategory(false);
    } catch (e) {
      console.error("Error creating category:", e);
    }
  };

  const handleSave = async () => {
    if (!rName.trim() || !rAmount) return;
    const bank = accounts.find(a => a.type === 'BANK') || accounts[0];
    const days = rCycleDays === 'CUSTOM' ? parseInt(rCustomDays, 10) : parseInt(rCycleDays, 10);
    
    await saveRecurringPayment(activeUser.id, {
      id: initialData?.id,
      name: rName.trim(),
      amount: parseFloat(rAmount),
      accountId: bank?.id || '',
      scheduleType: rScheduleType,
      anchorDay:    rScheduleType === 'FIXED' ? parseInt(rAnchorDay, 10) || 1 : null,
      cycleDays:    rScheduleType === 'DYNAMIC' ? days : 0,
      nextDueDate:  rScheduleType === 'DYNAMIC' ? rStartDate.toISOString() : new Date().toISOString(),
      note: '',
      categoryId:   rType === 'INCOME' ? null : (rCategoryId || null),
      type:         rType
    }, getCurrencySymbol(activeUser?.currency));

    // Reset state
    setRName(''); setRAmount(''); setRScheduleType('DYNAMIC'); setRAnchorDay('1');
    setRCycleDays('30'); setRCustomDays(''); setRCategoryId(''); setRType('EXPENSE');
    
    onSuccess();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalWrap, { backgroundColor: theme.background }]}>
        <CustomHeader
          title={initialData ? "Edit Scheduled Item" : "Add Scheduled Transactions"}
          leftComponent={
            <TouchableOpacity onPress={onClose}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
          }
          rightComponent={<View style={{ width: 22 }} />}
          theme={theme}
          fs={fs}
        />

        <ScrollView style={[styles.modalWrap, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={{ padding: 16 }}>
            {!initialData?.id && (
              <View style={[styles.chipRow, { marginBottom: 16 }]}>
                {[['Expense', 'EXPENSE', '#ef4444'], ['Income', 'INCOME', '#10b981']].map(([lbl, val, col]) => (
                  <TouchableOpacity
                    key={val}
                    style={[
                      styles.chip, 
                      { 
                        flex: 1, 
                        justifyContent: 'center', 
                        backgroundColor: rType === val ? col : theme.surface, 
                        borderColor: rType === val ? col : theme.border 
                      }
                    ]}
                    onPress={() => setRType(val)}
                  >
                    <Text style={[
                        styles.chipText, 
                        { textAlign: 'center', color: rType === val ? 'white' : theme.text, fontSize: fs(13), fontWeight: '700' }
                    ]}>
                      {lbl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Name / Purpose</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
              placeholder={rType === 'INCOME' ? 'e.g. Salary, Rent, Dividends' : 'e.g. Mobile, WiFi, Rent, Netflix'}
              placeholderTextColor={theme.placeholder}
              value={rName} onChangeText={setRName}
            />
            <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
              placeholder="0.00" placeholderTextColor={theme.textSubtle}
              keyboardType="numeric" value={rAmount} onChangeText={setRAmount}
            />

            {/* Category selection - only for Expense now as requested */}
            {rType === 'EXPENSE' && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13), marginTop: 0 }]}>
                        Expense Category (Optional)
                    </Text>
                    <TouchableOpacity onPress={() => setShowAddCategory(!showAddCategory)}>
                        <Text style={{ color: theme.primary, fontWeight: '800', fontSize: fs(12) }}>
                            {showAddCategory ? 'CANCEL' : '+ NEW'}
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {showAddCategory ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                      placeholder="e.g. Shopping" 
                      placeholderTextColor={theme.placeholder}
                      value={newCategoryName} onChangeText={setNewCategoryName}
                      autoFocus
                    />
                    <TouchableOpacity 
                      style={{ backgroundColor: theme.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12 }} 
                      onPress={handleCreateCategory}
                    >
                      <Check color="white" size={24} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <CustomDropdown
                    options={localCategories.filter(c => c.type === 'EXPENSE').map(c => ({ label: c.name, value: c.id }))}
                    selectedValue={rCategoryId}
                    onSelect={setRCategoryId}
                    placeholder="Select Expense Category..."
                  />
                )}
              </View>
            )}

            {!initialData?.id && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Schedule Type</Text>
                <View style={styles.chipRow}>
                  {[['🗓 Fixed Date', 'FIXED'], ['🔄 Dynamic (Days)', 'DYNAMIC']].map(([lbl, val]) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.chip, 
                        { 
                          flex: 1, 
                          justifyContent: 'center', 
                          backgroundColor: rScheduleType === val ? '#ef4444' : theme.surface, 
                          borderColor: rScheduleType === val ? '#ef4444' : theme.border 
                        }
                      ]}
                      onPress={() => setRScheduleType(val)}
                    >
                      <Text style={[styles.chipText, { textAlign: 'center', color: rScheduleType === val ? 'white' : theme.text, fontSize: fs(13) }]}>
                        {lbl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {rScheduleType === 'FIXED' ? (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Day of Month (1–31)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                  placeholder="e.g. 1 for 1st, 15 for 15th"
                  placeholderTextColor={theme.placeholder}
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
                      style={[
                        styles.chip, 
                        { backgroundColor: rCycleDays === val ? '#ef4444' : theme.surface, borderColor: rCycleDays === val ? '#ef4444' : theme.border }
                      ]}
                      onPress={() => setRCycleDays(val)}
                    >
                      <Text style={[styles.chipText, { color: rCycleDays === val ? 'white' : theme.text, fontSize: fs(13) }]}>
                        {lbl}
                      </Text>
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

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: rType === 'INCOME' ? '#10b981' : '#ef4444' }]} onPress={handleSave}>
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                  {initialData ? 'Update Schedule' : `Add Scheduled ${rType === 'INCOME' ? 'Income' : 'Payment'}`}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  fieldLabel: { fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontWeight: '600' },
  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: 'white', fontWeight: '700' },
});
