import {
  CheckCircle2,
  Clock,
  CreditCard,
  IndianRupee,
  Tag,
  X
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import {
  generateId, getDb, saveBankInfo,
  saveCreditCardInfo,
  saveEmi,
  saveInvestmentInfo,
  saveLoanInfo,
  saveRecurringPayment,
  saveSIPAccount,
  updateBankInfo,
  updateCreditCardInfo,
  updateEmiInfo,
  updateInvestmentInfo,
  updateLoanInfo,
  updateSIPAccount
} from '../../services/storage';
import { getAccountLabel } from '../../utils/accountUtils';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import CustomDropdown from '../CustomDropdown';
import CustomHeader from '../CustomHeader';
import DatePicker from '../DatePicker';

const FormSection = ({ title, icon: Icon, children }) => {
  const { theme, fs } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.surfaceMuted || theme.background, borderColor: theme.border }]}>
      <View style={styles.sectionHeader}>
        {Icon && <Icon size={16} color={theme.primary} style={{ marginRight: 8 }} />}
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(13) }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
};

export default function AddEditAccountModal({
  visible, editingId, accountData, openSection, accounts,
  activeUser, expenseCategories, onClose, onSuccess
}) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const isUnifiedLoan = ['LOAN', 'BORROWED', 'LENDED'].includes(openSection?.key);
  const isCcEmi = openSection?.key === 'EMI';
  const isLoanLike = isUnifiedLoan || isCcEmi;
  const [acName, setAcName] = useState('');
  const [acBalance, setAcBalance] = useState('');
  const [acSipAmount, setAcSipAmount] = useState('');
  const [billingDay, setBillingDay] = useState(1);
  const [dueDay, setDueDay] = useState(1);
  const [acCategoryId, setAcCategoryId] = useState('');
  const [acLoanPrincipal, setAcLoanPrincipal] = useState('');
  const [acInterestRate, setAcInterestRate] = useState('');
  const [acFineRate, setAcFineRate] = useState('');
  const [acTenure, setAcTenure] = useState('');
  const [acLoanStartDate, setAcLoanStartDate] = useState(new Date());
  const [acIsEmi, setAcIsEmi] = useState(false);
  const [acServiceCharge, setAcServiceCharge] = useState('');
  const [acTaxPercentage, setAcTaxPercentage] = useState('');
  const [acEmiAmount, setAcEmiAmount] = useState('');
  const [acSourceCcId, setAcSourceCcId] = useState('');
  const [acCreditLimit, setAcCreditLimit] = useState('');
  const [acIfsc, setAcIfsc] = useState('');
  const [acAccountNumber, setAcAccountNumber] = useState('');
  const [acCustomerId, setAcCustomerId] = useState('');
  const [acCardNumber, setAcCardNumber] = useState('');
  const [acCvv, setAcCvv] = useState('');
  const [acExpiry, setAcExpiry] = useState('');
  const [acStatus, setAcStatus] = useState('ACTIVE');
  const [acPausedMonths, setAcPausedMonths] = useState([]);
  const [acLoanType, setAcLoanType] = useState('ONE_TIME');
  const [acDisbursementDate, setAcDisbursementDate] = useState(new Date());
  const [acEmiStartDate, setAcEmiStartDate] = useState(new Date());
  const [acTargetBankId, setAcTargetBankId] = useState('');
  useEffect(() => {
    if (visible) {
      if (editingId && accountData) {
        setAcName(accountData.name);
        setAcBalance(accountData.balance.toString());
        setAcSipAmount(accountData.sipAmount ? accountData.sipAmount.toString() : '');
        setAcCategoryId(accountData.categoryId || '');
        setAcLoanPrincipal(accountData.productPrice ? accountData.productPrice.toString() : (accountData.loanPrincipal ? accountData.loanPrincipal.toString() : ''));
        setAcInterestRate(accountData.loanInterestRate ? accountData.loanInterestRate.toString() : '');
        setAcLoanPrincipal((accountData.productPrice || accountData.loanPrincipal || '').toString());
        setAcInterestRate((accountData.loanInterestRate || '').toString());
        setAcFineRate((accountData.loanFinePercentage || '').toString());
        setAcTenure((accountData.tenure || accountData.loanTenure || '').toString());
        setAcLoanStartDate(accountData.emiStartDate ? new Date(accountData.emiStartDate) : (accountData.loanStartDate ? new Date(accountData.loanStartDate) : new Date()));
        setAcIsEmi(accountData.isEmi === 1);
        setAcServiceCharge((accountData.processingFee || accountData.loanServiceCharge || '').toString());
        setAcTaxPercentage((accountData.loanTaxPercentage || '').toString());
        setAcEmiAmount((accountData.amount || accountData.emiAmount || '').toString());
        setBillingDay(accountData.billingDay || 1);
        setDueDay(accountData.dueDay || 1);
        setAcSourceCcId(accountData.linkedAccountId || accountData.sourceCcId || accountData.accountId || '');
        setAcCreditLimit((accountData.creditLimit || '').toString());
        setAcIfsc(accountData.ifsc || '');
        setAcAccountNumber(accountData.accountNumber || '');
        setAcCustomerId(accountData.customerId || '');
        setAcCardNumber(accountData.cardNumber || '');
        setAcCvv(accountData.cvv || '');
        setAcExpiry(accountData.expiry || '');
        setAcStatus(accountData.status || 'ACTIVE');
        setAcPausedMonths(accountData.pausedMonths || []);
        if (isCcEmi) {
          setAcSourceCcId(accountData.linkedAccountId || '');
          setAcLoanType('EMI');
        } else {
          setAcLoanType(accountData.loanType || 'ONE_TIME');
          setAcTargetBankId(''); // Not applicable for edits
        }
        setAcDisbursementDate(accountData.startDate ? new Date(accountData.startDate) : new Date());
        setAcEmiStartDate(accountData.emiStartDate ? new Date(accountData.emiStartDate) : new Date());
        setAcTargetBankId(accountData.targetAccountId || '');
      } else {
        // Reset for NEW
        setAcName(''); setAcBalance(''); setAcSipAmount('');
        setBillingDay(1); setDueDay(1);
        setAcCategoryId(''); setAcLoanPrincipal(''); setAcInterestRate('');
        setAcFineRate(''); setAcTenure(''); setAcLoanStartDate(new Date());
        setAcIsEmi(false); setAcServiceCharge(''); setAcTaxPercentage('');
        setAcEmiAmount(''); setAcSourceCcId(''); setAcCreditLimit('');
        setAcIfsc(''); setAcAccountNumber(''); setAcCustomerId('');
        setAcCardNumber(''); setAcCvv(''); setAcExpiry('');
        setAcStatus('ACTIVE'); setAcPausedMonths([]);
        setAcLoanType('ONE_TIME'); setAcDisbursementDate(new Date()); 
        setAcEmiStartDate(new Date()); setAcTargetBankId('');
      }
    }
  }, [visible, editingId, accountData]);

  const handleSave = async () => {
    if (!acName.trim()) return;
    const type = openSection?.key;
    const sipDay = billingDay;

    if (type === 'EMI' && (!acEmiAmount || parseFloat(acEmiAmount) <= 0)) {
      Alert.alert("Required Field", "Please enter the monthly EMI amount.");
      return;
    }

    if (isLoanLike && (!acTenure || parseInt(acTenure, 10) <= 0)) {
      Alert.alert("Required Field", "Tenure must be greater than 0.");
      return;
    }

    const data = {
      name: acName.trim(), type,
      balance: parseFloat(acBalance) || 0,
      billingDay: (type === 'CREDIT_CARD' || type === 'SIP' || type === 'EMI') ? sipDay : null,
      dueDay: type === 'CREDIT_CARD' ? dueDay : null,
      sipAmount: type === 'SIP' ? parseFloat(acSipAmount) || 0 : null,
      categoryId: type === 'SIP' ? acCategoryId || null : null,
      loanPrincipal: isLoanLike ? parseFloat(acLoanPrincipal) || 0 : null,
      loanInterestRate: isLoanLike ? parseFloat(acInterestRate) || 0 : null,
      loanFinePercentage: isLoanLike ? parseFloat(acFineRate) || 0 : null,
      loanTenure: isLoanLike ? parseInt(acTenure, 10) || 0 : null,
      loanStartDate: isLoanLike ? acLoanStartDate.toISOString() : null,
      loanServiceCharge: isLoanLike ? parseFloat(acServiceCharge) || 0 : null,
      loanTaxPercentage: isLoanLike ? parseFloat(acTaxPercentage) || 0 : null,
      isEmi: isLoanLike ? (type === 'EMI' ? 1 : (acIsEmi ? 1 : 0)) : 0,
      emiAmount: isLoanLike ? (type === 'EMI' ? parseFloat(acEmiAmount) || 0 : null) : null,
      creditLimit: type === 'CREDIT_CARD' ? parseFloat(acCreditLimit) || 0 : null,
      ifsc: type === 'BANK' ? acIfsc : null,
      accountNumber: type === 'BANK' ? acAccountNumber : null,
      customerId: type === 'BANK' ? acCustomerId : null,
      cardNumber: type === 'CREDIT_CARD' ? acCardNumber : null,
      cvv: type === 'CREDIT_CARD' ? acCvv : null,
      expiry: type === 'CREDIT_CARD' ? acExpiry : null,
      status: acStatus,
      userId: activeUser.id,
      pausedMonths: acPausedMonths,
      loanType: acLoanType,
      loanStartDate: isLoanLike ? acDisbursementDate.toISOString() : null,
      emiStartDate: isLoanLike && acLoanType === 'EMI' ? acEmiStartDate.toISOString() : null,
      emiAmount: isLoanLike && acLoanType === 'EMI' ? parseFloat(acEmiAmount) || 0 : null,
      loanProcessingFee: isLoanLike ? parseFloat(acServiceCharge) || 0 : 0,
      targetAccountId: !editingId && isLoanLike ? acTargetBankId : null,
    };

    let savedAcc;
    const db = await getDb();

    if (editingId) {
      if (type === 'BANK') await updateBankInfo(db, editingId, data);
      else if (type === 'CREDIT_CARD') await updateCreditCardInfo(db, editingId, data);
      else if (isUnifiedLoan) await updateLoanInfo(db, editingId, data);
      else if (isCcEmi) await updateEmiInfo(db, editingId, { ...data, accountId: acSourceCcId, billingDay: sipDay });
      else if (['INVESTMENT', 'SAVINGS'].includes(type)) await updateInvestmentInfo(db, editingId, data);
      else if (type === 'SIP') await updateSIPAccount(db, editingId, data);
      savedAcc = { id: editingId, ...data };
    } else {
      const newId = generateId();
      const payload = { ...data, userId: activeUser.id };
      if (type === 'BANK') await saveBankInfo(db, newId, payload);
      else if (type === 'CREDIT_CARD') await saveCreditCardInfo(db, newId, payload);
      else if (isUnifiedLoan) await saveLoanInfo(db, newId, payload);
      else if (isCcEmi) await saveEmi(activeUser.id, { ...payload, id: newId, accountId: acSourceCcId, emiDate: sipDay });
      else if (['INVESTMENT', 'SAVINGS'].includes(type)) await saveInvestmentInfo(db, newId, payload);
      else if (type === 'SIP') await saveSIPAccount(db, newId, payload);
      savedAcc = { id: newId, ...payload };
    }

    onSuccess();
    onClose();
  };

  const renderSummary = () => {
    if (!isLoanLike || !(acLoanPrincipal && acTenure)) return null;

    const P = parseFloat(acLoanPrincipal) || 0;
    const R = parseFloat(acInterestRate) || 0;
    const n = parseInt(acTenure, 10) || 0;
    const SC = parseFloat(acServiceCharge) || 0;
    const TX = (parseFloat(acTaxPercentage) || 0) / 100;
    const feeWithTax = SC * (1 + TX);
    
    // Logic for EMI calculation or manual override
    let emi = parseFloat(acEmiAmount) || 0;
    const r = R / 1200;
    if (emi <= 0 && acLoanType === 'EMI') {
      if (r > 0 && n > 0) {
        emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      } else if (n > 0) {
        emi = P / n;
      }
    }

    const totalInterest = acLoanType === 'EMI' ? ((emi * n) - P) : (P * (R / 100) * (n / 12));
    const totalCost = P + totalInterest + feeWithTax;
    const creditedAmount = P - SC;

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
          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{getCurrencySymbol(activeUser?.currency)}{P.toLocaleString()}</Text>
        </View>

        {SC > 0 && (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Processing Fee</Text>
            <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{getCurrencySymbol(activeUser?.currency)}{SC.toLocaleString()}</Text>
          </View>
        )}

        <View style={[styles.summaryRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: theme.border + '50', borderStyle: 'dashed' }]}>
          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '800' }}>Net Credited Amount</Text>
          <Text style={{ color: theme.primary, fontSize: fs(13), fontWeight: '800' }}>{getCurrencySymbol(activeUser?.currency)}{creditedAmount.toLocaleString()}</Text>
        </View>

        <View style={[styles.summaryDivider, { backgroundColor: theme.primary + '20' }]} />

        {acLoanType === 'EMI' ? (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Monthly Installment</Text>
            <Text style={{ color: theme.primary, fontSize: fs(14), fontWeight: '800' }}>{getCurrencySymbol(activeUser?.currency)}{emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '600' }}>Total Interest ({R}%)</Text>
            <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>{getCurrencySymbol(activeUser?.currency)}{totalInterest.toLocaleString()}</Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '800' }}>Total Payable</Text>
          <Text style={{ color: theme.primary, fontSize: fs(16), fontWeight: '900' }}>{getCurrencySymbol(activeUser?.currency)}{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalWrap, { backgroundColor: theme.background }]}>
        <CustomHeader
          title={editingId ? 'Edit Account' : `Add ${openSection?.label}`}
          leftComponent={<View style={{ width: 22 }} />}
          rightComponent={
            <TouchableOpacity onPress={onClose}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
          }
          theme={theme}
          fs={fs}
        />

        <ScrollView style={[styles.modalWrap, { backgroundColor: theme.background }]} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={{ padding: 16 }}>
            {openSection?.key === 'SIP' && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>SIP Account Name (Fund Name)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. HDFC Mid Cap Fund"
                  placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
                <View style={{ height: 16 }} />

                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Monthly SIP Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. 5000" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acSipAmount} onChangeText={setAcSipAmount}
                />


                <View style={{ height: 16 }} />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>SIP Installment Day (1-31)</Text>
                <CustomDropdown
                  options={Array.from({ length: 31 }, (_, i) => ({ label: (i + 1).toString(), value: (i + 1) }))}
                  selectedValue={billingDay}
                  onSelect={setBillingDay}
                />
                <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginTop: 4 }}>
                  {getCurrencySymbol(activeUser?.currency)}{acSipAmount || '0'} will be added to Bills every month on the {billingDay}{[1, 21, 31].includes(billingDay) ? 'st' : [2, 22].includes(billingDay) ? 'nd' : [3, 23].includes(billingDay) ? 'rd' : 'th'}.
                </Text>
                <View style={{ height: 16 }} />

                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Current Portfolio Value ({getCurrencySymbol(activeUser?.currency)})</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
              </>
            )}
            {openSection?.key !== 'CREDIT_CARD' && openSection?.key !== 'SIP' && (
              <FormSection title="Basic Information" icon={Tag} theme={theme} fs={fs}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Account Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder={
                    openSection?.key === 'BANK' ? 'e.g. HDFC Savings' :
                      openSection?.key === 'LOAN' ? 'e.g. Home Loan' :
                        openSection?.key === 'EMI' ? 'e.g. iPhone 15 EMI' : 'e.g. Mutual Fund'
                  }
                  placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
              </FormSection>
            )}

            <View style={{ height: 16 }} />

            {openSection?.key === 'CREDIT_CARD' && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Account Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="e.g. SBI SimplySave"
                  placeholderTextColor={theme.placeholder}
                  value={acName} onChangeText={setAcName}
                />
                <View style={{ height: 16 }} />

                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Actual Credit Limit ({getCurrencySymbol(activeUser?.currency)})</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acCreditLimit} onChangeText={setAcCreditLimit}
                />
                <View style={{ height: 16 }} />

                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Current Usage / Outstanding ({getCurrencySymbol(activeUser?.currency)})</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />
                <View style={{ height: 16 }} />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1.5 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Card Number</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="XXXX XXXX XXXX 1234" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acCardNumber} onChangeText={setAcCardNumber}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Expiry (MM/YY)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="12/28" placeholderTextColor={theme.placeholder}
                      value={acExpiry} onChangeText={setAcExpiry}
                    />
                  </View>
                </View>

                <View style={{ height: 16 }} />
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>CVV</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="123" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" secureTextEntry value={acCvv} onChangeText={setAcCvv}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Billing Cycle Day (1-31)</Text>
                    <CustomDropdown
                      options={Array.from({ length: 31 }, (_, i) => ({ label: (i + 1).toString(), value: (i + 1) }))}
                      selectedValue={billingDay}
                      onSelect={setBillingDay}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Payment Due Day (1-31)</Text>
                    <CustomDropdown
                      options={Array.from({ length: 31 }, (_, i) => ({ label: (i + 1).toString(), value: (i + 1) }))}
                      selectedValue={dueDay}
                      onSelect={setDueDay}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>
                </View>
              </View>
            )}

            {!(openSection?.key === 'LOAN' || openSection?.key === 'BORROWED' || openSection?.key === 'LENDED' || openSection?.key === 'EMI' || openSection?.key === 'CREDIT_CARD' || openSection?.key === 'SIP') && (
              <>
                <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>
                  {openSection?.key === 'INVESTMENT' ? `Current Value (${getCurrencySymbol(activeUser?.currency)})` : `Balance (${getCurrencySymbol(activeUser?.currency)})`}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                  placeholder="0.00" placeholderTextColor={theme.placeholder}
                  keyboardType="numeric" value={acBalance} onChangeText={setAcBalance}
                />

                {openSection?.key === 'BANK' && (
                  <View style={{ marginTop: 16 }}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>IFSC Code</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="e.g. SBIN0001234" placeholderTextColor={theme.placeholder}
                      value={acIfsc} onChangeText={setAcIfsc}
                    />
                    <View style={{ height: 12 }} />
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Account Number</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="e.g. 100023456789" placeholderTextColor={theme.placeholder}
                      keyboardType="numeric" value={acAccountNumber} onChangeText={setAcAccountNumber}
                    />
                    <View style={{ height: 12 }} />
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Customer ID</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                      placeholder="e.g. 98765432" placeholderTextColor={theme.placeholder}
                      value={acCustomerId} onChangeText={setAcCustomerId}
                    />
                  </View>
                )}
              </>
            )}


            {(openSection?.key === 'LOAN' || openSection?.key === 'BORROWED' || openSection?.key === 'LENDED' || openSection?.key === 'EMI') && (
              <View style={{ gap: 16 }}>

                <FormSection title="Financial Details" icon={IndianRupee} theme={theme} fs={fs}>
                  {isUnifiedLoan && (
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
                  )}

                  {isCcEmi && (
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
                  )}

                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>
                        {acLoanType === 'EMI' ? 'Principal / Product Price' : 'Principal Amount'}
                      </Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                        placeholder="0.00" placeholderTextColor={theme.placeholder}
                        keyboardType="numeric" value={acLoanPrincipal} onChangeText={setAcLoanPrincipal}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Interest Rate (% p.a.)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                        placeholder="0.00" placeholderTextColor={theme.placeholder}
                        keyboardType="numeric" value={acInterestRate} onChangeText={setAcInterestRate}
                      />
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Processing Fee</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                        placeholder="0" placeholderTextColor={theme.placeholder}
                        keyboardType="numeric" value={acServiceCharge} onChangeText={setAcServiceCharge}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Fine Percentage (%)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                        placeholder="0" placeholderTextColor={theme.placeholder}
                        keyboardType="numeric" value={acFineRate} onChangeText={setAcFineRate}
                      />
                    </View>
                  </View>

                  {!editingId && isUnifiedLoan && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Disburse To Bank Account</Text>
                      <CustomDropdown
                        options={(() => {
                          const banks = (accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }));
                          return [{ label: 'Manual Tracking Only', value: '' }, ...banks];
                        })()}
                        selectedValue={acTargetBankId}
                        onSelect={setAcTargetBankId}
                        placeholder="Select Bank Account..."
                        icon={IndianRupee}
                      />
                      <Text style={{ color: theme.textSubtle, fontSize: fs(11), marginTop: 4 }}>
                        {acTargetBankId ? `A credit transaction for ${(parseFloat(acLoanPrincipal) || 0) - (parseFloat(acServiceCharge) || 0)} will be added to this bank.` : 'No automatic bank credit will be created.'}
                      </Text>
                    </View>
                  )}

                  {openSection?.key === 'EMI' && (
                    <View style={{ marginTop: 12 }}>
                      <CustomDropdown
                        label="Linked Credit Card"
                        options={(() => {
                          const baseOptions = (accounts || [])
                            .filter(a => a.type === 'CREDIT_CARD' || a.id === acSourceCcId)
                            .map(a => ({
                              label: getAccountLabel(a, accounts, getCurrencySymbol(activeUser?.currency)),
                              value: a.id,
                              accountType: a.type
                            }));
                          return baseOptions;
                        })()}
                        selectedValue={acSourceCcId}
                        onSelect={setAcSourceCcId}
                        placeholder="Select Credit Card (Optional)..."
                        icon={CreditCard}
                        disabled={!!editingId}
                      />
                    </View>
                  )}
                </FormSection>

                <FormSection title="Tenure & Schedule" icon={Clock} theme={theme} fs={fs}>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Tenure (Months)</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                        placeholder="0" placeholderTextColor={theme.placeholder}
                        keyboardType="numeric" value={acTenure} onChangeText={setAcTenure}
                      />
                    </View>
                    {(acLoanType === 'EMI' || openSection?.key === 'EMI') && (
                      <View style={{ flex: 1.5 }}>
                        <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(12) }]}>Manual EMI Amount</Text>
                        <TextInput
                          style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(14) }]}
                          placeholder="Calculated automatically if empty" placeholderTextColor={theme.placeholder}
                          keyboardType="numeric" value={acEmiAmount} onChangeText={setAcEmiAmount}
                        />
                      </View>
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <DatePicker
                        label={isCcEmi ? "Purchase Date" : "Loan Taken Date"}
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
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: openSection?.color || theme.primary }]} onPress={handleSave}>
              <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>{editingId ? 'Update' : 'Add Account'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  modalTitle: { fontWeight: '800', letterSpacing: -0.5 },
  section: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  fieldLabel: { fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: { height: 48, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 32, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  saveBtnText: { color: 'white', fontWeight: '800', letterSpacing: 1 },
  premiumSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  summaryCard: { marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryDivider: { height: 1.5, marginVertical: 12, borderRadius: 1 },
});
