import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, CreditCard, Tag, Clock, IndianRupee } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveEmi, updateEmiInfo } from '../../../services/storage';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditEmiModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acProductPrice, setAcProductPrice] = useState(''); // Original amount
  const [acBalance, setAcBalance] = useState(''); // Current usage
  const [acSourceCcId, setAcSourceCcId] = useState('');
  const [acTenure, setAcTenure] = useState('');
  const [billingDay, setBillingDay] = useState('1');
  const [acLoanStartDate, setAcLoanStartDate] = useState(new Date());
  const [acServiceCharge, setAcServiceCharge] = useState('');
  const [acEmiAmount, setAcEmiAmount] = useState('');

  useEffect(() => {
    if (visible && editingId && accountData) {
      setAcName(accountData.name || '');
      setAcProductPrice((accountData.productPrice || accountData.amount || '').toString());
      setAcBalance((accountData.balance || 0).toString());
      setAcSourceCcId(accountData.linkedAccountId || '');
      setAcTenure((accountData.tenure || '').toString());
      setBillingDay((accountData.emiDate || 1).toString());
      setAcLoanStartDate(accountData.emiStartDate ? new Date(accountData.emiStartDate) : new Date());
      setAcServiceCharge((accountData.processingFee || '').toString());
      setAcEmiAmount((accountData.amount || accountData.emiAmount || '').toString());
    } else if (visible && !editingId) {
      setAcName('');
      setAcProductPrice('');
      setAcBalance('');
      setAcSourceCcId('');
      setAcTenure('');
      setBillingDay('1');
      setAcLoanStartDate(new Date());
      setAcServiceCharge('');
      setAcEmiAmount('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a description.");
      return;
    }
    if (!acSourceCcId) {
      Alert.alert("Required Field", "Please select a source credit card.");
      return;
    }
    if (!acEmiAmount || parseFloat(acEmiAmount) <= 0) {
      Alert.alert("Required Field", "Please enter the EMI amount.");
      return;
    }

    const data = {
      name: acName.trim(),
      amount: parseFloat(acProductPrice) || 0,
      ccUsage: parseFloat(acProductPrice) || 0,
      accountId: acSourceCcId,
      linkedAccountId: acSourceCcId,
      tenure: parseInt(acTenure, 10) || 1,
      emiDate: parseInt(billingDay, 10) || 1,
      loanStartDate: acLoanStartDate.toISOString(),
      serviceCharge: parseFloat(acServiceCharge) || 0,
      taxPercentage: 0, // Tax removed as requested
      emiAmount: parseFloat(acEmiAmount),
      userId: activeUser.id,
      note: acName.trim()
    };

    const db = await getDb();
    if (editingId) {
      await updateEmiInfo(db, editingId, data);
    } else {
      await saveEmi(activeUser.id, { ...data, id: generateId() });
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
            {editingId ? 'Edit Credit Card EMI' : 'Add Credit Card EMI'}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Purchase Details" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Description</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. iPhone Purchase" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>
              <View>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Product Price</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acProductPrice} onChangeText={setAcProductPrice}
                />
              </View>
            </FormSection>

            <FormSection title="Credit Card Linkage" icon={CreditCard} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Source Credit Card</Text>
                <CustomDropdown
                  options={(accounts || []).filter(a => a.type === 'CREDIT_CARD').map(a => ({ label: a.name, value: a.id }))}
                  selectedValue={acSourceCcId}
                  onSelect={setAcSourceCcId}
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
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Installment Day</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="DD" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={billingDay} onChangeText={setBillingDay}
                    maxLength={2}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>EMI Amount</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acEmiAmount} onChangeText={setAcEmiAmount}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <DatePicker
                  label="Purchase Date"
                  date={acLoanStartDate}
                  onChange={setAcLoanStartDate}
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
    </Modal>
  );
}
