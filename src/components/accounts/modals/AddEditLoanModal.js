import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { X, IndianRupee, Tag, Clock, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateId, getDb, saveLoanInfo, updateLoanInfo } from '../../../services/storage';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import CustomDropdown from '../../CustomDropdown';
import DatePicker from '../../DatePicker';
import { FormSection, styles } from './ModalShared';

export default function AddEditLoanModal({
  visible, editingId, accountData, openSection, accounts, activeUser, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();

  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acInterestRate, setAcInterestRate] = useState('');
  const [acTenure, setAcTenure] = useState('');
  const [acLoanType, setAcLoanType] = useState('ONE_TIME');
  const [acDisbursementDate, setAcDisbursementDate] = useState(new Date());
  const [acEmiStartDate, setAcEmiStartDate] = useState(new Date());
  const [acServiceCharge, setAcServiceCharge] = useState('');
  const [acTaxPercentage, setAcTaxPercentage] = useState('0');
  const [acTargetBankId, setAcTargetBankId] = useState('');

  useEffect(() => {
    if (visible && (editingId || accountData)) {
      setAcName(accountData.name || '');
      setAcLoanPrincipal((accountData.actualDisbursedPrincipal || accountData.disbursedPrincipal || accountData.loanPrincipal || accountData.productPrice || '').toString());
      setAcInterestRate((accountData.interestRate || accountData.loanInterestRate || '').toString());
      setAcTenure((accountData.tenure || accountData.loanTenure || '').toString());
      setAcLoanType(accountData.loanType || 'ONE_TIME');
      setAcDisbursementDate(accountData.startDate ? new Date(accountData.startDate) : (accountData.loanStartDate ? new Date(accountData.loanStartDate) : new Date()));
      setAcEmiStartDate(accountData.emiStartDate ? new Date(accountData.emiStartDate) : new Date());
      setAcServiceCharge((accountData.processingFee || accountData.loanServiceCharge || '').toString());
      setAcTaxPercentage((accountData.loanTaxPercentage || '0').toString());
      setAcTargetBankId(accountData.linkedAccountId || accountData.bankAccountId || '');
    } else if (visible && !editingId) {
      setAcName('');
      setAcBalance('');
      setAcLoanPrincipal('');
      setAcInterestRate('');
      setAcTenure('');
      setAcLoanType('ONE_TIME');
      setAcDisbursementDate(new Date());
      setAcEmiStartDate(new Date());
      setAcServiceCharge('');
      setAcTaxPercentage('0');
      setAcTargetBankId('');
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) {
      Alert.alert("Required Field", "Please enter a name.");
      return;
    }
    if (!acLoanPrincipal || parseFloat(acLoanPrincipal) <= 0) {
      Alert.alert("Required Field", "Please enter the principal amount.");
      return;
    }
    if (!acTenure || parseInt(acTenure, 10) <= 0) {
      Alert.alert("Required Field", "Tenure must be greater than 0.");
      return;
    }

    const type = openSection?.key || 'LOAN';
    const data = {
      name: acName.trim(),
      type,
      disbursedPrincipal: parseFloat(acLoanPrincipal) || 0,
      interestRate: parseFloat(acInterestRate) || 0,
      tenure: parseInt(acTenure, 10) || 0,
      startDate: acDisbursementDate.toISOString(),
      loanPrincipal: parseFloat(acLoanPrincipal) || 0,
      loanInterestRate: parseFloat(acInterestRate) || 0,
      loanTenure: parseInt(acTenure, 10) || 0,
      loanType: acLoanType,
      loanStartDate: acDisbursementDate.toISOString(),
      emiStartDate: acLoanType === 'EMI' ? acEmiStartDate.toISOString() : null,
      loanServiceCharge: parseFloat(acServiceCharge) || 0,
      loanTaxPercentage: parseFloat(acTaxPercentage) || 0,
      loanFinePercentage: 0,
      loanProcessingFee: parseFloat(acServiceCharge) || 0,
      bankAccountId: acTargetBankId,
      userId: activeUser.id,
      status: 'ACTIVE',
      principal: editingId && accountData ? accountData.principal : (parseFloat(acLoanPrincipal) || 0),
      paidMonths: accountData?.paidMonths || 0
    };

    const db = await getDb();
    if (editingId) {
      await updateLoanInfo(activeUser.id, editingId, data);
    } else {
      await saveLoanInfo(activeUser.id, data);
    }

    onSuccess();
    onClose();
  };

  const renderSummary = () => {
    if (!(acLoanPrincipal && acTenure)) return null;

    const P = parseFloat(acLoanPrincipal) || 0;
    const R = parseFloat(acInterestRate) || 0;
    const n = parseInt(acTenure, 10) || 0;
    const SC = parseFloat(acServiceCharge) || 0;
    const TX = (parseFloat(acTaxPercentage) || 0) / 100;
    const feeWithTax = SC * (1 + TX);
    
    let emi = 0;
    const r = R / 1200;
    if (acLoanType === 'EMI') {
      if (r > 0 && n > 0) {
        emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      } else if (n > 0) {
        emi = P / n;
      }
    }

    const totalInterest = acLoanType === 'EMI' ? ((emi * n) - P) : (P * (R / 100) * (n / 12));
    const totalTax = totalInterest * (parseFloat(acTaxPercentage) / 100);
    const totalCost = P + totalInterest + totalTax + feeWithTax;
    const creditedAmount = P - SC;

    const currencySymbol = getCurrencySymbol(activeUser?.currency);

    return (
      <View style={[styles.summaryCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <CheckCircle2 size={18} color={theme.primary} style={{ marginRight: 8 }} />
          <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '800', letterSpacing: 0.5 }}>
            {acLoanType === 'EMI' ? 'EMI LOAN PROJECTION' : 'ONE-TIME LOAN PROJECTION'}
          </Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Principal Amount</Text>
          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{currencySymbol}{P.toLocaleString()}</Text>
        </View>

        {SC > 0 && (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Processing Fee</Text>
            <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{currencySymbol}{SC.toLocaleString()}</Text>
          </View>
        )}

        <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.border + '50', borderStyle: 'dashed' }]}>
          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '800' }}>Net Credited Amount</Text>
          <Text style={{ color: theme.primary, fontSize: fs(13), fontWeight: '800' }}>{currencySymbol}{creditedAmount.toLocaleString()}</Text>
        </View>

        <View style={[styles.summaryDivider, { backgroundColor: theme.primary + '20' }]} />

        {acLoanType === 'EMI' ? (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Monthly Installment</Text>
            <Text style={{ color: theme.primary, fontSize: fs(14), fontWeight: '800' }}>{currencySymbol}{emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Total Interest ({R}%)</Text>
            <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{currencySymbol}{totalInterest.toLocaleString()}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '800' }}>Total Payable</Text>
          <Text style={{ color: theme.primary, fontSize: fs(16), fontWeight: '900' }}>{currencySymbol}{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
        </View>

        {parseFloat(acTaxPercentage) > 0 && (
          <View style={[styles.summaryRow, { marginTop: 4 }]}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontStyle: 'italic' }}>* Includes {currencySymbol}{totalTax.toLocaleString(undefined, { maximumFractionDigits: 0 })} estimated total tax on interest</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalWrap, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
            <X size={24} color={theme.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>
            {editingId ? `Edit ${openSection?.label || 'Loan'}` : `Add ${openSection?.label || 'Loan'}`}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
          <View style={{ gap: 20 }}>
            <FormSection title="Account Setup" icon={Tag} theme={theme} fs={fs}>
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Lender/Description</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. Personal Loan" placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Loan Type</Text>
                <View style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 4 }}>
                  <TouchableOpacity 
                    style={[{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 }, acLoanType === 'EMI' && { backgroundColor: theme.primary }]}
                    onPress={() => setAcLoanType('EMI')}
                  >
                    <Text style={[{ fontSize: fs(13), fontWeight: '700' }, acLoanType === 'EMI' ? { color: 'white' } : { color: theme.textSubtle }]}>EMI Based</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[{ flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 }, acLoanType === 'ONE_TIME' && { backgroundColor: theme.primary }]}
                    onPress={() => setAcLoanType('ONE_TIME')}
                  >
                    <Text style={[{ fontSize: fs(13), fontWeight: '700' }, acLoanType === 'ONE_TIME' ? { color: 'white' } : { color: theme.textSubtle }]}>One-time Payable</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </FormSection>

            <FormSection title="Financial Details" icon={IndianRupee} theme={theme} fs={fs}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Principal Amount</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acLoanPrincipal} onChangeText={setAcLoanPrincipal}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Interest Rate (%)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acInterestRate} onChangeText={setAcInterestRate}
                  />
                </View>
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Processing Fee</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acServiceCharge} onChangeText={setAcServiceCharge}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Tax Percentage (%) on Interest</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acTaxPercentage} onChangeText={setAcTaxPercentage}
                />
              </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Disburse To Bank Account</Text>
                  <CustomDropdown
                    options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                    selectedValue={acTargetBankId}
                    onSelect={setAcTargetBankId}
                    placeholder="Select Bank (Optional)..."
                    icon={IndianRupee}
                  />
                </View>
            </FormSection>

            <FormSection title="Duration & Schedule" icon={Clock} theme={theme} fs={fs}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Duration (Months)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                    placeholder="0" placeholderTextColor={theme.placeholder}
                    keyboardType="numeric" value={acTenure} onChangeText={setAcTenure}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <DatePicker
                    label="Disbursement Date"
                    date={acDisbursementDate}
                    onChange={setAcDisbursementDate}
                  />
                </View>
                {acLoanType === 'EMI' && (
                  <View style={{ flex: 1 }}>
                    <DatePicker
                      label="First EMI Date"
                      date={acEmiStartDate}
                      onChange={setAcEmiStartDate}
                    />
                  </View>
                )}
              </View>
            </FormSection>

            {renderSummary()}

            <TouchableOpacity 
              style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} 
              onPress={handleSave}
            >
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                {editingId ? 'Update Loan' : 'Add Loan'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
