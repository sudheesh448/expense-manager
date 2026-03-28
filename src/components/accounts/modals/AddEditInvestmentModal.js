import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, TrendingUp, Tag } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { generateId, getDb, saveInvestmentInfo, updateInvestmentInfo, updateAccountBalanceSQL } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomHeader from '../../CustomHeader';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditInvestmentModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acAmount, setAcAmount] = useState('');
  const [acInvestedAmount, setAcInvestedAmount] = useState('');
  const [acType, setAcType] = useState('INVESTMENT');
  const [acStartDate, setAcStartDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcAmount((accountData.balance || '').toString());
      setAcInvestedAmount((accountData.investedAmount || '').toString());
      setAcType(accountData.type || 'INVESTMENT');
      setAcStartDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcAmount('');
      setAcInvestedAmount('');
      setAcType(openSection?.key || 'INVESTMENT');
      setAcStartDate(new Date());
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData, openSection]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }
    if (!acAmount || parseFloat(acAmount) <= 0) {
      Alert.alert("Required Field", "Please enter amount.");
      return;
    }

    const investmentId = editingId || generateId();
    const currentVal = parseFloat(acAmount) || 0;
    const investedVal = parseFloat(acInvestedAmount) || currentVal; // Fallback to current if not provided
    
    const data = {
      name: acName.trim(),
      type: acType,
      balance: currentVal, // Market Value
      investedAmount: investedVal, // Capital
      sipAmount: 0,
      userId: activeUser.id,
      status: 'ACTIVE',
      categoryId: accountData?.categoryId || null
    };

    const db = await getDb();
    try {
      if (editingId) {
        await updateInvestmentInfo(db, editingId, data);
      } else {
        await saveInvestmentInfo(db, investmentId, data);
        
        if (acTargetBankId) {
          // Log as transfer from bank to investment
          const txId = generateId();
          const now = new Date().toISOString();
          
          await db.runAsync(
            'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [txId, activeUser.id, 'TRANSFER', investedVal, now, acTargetBankId, investmentId, `Investment Funding: ${acName.trim()}`]
          );
          
          // Deduct from bank
          await updateAccountBalanceSQL(db, acTargetBankId, investedVal, 'TRANSFER', false);
          // Add to investment
          await updateAccountBalanceSQL(db, investmentId, investedVal, 'TRANSFER', true);
          
          // If market value is different from invested value at start (e.g. historical entry)
          // we don't need a separate transaction, the balance is already set in saveInvestmentInfo.
        }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving investment:', error);
      Alert.alert("Error", "Failed to save investment account.");
    }
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <CustomHeader
            title={editingId ? `Edit ${acType === 'SAVINGS' ? 'Savings' : 'Investment'}` : `Add ${acType === 'SAVINGS' ? 'Savings' : 'Investment'}`}
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
              <FormSection title="Portfolio Values" icon={Tag} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Investment Name</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="e.g. Reliance Stocks, PPF" placeholderTextColor={theme.placeholder}
                    value={acName} onChangeText={setAcName}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Invested Amount</Text>
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
                      keyboardType="numeric" value={acAmount} onChangeText={setAcAmount}
                    />
                  </View>
                </View>
              </FormSection>

              <FormSection title="Funding Source" icon={TrendingUp} theme={theme} fs={fs}>
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Funded From Bank Account</Text>
                  <CustomDropdown
                    options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                    selectedValue={acTargetBankId}
                    onSelect={setAcTargetBankId}
                    placeholder="Select Bank (Optional)..."
                  />
                </View>
                <View style={{ marginTop: 12 }}>
                  <DatePicker
                    label="Investment Date"
                    date={acStartDate}
                    onChange={setAcStartDate}
                  />
                </View>
              </FormSection>

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
                onPress={handleSave}
              >
                <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                  {editingId ? 'Update' : 'Add Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
