import React, { useEffect, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ActivityIndicator
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { getDb } from '../../../services/storage/utils';
import { recordBorrowedPrepayment } from '../../../services/storage/borrowedStorage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { getLoanStats } from '../../../utils/loanUtils';
import { X, Landmark } from 'lucide-react-native';

export default function RepayBorrowedModal({ visible, item, accounts, activeUser, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const [amount, setAmount] = useState('');
  const [bankId, setBankId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && item) {
      const stats = getLoanStats(item);
      setAmount(Math.round(stats.remainingTotal || 0).toString());
      setBankId('');
    }
  }, [visible, item]);

  const handleRepay = async () => {
    if (!bankId) {
      Alert.alert('Selection Required', 'Please select a bank account.');
      return;
    }
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      await recordBorrowedPrepayment(activeUser.id, item.id, bankId, numAmt);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to record repayment.');
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.modalTitle, { fontSize: fs(18), color: theme.text }]}>Repay Borrowed</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={theme.textSubtle} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(12) }]}>PAYMENT AMOUNT</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(16) }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />
            </View>

            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(12), marginTop: 8 }]}>SELECT SOURCE ACCOUNT</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              <View style={styles.bankGrid}>
                {accounts.filter(a => a.type === 'BANK').map(bank => (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => setBankId(bank.id)}
                    style={[
                      styles.bankCard,
                      {
                        borderColor: bankId === bank.id ? theme.primary : theme.border + '20',
                        backgroundColor: bankId === bank.id ? theme.primary + '10' : theme.background,
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Landmark size={18} color={bankId === bank.id ? theme.primary : theme.textSubtle} />
                        <View>
                            <Text style={[styles.bankName, { color: theme.text, fontSize: fs(14) }]}>{bank.name}</Text>
                            <Text style={{ color: theme.textSubtle, fontSize: fs(11) }}>Bal: {currencySymbol}{Math.round(bank.balance || 0).toLocaleString()}</Text>
                        </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={handleRepay}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.confirmText, { fontSize: fs(16) }]}>Confirm Repayment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { padding: 4 },
  body: { gap: 16 },
  label: { fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  input: { padding: 16, borderRadius: 12, borderWidth: 1, fontWeight: '700' },
  bankGrid: { gap: 10 },
  bankCard: { padding: 16, borderRadius: 12, borderWidth: 1.5 },
  bankName: { fontWeight: '800' },
  confirmBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  confirmText: { color: 'white', fontWeight: '900' }
});
