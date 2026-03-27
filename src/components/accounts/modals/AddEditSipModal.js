import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, TrendingUp, Tag, Landmark } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { generateId, getDb, saveSipInfo, updateSipInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomHeader from '../../CustomHeader';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditSipModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acAmount, setAcAmount] = useState('');
  const [acFrequency, setAcFrequency] = useState('MONTHLY');
  const [acStartDate, setAcStartDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcAmount((accountData.amount || '').toString());
      setAcFrequency(accountData.frequency || 'MONTHLY');
      setAcStartDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcAmount('');
      setAcFrequency('MONTHLY');
      setAcStartDate(new Date());
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a SIP name.");
      return;
    }
    if (!acAmount || parseFloat(acAmount) <= 0) {
      Alert.alert("Required Field", "Please enter SIP amount.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'SIP',
      amount: parseFloat(acAmount) || 0,
      frequency: acFrequency,
      startDate: acStartDate.toISOString(),
      bankAccountId: acTargetBankId,
      userId: activeUser.id,
      status: 'ACTIVE'
    };

    if (editingId) {
      await updateSipInfo(activeUser.id, editingId, data);
    } else {
      await saveSipInfo(activeUser.id, data);
    }

    onSuccess();
    onClose();
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  const frequencyOptions = [
    { label: 'Monthly', value: 'MONTHLY' },
    { label: 'Quarterly', value: 'QUARTERLY' },
    { label: 'Half-Yearly', value: 'HALF_YEARLY' },
    { label: 'Yearly', value: 'YEARLY' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <CustomHeader
            title={editingId ? 'Edit SIP' : 'Add SIP'}
            leftComponent={
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            }
            theme={theme}
            fs={fs}
            containerStyle={{ paddingTop: 12 }}
          />

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
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>SIP Amount</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0.00" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acAmount} onChangeText={setAcAmount}
                  />
                </View>
              </FormSection>

              <FormSection title="Investment Details" icon={TrendingUp} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Frequency</Text>
                  <CustomDropdown
                    options={frequencyOptions}
                    selectedValue={acFrequency}
                    onSelect={setAcFrequency}
                    placeholder="Select Frequency..."
                  />
                </View>
                <View style={{ marginBottom: 16 }}>
                  <DatePicker
                    label="SIP Start Date"
                    date={acStartDate}
                    onChange={setAcStartDate}
                  />
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Deduct From Bank Account</Text>
                  <CustomDropdown
                    options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                    selectedValue={acTargetBankId}
                    onSelect={setAcTargetBankId}
                    placeholder="Select Bank (Optional)..."
                    icon={Landmark}
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
      </SafeAreaView>
    </Modal>
  );
}
