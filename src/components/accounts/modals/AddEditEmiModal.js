import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, CreditCard, Tag, Clock, IndianRupee } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { saveEmiInfo, updateEmiInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomHeader from '../../CustomHeader';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditEmiModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acInterestRate, setAcInterestRate] = useState('');
  const [acTenure, setAcTenure] = useState('');
  const [acEmiAmount, setAcEmiAmount] = useState('');
  const [acStartDate, setAcStartDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');
  const [acServiceCharge, setAcServiceCharge] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcLoanPrincipal((accountData.principal || accountData.loanPrincipal || '').toString());
      setAcInterestRate((accountData.interestRate || accountData.loanInterestRate || '').toString());
      setAcTenure((accountData.tenure || accountData.loanTenure || '').toString());
      setAcEmiAmount((accountData.emiAmount || '').toString());
      setAcStartDate(accountData.startDate ? new Date(accountData.startDate) : (accountData.loanStartDate ? new Date(accountData.loanStartDate) : new Date()));
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
      setAcServiceCharge((accountData.processingFee || '').toString());
    } else if (visible && !editingId) {
      setAcName('');
      setAcLoanPrincipal('');
      setAcInterestRate('');
      setAcTenure('');
      setAcEmiAmount('');
      setAcStartDate(new Date());
      setAcTargetBankId('');
      setAcServiceCharge('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }
    if (!acEmiAmount || parseFloat(acEmiAmount) <= 0) {
      Alert.alert("Required Field", "Please enter EMI amount.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'EMI',
      emiAmount: parseFloat(acEmiAmount) || 0,
      principal: parseFloat(acLoanPrincipal) || 0,
      interestRate: parseFloat(acInterestRate) || 0,
      tenure: parseInt(acTenure, 10) || 1,
      startDate: acStartDate.toISOString(),
      bankAccountId: acTargetBankId,
      linkedAccountId: acTargetBankId,
      processingFee: parseFloat(acServiceCharge) || 0,
      userId: activeUser.id,
      status: 'ACTIVE',
      paidMonths: accountData?.paidMonths || 0
    };

    if (editingId) {
      await updateEmiInfo(activeUser.id, editingId, data);
    } else {
      await saveEmiInfo(activeUser.id, data);
    }

    onSuccess();
    onClose();
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <CustomHeader
            title={editingId ? 'Edit EMI Account' : 'Add EMI Account'}
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
              <FormSection title="Loan Details" icon={Tag} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Description</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="e.g. iPhone Purchase" placeholderTextColor={theme.placeholder}
                    value={acName} onChangeText={setAcName}
                  />
                </View>
                <View>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Product Price / Principal</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0.00" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acLoanPrincipal} onChangeText={setAcLoanPrincipal}
                  />
                </View>
              </FormSection>

              <FormSection title="Credit Card Linkage" icon={CreditCard} theme={theme} fs={fs}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Source Credit Card</Text>
                  <CustomDropdown
                    options={(accounts || []).filter(a => a.type === 'CREDIT_CARD').map(a => ({ label: a.name, value: a.id }))}
                    selectedValue={acTargetBankId}
                    onSelect={setAcTargetBankId}
                    placeholder="Select Credit Card..."
                    icon={CreditCard}
                  />
                </View>
              </FormSection>

              <FormSection title="EMI Configuration" icon={Clock} theme={theme} fs={fs}>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Tenure (Months)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="0" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acTenure} onChangeText={setAcTenure}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <DatePicker
                      label="EMI Start Date"
                      date={acStartDate}
                      onChange={setAcStartDate}
                    />
                  </View>
                </View>

                <View style={{ mt: 16 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>EMI Amount</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0.00" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acEmiAmount} onChangeText={setAcEmiAmount}
                  />
                </View>
              </FormSection>

              <FormSection title="Fees" icon={IndianRupee} theme={theme} fs={fs}>
                  <View>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Processing Fee</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="0.00" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acServiceCharge} onChangeText={setAcServiceCharge}
                    />
                  </View>
              </FormSection>

              <TouchableOpacity 
                style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
                onPress={handleSave}
              >
                <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                  {editingId ? 'Update EMI' : 'Add EMI'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
