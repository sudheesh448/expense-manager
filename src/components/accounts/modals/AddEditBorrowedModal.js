import { Landmark, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../context/ThemeContext';
import { saveBorrowedInfo, updateBorrowedInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomDropdown from '../../CustomDropdown';
import CustomHeader from '../../CustomHeader';
import DatePicker from '../../DatePicker';
import { styles } from './ModalShared';

export default function AddEditBorrowedModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acInterestRate, setAcInterestRate] = useState('');
  const [acTenure, setAcTenure] = useState('');
  const [acDisbursementDate, setAcDisbursementDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');
  const [acNote, setAcNote] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcLoanPrincipal((accountData.principal || accountData.disbursedPrincipal || '').toString());
      setAcInterestRate((accountData.interestRate || '').toString());
      setAcTenure((accountData.tenure || '').toString());
      setAcDisbursementDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
      setAcNote(accountData.note || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcLoanPrincipal('');
      setAcInterestRate('');
      setAcTenure('');
      setAcDisbursementDate(new Date());
      setAcTargetBankId('');
      setAcNote('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter lender name.");
      return;
    }
    if (!acLoanPrincipal || parseFloat(acLoanPrincipal) <= 0) {
      Alert.alert("Required Field", "Please enter borrowed amount.");
      return;
    }

    const data = {
      name: acName.trim(),
      type: 'BORROWED',
      principal: parseFloat(acLoanPrincipal) || 0,
      disbursedPrincipal: parseFloat(acLoanPrincipal) || 0,
      interestRate: parseFloat(acInterestRate) || 0,
      tenure: parseInt(acTenure, 10) || 1,
      startDate: acDisbursementDate.toISOString(),
      loanStartDate: acDisbursementDate.toISOString(),
      loanType: 'ONE_TIME',
      bankAccountId: acTargetBankId,
      note: acNote.trim(),
      userId: activeUser.id,
      paidMonths: accountData?.paidMonths || 0
    };

    if (editingId) {
      await updateBorrowedInfo(activeUser.id, editingId, data);
    } else {
      await saveBorrowedInfo(activeUser.id, data);
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
            title={editingId ? 'Edit Borrowed Account' : 'Add Borrowed Account'}
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
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>RECEIVE TO BANK ACCOUNT (OPTIONAL)</Text>
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

              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>NOTE (OPTIONAL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14), height: 100, textAlignVertical: 'top', paddingTop: 12 }]}
                  placeholder="Add details about this debt..." placeholderTextColor={theme.placeholder}
                  multiline value={acNote} onChangeText={setAcNote}
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
      </SafeAreaView>
    </Modal>
  );
}
