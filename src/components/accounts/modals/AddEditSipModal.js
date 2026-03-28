import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, TrendingUp, Tag, Landmark } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { generateId, getDb, saveSIPAccount, updateSIPAccount, updateAccountBalanceSQL } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomHeader from '../../CustomHeader';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditSipModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acAmount, setAcAmount] = useState('');
  const [acInvestedAmount, setAcInvestedAmount] = useState('');
  const [acCurrentValue, setAcCurrentValue] = useState('');
  const [acFrequency, setAcFrequency] = useState('MONTHLY');
  const [acStartDate, setAcStartDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcAmount((accountData.sipAmount || accountData.amount || '').toString());
      setAcInvestedAmount((accountData.balance || '').toString());
      setAcCurrentValue((accountData.sipCurrentValue || accountData.currentValue || '').toString());
      setAcFrequency(accountData.frequency || 'MONTHLY');
      setAcStartDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcAmount('');
      setAcInvestedAmount('');
      setAcCurrentValue('');
      setAcFrequency('MONTHLY');
      setAcStartDate(new Date());
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a SIP name.");
      return;
    }
    if (!acAmount || parseFloat(acAmount) <= 0) {
      Alert.alert("Required Field", "Please enter SIP amount.");
      return;
    }

    const investedVal = parseFloat(acInvestedAmount) || 0;
    const oldInvestedVal = accountData?.balance || 0;
    const delta = investedVal - oldInvestedVal;

    const data = {
      name: acName.trim(),
      type: 'SIP',
      amount: parseFloat(acAmount) || 0,
      balance: investedVal,
      currentValue: parseFloat(acCurrentValue) || investedVal,
      frequency: acFrequency,
      startDate: acStartDate.toISOString(),
      bankAccountId: acTargetBankId,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    const db = await getDb();

    const executeSave = async () => {
      try {
        if (editingId) {
          await updateSIPAccount(db, editingId, data);
          
          if (delta !== 0 && acTargetBankId) {
            const txId = generateId();
            const now = new Date().toISOString();
            const absDelta = Math.abs(delta);
            
            // If delta > 0: Bank -> SIP (Deduct from Bank)
            // If delta < 0: SIP -> Bank (Add to Bank)
            const isDeduction = delta > 0;
            const fromId = isDeduction ? acTargetBankId : editingId;
            const toId = isDeduction ? editingId : acTargetBankId;
            const note = isDeduction ? `SIP Manual Increase: ${acName.trim()}` : `SIP Manual Decrease (Refund): ${acName.trim()}`;

            await db.runAsync(
              'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [txId, activeUser.id, 'TRANSFER', absDelta, now, fromId, toId, note]
            );
            
            // updateAccountBalanceSQL(database, accountId, amount, type, isDestination)
            // For Bank: 
            // If isDeduction: Bank is source (isDestination=false), type='TRANSFER' -> Deducts
            // If !isDeduction: Bank is destination (isDestination=true), type='TRANSFER' -> Adds
            await updateAccountBalanceSQL(db, acTargetBankId, absDelta, 'TRANSFER', !isDeduction);
          }
        } else {
          const newId = generateId();
          await saveSIPAccount(db, newId, { ...data, userId: activeUser.id });
          
          if (investedVal > 0 && acTargetBankId) {
            const txId = generateId();
            const now = new Date().toISOString();
            await db.runAsync(
              'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [txId, activeUser.id, 'TRANSFER', investedVal, now, acTargetBankId, newId, `SIP Initial Funding: ${acName.trim()}`]
            );
            await updateAccountBalanceSQL(db, acTargetBankId, investedVal, 'TRANSFER', false);
          }
        }
        onSuccess();
        onClose();
      } catch (error) {
        console.error('Error saving SIP:', error);
        Alert.alert("Error", "Failed to save SIP information.");
      }
    };

    if (editingId && delta < 0 && acTargetBankId) {
      Alert.alert(
        "Confirm Adjustment",
        `You are decreasing the invested amount by ${currencySymbol}${Math.abs(delta).toLocaleString()}. This amount will be credited back to your bank account. Proceed?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, Proceed", onPress: executeSave }
        ]
      );
    } else {
      await executeSave();
    }
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  // Frequency is locked to Monthly for now

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <CustomHeader
            title={editingId ? 'Edit SIP' : 'Add SIP'}
            leftComponent={
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            }
            theme={theme}
            fs={fs}
            containerStyle={{ paddingTop: 12 }}
          />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
            <View style={{ gap: 20 }}>
              <FormSection title="Account Setup" icon={Tag} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>SIP Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="e.g. Parag Parikh Flexi Cap" placeholderTextColor={theme.placeholder}
                    value={acName} onChangeText={setAcName}
                  />
                </View>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Monthly Installment</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0.00" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acAmount} onChangeText={setAcAmount}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Total Invested</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="0.00" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acInvestedAmount} onChangeText={setAcInvestedAmount}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Current Value</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="0.00" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acCurrentValue} onChangeText={setAcCurrentValue}
                    />
                  </View>
                </View>
              </FormSection>

              <FormSection title="Investment Details" icon={TrendingUp} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Frequency</Text>
                  <View style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, justifyContent: 'center', opacity: 0.7 }]}>
                    <Text style={{ color: theme.text, fontSize: fs(14) }}>Monthly</Text>
                  </View>
                </View>
                <View style={{ marginBottom: 16 }}>
                  <DatePicker
                    label="SIP Start Date"
                    date={acStartDate}
                    onChange={setAcStartDate}
                  />
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Deduct From Bank Account</Text>
                  <CustomDropdown
                    options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                    selectedValue={acTargetBankId}
                    onSelect={setAcTargetBankId}
                    placeholder="Select Bank (Optional)..."
                    icon={Landmark}
                  />
                </View>
              </FormSection>

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
                onPress={handleSave}
              >
                <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                  {editingId ? 'Update SIP' : 'Add SIP'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
