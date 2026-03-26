import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';

export default function AmountHero({ amount, setAmount, type, theme, autoFocus = true }) {
  const { activeUser } = useAuth();
  
  const isIncome = type === 'INCOME' || type === 'COLLECT_REPAYMENT';
  const isTransfer = type === 'TRANSFER' || type === 'PAYMENT';
  const accentColor = isIncome ? theme.success : isTransfer ? '#3b82f6' : theme.danger;
  const softBg = accentColor + '08';

  return (
    <View style={[styles.amountCard, { backgroundColor: softBg, borderColor: accentColor + '20' }]}>
      <Text style={[styles.amountLabel, { color: theme.textSubtle }]}>
        {type === 'EMI' ? 'PURCHASE AMOUNT' : 'TRANSACTION AMOUNT'}
      </Text>
      <View style={styles.amountInputRow}>
        <Text style={[styles.currencySymbol, { color: accentColor }]}>{getCurrencySymbol(activeUser?.currency)}</Text>
        <TextInput 
          style={[styles.amountInput, { color: theme.text }]} 
          placeholder="0"
          placeholderTextColor={theme.placeholder}
          keyboardType="numeric"
          autoFocus={autoFocus}
          value={amount} 
          onChangeText={setAmount} 
          selectionColor={accentColor}
        />
      </View>
      <View style={[styles.indicator, { backgroundColor: accentColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  amountCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    position: 'relative',
    overflow: 'hidden',
  },
  amountLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: '300',
    marginRight: 6,
    marginTop: 2,
  },
  amountInput: {
    fontSize: 40,
    fontWeight: '800',
    padding: 0,
    minWidth: 80,
    textAlign: 'center',
    letterSpacing: -1,
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: '30%',
    right: '30%',
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    opacity: 0.5,
  }
});
