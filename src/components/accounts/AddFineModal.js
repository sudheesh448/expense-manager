import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, 
  TouchableOpacity, TextInput, 
  TouchableWithoutFeedback, Keyboard 
} from 'react-native';
import { X, AlertCircle, Landmark } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import CustomDropdown from '../CustomDropdown';
import { recordAccountFine, getDb } from '../../services/storage/core';


import { useTheme } from '../../context/ThemeContext';


export default function AddFineModal({ visible, item, monthKey, accounts, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const { activeUser } = useAuth();
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      const defaultBank = accounts.find(a => a.type === 'BANK' || a.type === 'SAVINGS');
      if (defaultBank) setBankAccountId(defaultBank.id);
    }
  }, [visible, accounts]);

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) return;
    if (!bankAccountId) {
      alert("Please select a bank account for the payment.");
      return;
    }

    setLoading(true);
    try {
      const db = await getDb();
      const success = await recordAccountFine(activeUser.id, item.id, amount, bankAccountId, monthKey, getCurrencySymbol(activeUser?.currency));
      onSuccess();
      onClose();
    } catch (error) {
      console.error(error);
      alert("Failed to record fine.");
    } finally {
      setLoading(false);
    }
  };

  const bankOptions = accounts
    .filter(a => a.type === 'BANK' || a.type === 'SAVINGS')
    .map(a => ({ 
      label: `${a.name} (${getCurrencySymbol(activeUser?.currency)}${(a.balance || 0).toFixed(0)})`, 
      value: a.id,
      accountType: a.type
    }));

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: theme.surface }]}>
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={20} color={theme.danger} />
                <Text style={[styles.title, { color: theme.text, fontSize: fs(18) }]}>Add Delinquency Fine</Text>
              </View>
              <TouchableOpacity onPress={onClose}><X size={22} color={theme.textSubtle} /></TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 16 }}>
                Add a late payment penalty to <Text style={{ color: theme.text, fontWeight: '700' }}>{item?.name}</Text>. 
                This will be recorded as a transaction and added to your total paid amount.
              </Text>

              <Text style={[styles.label, { color: theme.textMuted, fontSize: fs(12) }]}>Fine Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, fontSize: fs(16) }]}
                placeholder="e.g. 500" placeholderTextColor={theme.placeholder}
                keyboardType="numeric" autoFocus value={amount} onChangeText={setAmount}
              />

              <Text style={[styles.label, { color: theme.textMuted, fontSize: fs(12), marginTop: 16 }]}>Paid From</Text>
              <CustomDropdown
                options={bankOptions}
                selectedValue={bankAccountId}
                onSelect={setBankAccountId}
                theme={theme}
                icon={Landmark}
              />
            </View>

            <View style={styles.footer}>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: theme.border }]} 
                onPress={onClose}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.btn, { backgroundColor: theme.danger }]} 
                disabled={loading}
                onPress={handleSave}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>{loading ? 'Saving...' : 'Confirm Fine'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modal: { borderRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  title: { fontWeight: '800' },
  body: { padding: 20 },
  label: { marginBottom: 8, fontWeight: '700' },
  input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, padding: 20, paddingTop: 10 },
  btn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }
});
