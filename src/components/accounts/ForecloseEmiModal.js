import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TextInput, TouchableOpacity, Modal, Alert,
} from 'react-native';
import { AlertTriangle, Landmark, CheckCircle2, X } from 'lucide-react-native';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { forecloseEmi } from '../../services/storage/emiStorage';
import { getEmiStats } from '../../utils/emiUtils';

import { useTheme } from '../../context/ThemeContext';

export default function ForecloseEmiModal({ visible, item, accounts, activeUser, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const [amount, setAmount] = useState('');
  const [bankId, setBankId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && item) {
      const stats = getEmiStats(item);

      // For foreclosure, we typically pay the remaining principal or a slightly different settlement amount
      // We'll default to the remaining total (Principal + any pending interest/fine)
      setAmount(stats.remainingTotal.toFixed(2));
      setBankId('');
    }
  }, [visible, item]);

  const handleForeclose = async () => {
    if (!bankId) {
      Alert.alert('Selection Required', 'Please select a bank/savings account for the payment.');
      return;
    }
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid foreclosure amount.');
      return;
    }

    Alert.alert(
      'Confirm Foreclosure',
      'This will close the EMI account permanently, reclaim your credit limit, and delete all future scheduled payments for this loan. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Confirm & Close', 
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await forecloseEmi(activeUser.id, item.id, bankId, numAmt);
              onSuccess();
              onClose();
            } catch (e) {
              console.error(e);
              Alert.alert('Error', 'Failed to foreclose EMI. Please check your balance.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const stats = item ? getLoanStats(item) : null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.modalTitle, { fontSize: fs(18), color: theme.text }]}>Foreclose EMI</Text>
              <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>{item?.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={theme.textMuted} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.infoBox, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
               <View style={styles.infoRow}>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>Current Outstanding</Text>
                  <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '700' }}>{getCurrencySymbol(activeUser?.currency)}{(stats?.remainingTotal || 0).toLocaleString()}</Text>
               </View>
            </View>

            <View style={[styles.warningBox, { backgroundColor: '#fff7ed', borderColor: '#fed7aa' }]}>
              <AlertTriangle size={18} color="#f59e0b" />
              <Text style={{ color: '#9a3412', fontSize: fs(12), flex: 1, marginLeft: 8 }}>
                Foreclosing will stop all future monthly installments and reclaim your credit card limit immediately.
              </Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={[styles.label, { color: theme.text, fontSize: fs(13) }]}>Foreclosure Settlement Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(16) }]}
                value={amount}
                onChangeText={setAmount}
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />
            </View>

            <Text style={[styles.label, { color: theme.text, fontSize: fs(13), marginBottom: 12 }]}>Pay From Account</Text>
            <View style={styles.bankGrid}>
              {accounts.filter(a => a.type === 'BANK' || a.type === 'SAVINGS').map(bank => (
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
                  <View style={styles.bankHeader}>
                    <Landmark size={14} color={bankId === bank.id ? theme.primary : theme.textMuted} />
                    {bankId === bank.id && <CheckCircle2 size={12} color={theme.primary} />}
                  </View>
                  <Text style={[styles.bankName, { color: theme.text, fontSize: fs(12) }]} numberOfLines={1}>{bank.name}</Text>
                  <Text style={[styles.bankBalance, { color: theme.textSubtle, fontSize: fs(11) }]}>{getCurrencySymbol(activeUser?.currency)}{(bank.balance || 0).toLocaleString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.confirmBtn, { backgroundColor: theme.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleForeclose}
              disabled={loading}
            >
              <Text style={[styles.confirmText, { fontSize: fs(16) }]}>
                {loading ? 'Processing...' : 'Confirm Foreclosure'}
              </Text>
            </TouchableOpacity>
            
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, minHeight: '60%', maxBy: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  infoBox: { padding: 16, borderRadius: 16, borderWeight: 1, gap: 10, marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  warningBox: { flexDirection: 'row', padding: 12, borderRadius: 12, borderWeight: 1, marginBottom: 20, alignItems: 'center' },
  inputSection: { marginBottom: 20 },
  label: { fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  input: { height: 56, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, fontWeight: '700' },
  bankGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  bankCard: { width: '48%', padding: 12, borderRadius: 14, borderWidth: 1.5 },
  bankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bankName: { fontWeight: '700', marginBottom: 2 },
  bankBalance: { fontWeight: '500' },
  confirmBtn: { height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  confirmText: { color: 'white', fontWeight: '900', letterSpacing: 1 },
});
