import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const PrincipalProgressBar = ({ principal_original, principal_current, theme, fs, currencySymbol }) => {
  if (!principal_original) return null;

  const currentP = principal_current || 0;
  const paidPrincipal = Math.max(0, principal_original - currentP);
  const totalP = principal_original || 1; // Guard against divide by zero
  const paidPercent = (paidPrincipal / totalP) * 100;
  const unpaidPercent = 100 - paidPercent;

  return (
    <View style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9) }]}>PRINCIPAL REPAYMENT</Text>
        <Text style={{ color: theme.text, fontSize: fs(9), fontWeight: 'bold' }}>
          {paidPercent.toFixed(0)}% PAID
        </Text>
      </View>
      
      <View style={[styles.barContainer, { backgroundColor: theme.border + '22' }]}>
        {paidPercent > 0 && (
          <View style={[styles.paidBar, { width: `${paidPercent}%`, backgroundColor: theme.success }]} />
        )}
        {unpaidPercent > 0 && (
          <View style={[styles.unpaidBar, { width: `${unpaidPercent}%`, backgroundColor: theme.danger + 'bb' }]} />
        )}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.success }]} />
          <Text style={{ color: theme.textSubtle, fontSize: fs(8) }}>Paid: {currencySymbol}{Math.round(paidPrincipal).toLocaleString()}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.danger + 'bb' }]} />
          <Text style={{ color: theme.textSubtle, fontSize: fs(8) }}>Pending: {currencySymbol}{Math.round(currentP).toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    width: '100%',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  barContainer: {
    height: 12,
    borderRadius: 6,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  paidBar: {
    height: '100%',
  },
  unpaidBar: {
    height: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  }
});

export default PrincipalProgressBar;
