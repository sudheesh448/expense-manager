import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { X, Landmark } from 'lucide-react-native';
import CustomDropdown from '../CustomDropdown';

export default function LoanActionModal({ visible, mode, account, accounts, onClose, onConfirm, theme, fs }) {
  const [amount, setAmount] = useState('');
  const [bankId, setBankId] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
      const firstBank = (accounts || []).find(a => a.type === 'BANK');
      setBankId(firstBank?.id || '');
    }
  }, [visible]);

  const handleConfirm = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount greater than 0.');
      return;
    }
    if (!bankId) {
      Alert.alert('Required', 'Please select a bank account to pay from.');
      return;
    }
    onConfirm(mode, val, bankId);
  };

  if (!account) return null;

  const title = mode === 'PREPAYMENT' ? 'Principal Prepayment' : 'Pay Loan Fine';
  const label = mode === 'PREPAYMENT' ? 'Additional Amount' : 'Fine Amount';
  const subtitle = mode === 'PREPAYMENT' 
    ? 'This will be reduced from your principal and EMIs will be recalculated.'
    : 'This will be recorded as a loan fine expense.';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: theme.surface }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text, fontSize: fs(18) }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginBottom: 20, fontWeight: '600' }}>{subtitle}</Text>

            <View style={{ marginBottom: 20 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>{label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceMuted || theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(18) }]}
                placeholder="0.00"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
                autoFocus
              />
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.fieldLabel, { color: theme.textSubtle, fontSize: fs(11) }]}>Pay From Account</Text>
              <CustomDropdown
                options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                selectedValue={bankId}
                onSelect={setBankId}
                placeholder="Select Bank Account..."
                icon={Landmark}
              />
            </View>

            <TouchableOpacity 
              style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
              onPress={handleConfirm}
            >
              <Text style={{ color: '#FFF', fontWeight: '900', fontSize: fs(16) }}>CONFIRM PAYMENT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  content: { borderRadius: 28, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
  title: { fontWeight: '900', letterSpacing: 0.5 },
  closeBtn: { padding: 4 },
  fieldLabel: { fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderWidth: 1, borderRadius: 16, padding: 16, fontWeight: '900' },
  confirmBtn: { padding: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 4 },
});
