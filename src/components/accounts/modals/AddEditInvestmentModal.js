import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, TrendingUp, Tag } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveInvestmentInfo, updateInvestmentInfo } from '../../../services/storage';
import { FormSection, styles } from './ModalShared';

export default function AddEditInvestmentModal({
  visible, editingId, accountData, openSection, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState('');

  useEffect(() => {
    if (visible && editingId && accountData) {
      setAcName(accountData.name || '');
      setAcBalance((accountData.balance || 0).toString());
    } else if (visible && !editingId) {
      setAcName('');
      setAcBalance('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }

    const type = openSection?.key || 'INVESTMENT';
    const data = {
      name: acName.trim(),
      type,
      balance: parseFloat(acBalance) || 0,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    const db = await getDb();
    if (editingId) {
      await updateInvestmentInfo(db, editingId, data);
    } else {
      await saveInvestmentInfo(db, generateId(), { ...data, userId: activeUser.id });
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
            {editingId ? `Edit ${openSection?.label || 'Account'}` : `Add ${openSection?.label || 'Account'}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Account Setup" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. PPF or Cash" placeholderTextColor={theme.placeholder}
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

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update' : 'Add Account'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
