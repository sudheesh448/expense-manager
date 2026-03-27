import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, User, IndianRupee, Tag, Clock, CheckCircle2, FileText } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { generateId, getDb, saveLendedInfo, updateLendedInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomHeader from '../../CustomHeader';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditLendedModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acDisbursementDate, setAcDisbursementDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');
  const [acNote, setAcNote] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcLoanPrincipal((accountData.principal || accountData.disbursedPrincipal || '').toString());
      setAcDisbursementDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
      setAcNote(accountData.note || '');
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcLoanPrincipal('');
      setAcDisbursementDate(new Date());
      setAcNote('');
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter borrower name.");
      return;
    }
    if (!acLoanPrincipal || parseFloat(acLoanPrincipal) <= 0) {
      Alert.alert("Required Field", "Please enter the amount lent.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'LENDED',
      principal: parseFloat(acLoanPrincipal) || 0,
      disbursedPrincipal: parseFloat(acLoanPrincipal) || 0,
      startDate: acDisbursementDate.toISOString(),
      loanStartDate: acDisbursementDate.toISOString(),
      loanType: 'ONE_TIME',
      interestRate: 0,
      tenure: 1, // Simplified for one-time
      bankAccountId: acTargetBankId,
      note: acNote.trim(),
      userId: activeUser.id,
      paidMonths: accountData?.paidMonths || 0
    };

    if (editingId) {
      await updateLendedInfo(activeUser.id, editingId, data);
    } else {
      await saveLendedInfo(activeUser.id, data);
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
            title={editingId ? 'Edit Lended Account' : 'Add Lended Account'}
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
            <FormSection title="Account Setup" icon={User} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Borrower Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. John Doe" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Amount Lent</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: theme.text, fontSize: fs(16), marginRight: 8, fontWeight: 'bold' }}>{currencySymbol}</Text>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acLoanPrincipal} onChangeText={setAcLoanPrincipal}
                  />
                </View>
              </View>
            </FormSection>

            <FormSection title="Transaction Details" icon={Clock} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <DatePicker
                  label="Lent Date"
                  date={acDisbursementDate}
                  onChange={setAcDisbursementDate}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Deduct From Account</Text>
                <CustomDropdown
                  options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                  selectedValue={acTargetBankId}
                  onSelect={setAcTargetBankId}
                  placeholder="Select Bank/Wallet..."
                  icon={IndianRupee}
                />
                <Text style={{ color: theme.textSubtle, fontSize: fs(10), marginTop: 4, fontStyle: 'italic' }}>
                  * This amount will be recorded as a cash outflow from the selected account.
                </Text>
              </View>
            </FormSection>

            <FormSection title="Additional Info" icon={FileText} theme={theme} fs={fs}>
               <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Description/Note</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14), height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Add details about this loan..." placeholderTextColor={theme.placeholder}
                  multiline value={acNote} onChangeText={setAcNote}
                />
              </View>
            </FormSection>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary, marginTop: 20 }]} 
              onPress={handleSave}
            >
              <CheckCircle2 size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update Record' : 'Save Lending Record'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  </Modal>
);
}
