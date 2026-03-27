import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, Landmark, Tag } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveBankInfo, updateBankInfo } from '../../../services/storage';
import { FormSection, styles } from './ModalShared';

export default function AddEditBankModal({
  visible, editingId, accountData, openSection, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState('');
  const [acIfsc, setAcIfsc] = useState('');
  const [acAccountNumber, setAcAccountNumber] = useState('');
  const [acCustomerId, setAcCustomerId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcBalance((accountData.balance || 0).toString());
      setAcIfsc(accountData.ifsc || '');
      setAcAccountNumber(accountData.accountNumber || '');
      setAcCustomerId(accountData.customerId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcBalance('');
      setAcIfsc('');
      setAcAccountNumber('');
      setAcCustomerId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter an account name.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'BANK',
      balance: parseFloat(acBalance) || 0,
      ifsc: acIfsc,
      accountNumber: acAccountNumber,
      customerId: acCustomerId,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    const db = await getDb();
    if (editingId) {
      await updateBankInfo(db, editingId, data);
    } else {
      await saveBankInfo(db, generateId(), { ...data, userId: activeUser.id });
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
            {editingId ? 'Edit Bank Account' : 'Add Bank Account'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Basic Information" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Account Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. HDFC Salary" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Current Balance</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
              </View>
            </FormSection>

            <FormSection title="Banking Details" icon={Landmark} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>IFSC Code</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. HDFC0001234" placeholderTextColor={theme.placeholder}
                  autoCapitalize="characters" value={acIfsc} onChangeText={setAcIfsc}
                />
              </View>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Account Number</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. 50100234..." placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acAccountNumber} onChangeText={setAcAccountNumber}
                />
              </View>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Customer ID</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. 98765432" placeholderTextColor={theme.placeholder}
                  value={acCustomerId} onChangeText={setAcCustomerId}
                />
              </View>
            </FormSection>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update Bank' : 'Add Bank'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
