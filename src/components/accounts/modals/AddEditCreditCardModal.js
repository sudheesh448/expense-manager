import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, CreditCard, Tag, Calendar } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveCreditCardInfo, updateCreditCardInfo } from '../../../services/storage';
import { FormSection, styles } from './ModalShared';

export default function AddEditCreditCardModal({
  visible, editingId, accountData, openSection, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState(''); // Current usage
  const [acCreditLimit, setAcCreditLimit] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [dueDay, setDueDay] = useState('1');
  const [acCardNumber, setAcCardNumber] = useState('');
  const [acExpiry, setAcExpiry] = useState('');
  const [acCvv, setAcCvv] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcBalance((accountData.balance || 0).toString());
      setAcCreditLimit((accountData.creditLimit || 0).toString());
      setBillingDay((accountData.billingDay || 1).toString());
      setDueDay((accountData.dueDay || 1).toString());
      setAcCardNumber(accountData.cardNumber || '');
      setAcExpiry(accountData.expiry || '');
      setAcCvv(accountData.cvv || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcBalance('');
      setAcCreditLimit('');
      setBillingDay('1');
      setDueDay('1');
      setAcCardNumber('');
      setAcExpiry('');
      setAcCvv('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a card name.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'CREDIT_CARD',
      balance: parseFloat(acBalance) || 0,
      creditLimit: parseFloat(acCreditLimit) || 0,
      billingDay: parseInt(billingDay, 10) || 1,
      dueDay: parseInt(dueDay, 10) || 1,
      cardNumber: acCardNumber,
      expiry: acExpiry,
      cvv: acCvv,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    const db = await getDb();
    if (editingId) {
      await updateCreditCardInfo(db, editingId, data);
    } else {
      await saveCreditCardInfo(db, generateId(), { ...data, userId: activeUser.id });
    }

    onSuccess();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalWrap, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>
            {editingId ? 'Edit Credit Card' : 'Add Credit Card'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Card Information" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Card Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. Amazon ICICI" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Credit Limit</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acCreditLimit} onChangeText={setAcCreditLimit}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Current Usage</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                  />
                </View>
              </View>
            </FormSection>

            <FormSection title="Billing Cycle" icon={Calendar} theme={theme} fs={fs}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Statement Date</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="DD" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={billingDay} onChangeText={setBillingDay}
                    maxLength={2}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Due Date</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="DD" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={dueDay} onChangeText={setDueDay}
                    maxLength={2}
                  />
                </View>
              </View>
            </FormSection>

            <FormSection title="Security (Optional)" icon={CreditCard} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Card Number (Last 4 digits)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. 1234" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acCardNumber} onChangeText={setAcCardNumber}
                  maxLength={4}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Expiry (MM/YY)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="MM/YY" placeholderTextColor={theme.placeholder}
                    value={acExpiry} onChangeText={setAcExpiry}
                    maxLength={5}
                  />
                </View>
                {/* CVV hidden for security but kept if needed by user */}
              </View>
            </FormSection>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update Card' : 'Add Card'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
