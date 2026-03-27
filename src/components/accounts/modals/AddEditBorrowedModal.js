import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, IndianRupee, Tag, Clock, CheckCircle2, Landmark } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveBorrowedInfo, updateBorrowedInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditBorrowedModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acDisbursementDate, setAcDisbursementDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcLoanPrincipal((accountData.actualDisbursedPrincipal || accountData.disbursedPrincipal || accountData.loanPrincipal || accountData.principal || '').toString());
      setAcDisbursementDate(accountData.startDate ? new Date(accountData.startDate) : (accountData.loanStartDate ? new Date(accountData.loanStartDate) : new Date()));
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcLoanPrincipal('');
      setAcDisbursementDate(new Date());
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }
    if (!acLoanPrincipal || parseFloat(acLoanPrincipal) <= 0) {
      Alert.alert("Required Field", "Please enter the amount.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'BORROWED',
      disbursedPrincipal: parseFloat(acLoanPrincipal) || 0,
      principal: parseFloat(acLoanPrincipal) || 0,
      loanPrincipal: parseFloat(acLoanPrincipal) || 0,
      interestRate: 0,
      loanInterestRate: 0,
      tenure: 120, // Default 10 years to keep it active
      loanTenure: 120,
      loanType: 'ONE_TIME',
      startDate: acDisbursementDate.toISOString(),
      loanStartDate: acDisbursementDate.toISOString(),
      bankAccountId: acTargetBankId,
      userId: activeUser.id,
      paidMonths: accountData?.paidMonths || 0,
      loanServiceCharge: 0,
      loanTaxPercentage: 0
    };

    if (editingId) {
      await updateBorrowedInfo(activeUser.id, editingId, data);
    } else {
      await saveBorrowedInfo(activeUser.id, data);
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
            {editingId ? 'Edit Borrowed Account' : 'Add Borrowed Account'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 24 }}>
            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>LENDER / DESCRIPTION</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15), fontWeight: '700' }]}
                placeholder="e.g. John Doe" placeholderTextColor={theme.placeholder}
                value={acName} onChangeText={setAcName}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>BORROWED AMOUNT ({getCurrencySymbol(activeUser?.currency)})</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(24), fontWeight: '900' }]}
                placeholder="0" placeholderTextColor={theme.placeholder}
                keyboardType="numeric" value={acLoanPrincipal} onChangeText={acLoanPrincipal => setAcLoanPrincipal(acLoanPrincipal)}
              />
            </View>

            <View>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>RECEIVE TO BANK ACCOUNT</Text>
              <CustomDropdown
                options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                selectedValue={acTargetBankId}
                onSelect={setAcTargetBankId}
                placeholder="Select Bank Account..."
                icon={Landmark}
              />
              <Text style={{ color: theme.textMuted, fontSize: fs(10), marginTop: 4, fontStyle: 'italic' }}>
                * This will add the amount to your bank balance.
              </Text>
            </View>

            <View>
                <DatePicker
                    label="TAKEN DATE"
                    date={acDisbursementDate}
                    onChange={setAcDisbursementDate}
                />
            </View>

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: theme.primary, marginTop: 20, paddingVertical: 18, borderRadius: 16 }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16), fontWeight: '900' }]}>
                {editingId ? 'UPDATE BORROWED' : 'SAVE BORROWED'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
