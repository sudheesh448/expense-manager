import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet,
  TextInput, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { updateAccount, saveRecurringPayment } from '../../services/storage';
import { getLoanStats } from '../../utils/accountUtils';
import { useTheme } from '../../context/ThemeContext';

export default function ConvertToEmiModal({ visible, item, accounts, activeUser, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const [tenureMonths, setTenureMonths] = useState('12');

  useEffect(() => {
    if (visible) {
      setTenureMonths('12');
    }
  }, [visible]);

  const confirmEmiConversion = async () => {
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
        }, getCurrencySymbol(activeUser?.currency))
      ]);
      onSuccess();
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to convert loan to EMI.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <Text style={[styles.modalTitle, { fontSize: fs(18), color: theme.text }]}>Convert to EMI: {item?.name}</Text>

          <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(13) }]}>Loan Tenure (Months)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
            value={tenureMonths}
            onChangeText={setTenureMonths}
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
            autoFocus
            placeholder="e.g. 12"
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelBtn, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmBtn, { backgroundColor: '#8b5cf6' }]}
              onPress={confirmEmiConversion}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>Convert</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 16, width: '100%', padding: 20 },
  modalTitle: { fontWeight: 'bold', marginBottom: 16 },
  label: { marginBottom: 8 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 20, borderColor: '#ccc' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  confirmBtn: {},
  buttonText: { fontWeight: '700' },
});
