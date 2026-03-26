import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ArrowRightLeft } from 'lucide-react-native';
import CustomDropdown from '../CustomDropdown';

export default function TypeSelector({ type, setType, lockedType, theme, transactionTypes }) {
  return (
    <View style={[styles.fieldContainer, { marginBottom: 0, alignItems: 'center' }]}>
      <View style={[styles.fieldIcon, { backgroundColor: theme.primary + '15', width: 36, height: 36, borderRadius: 12 }]}>
        <ArrowRightLeft color={theme.primary} size={20} />
      </View>
      <View style={styles.fieldContent}>
        <CustomDropdown 
          selectedValue={type}
          disabled={lockedType}
          onSelect={setType}
          containerStyle={{ marginBottom: 0 }}
          options={transactionTypes.map(t => ({ label: t.label, value: t.value }))}
          placeholder={
            type === 'EMI' ? 'EMI' : 
            type === 'PAY_UPCOMING' ? 'Upcoming' : 
            type === 'PAY_BORROWED' ? 'Pay Borrowed' :
            type === 'LEND_MONEY' ? 'Lend Money' :
            type === 'COLLECT_REPAYMENT' ? 'Collect Repay' :
            'Select Type...'
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  fieldIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
  },
});
