import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { deleteRecurringByAccountId, saveTransaction, updateAccount, updateRecurringPayment } from '../../services/storage';
import { getLoanStats } from '../../utils/loanUtils';
import { differenceInMonths } from '../../utils/dateUtils';
import { getCurrencySymbol } from '../../utils/currencyUtils';


export default function RepayLoanModal({ visible, item, accounts, activeUser, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const [amount, setAmount] = useState('');
  const [bankId, setBankId] = useState('');

  useEffect(() => {
    if (visible && item) {
      const stats = getLoanStats(item);
      const closeToday = stats.closeTodayAmount !== undefined ? stats.closeTodayAmount : (item.balance || 0);
      setAmount(closeToday.toFixed(2));
      setBankId('');
    }
  }, [visible, item]);

  const confirmRepayment = async () => {
    if (!bankId) {
      Alert.alert('Selection Required', 'Please select a bank account for the repayment.');
      return;
    }
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
      const stats = getLoanStats(item);
      const newBalance = Math.max(0, stats.closeTodayAmount - numAmt);

      await updateAccount({
        id: item.id,
        balance: newBalance,
        loanStartDate: new Date().toISOString()
      });

      if (item.isEmi === 1 && item.recurring && newBalance > 0) {
        const tenureValue = item.loanTenure || 0;
        const n_original = item.type === 'EMI' ? tenureValue : tenureValue * 12;
        const loanStart = new Date(item.loanStartDate);
        const monthsPassed = Math.max(0, differenceInMonths(new Date(), loanStart));
        const remainingMonths = Math.max(1, n_original - monthsPassed);

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

      if (newBalance <= 0) {
        await deleteRecurringByAccountId(item.id);
      }

      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record repayment.');
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
          <Text style={[styles.modalTitle, { fontSize: fs(18), color: theme.text }]}>Repay Loan: {item?.name}</Text>

          <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(13) }]}>Repayment Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
            value={amount}
            onChangeText={setAmount}
            placeholderTextColor={theme.placeholder}
            keyboardType="numeric"
            autoFocus
          />

          <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(13) }]}>Select Payment Source (Bank)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bankList}>
            {accounts.filter(a => a.type === 'BANK').map(bank => (
              <TouchableOpacity
                key={bank.id}
                onPress={() => setBankId(bank.id)}
                style={[
                  styles.bankCard,
                  {
                    borderColor: bankId === bank.id ? theme.primary : theme.border,
                    backgroundColor: bankId === bank.id ? theme.primary + '11' : theme.surface,
                  }
                ]}
              >
                <Text style={[styles.bankName, { color: theme.text, fontSize: fs(13) }]}>{bank.name}</Text>
                <Text style={[styles.bankBalance, { color: theme.textSubtle, fontSize: fs(11) }]}>{getCurrencySymbol(activeUser?.currency)}{(bank.balance || 0).toFixed(0)}</Text>
              </TouchableOpacity>
            ))}
            {accounts.filter(a => a.type === 'BANK').length === 0 && (
              <Text style={{ color: theme.danger, fontSize: fs(12) }}>No bank accounts found! Add one first.</Text>
            )}
          </ScrollView>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.cancelBtn, { borderColor: theme.border }]}
              onPress={onClose}
            >
              <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={confirmRepayment}
            >
              <Text style={[styles.buttonText, { color: 'white' }]}>Confirm</Text>
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
  input: { padding: 14, borderRadius: 10, borderWidth: 1, marginBottom: 16, borderColor: '#ccc' },
  bankList: { marginBottom: 20 },
  bankCard: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    minWidth: 100,
    alignItems: 'center'
  },
  bankName: { fontWeight: '700' },
  bankBalance: { marginTop: 2 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  confirmBtn: {},
  buttonText: { fontWeight: '700' },
});
