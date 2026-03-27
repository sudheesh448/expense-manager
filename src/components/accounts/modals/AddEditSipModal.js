import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, TrendingUp, Tag } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveSIPAccount, updateSIPAccount } from '../../../services/storage';
import { FormSection, styles } from './ModalShared';

export default function AddEditSipModal({
  visible, editingId, accountData, openSection, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState('');
  const [acSipAmount, setAcSipAmount] = useState('');
  const [billingDay, setBillingDay] = useState('1');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcBalance((accountData.balance || 0).toString());
      setAcSipAmount((accountData.sipAmount || '').toString());
      setBillingDay((accountData.billingDay || 1).toString());
    } else if (visible && !editingId) {
      setAcName('');
      setAcBalance('');
      setAcSipAmount('');
      setBillingDay('1');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'SIP',
      balance: parseFloat(acBalance) || 0,
      sipAmount: parseFloat(acSipAmount) || 0,
      billingDay: parseInt(billingDay, 10) || 1,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    const db = await getDb();
    if (editingId) {
      await updateSIPAccount(db, editingId, data);
    } else {
      await saveSIPAccount(db, generateId(), { ...data, userId: activeUser.id });
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
            {editingId ? 'Edit SIP' : 'Add SIP'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Account Setup" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>SIP Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. Parag Parikh Flexi Cap" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Current Value</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
              </View>
            </FormSection>

            <FormSection title="Investment Details" icon={TrendingUp} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Monthly SIP Amount</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acSipAmount} onChangeText={setAcSipAmount}
                />
              </View>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Monthly Date</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="DD" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={billingDay} onChangeText={setBillingDay}
                  maxLength={2}
                />
              </View>
            </FormSection>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update SIP' : 'Add SIP'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
