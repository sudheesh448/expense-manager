import React, { useEffect, useState } from 'react';
import {
  Alert, Modal, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ActivityIndicator
} from 'react-native';
import { useTheme } from '../../../context/ThemeContext';
import { forecloseBorrowed } from '../../../services/storage/borrowedStorage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { getLoanStats } from '../../../utils/loanUtils';
import { X, Landmark, AlertTriangle } from 'lucide-react-native';

export default function ForecloseBorrowedModal({ visible, item, accounts, activeUser, onClose, onSuccess }) {
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

  const handleForeclose = async () => {
    if (!bankId) {
      Alert.alert('Selection Required', 'Please select a bank account.');
      return;
    }
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt < 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setLoading(true);
    try {
      await forecloseBorrowed(activeUser.id, item.id, bankId, numAmt);
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to foreclose account.');
    } finally {
      setLoading(false);
    }
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={24} color={theme.danger} />
                <Text style={[styles.modalTitle, { fontSize: fs(18), color: theme.text }]}>Foreclose Borrowed</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={theme.textSubtle} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 10 }}>
                This will settle the borrowed account and close it permanently. Enter the final settlement amount being paid back.
            </Text>

            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(12) }]}>SETTLEMENT AMOUNT</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(16) }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />
            </View>

            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(12), marginTop: 8 }]}>PAY FROM BANK ACCOUNT</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 200 }}>
              <View style={styles.bankGrid}>
                {accounts.filter(a => a.type === 'BANK').map(bank => (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => setBankId(bank.id)}
                    style={[
                      styles.bankCard,
                      {
                        borderColor: bankId === bank.id ? theme.danger : theme.border + '20',
                        backgroundColor: bankId === bank.id ? theme.danger + '10' : theme.background,
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Landmark size={18} color={bankId === bank.id ? theme.danger : theme.textSubtle} />
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
              style={[styles.confirmBtn, { backgroundColor: theme.danger }]}
              onPress={handleForeclose}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={[styles.confirmText, { fontSize: fs(16) }]}>Settle & Foreclose</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontWeight: '900', letterSpacing: -0.5 },
  closeBtn: { padding: 4 },
  body: { gap: 12 },
  label: { fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  input: { padding: 16, borderRadius: 12, borderWidth: 1, fontWeight: '700' },
  bankGrid: { gap: 10 },
  bankCard: { padding: 14, borderRadius: 12, borderWidth: 1.5 },
  bankName: { fontWeight: '800' },
  confirmBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 12 },
  confirmText: { color: 'white', fontWeight: '900' }
});
