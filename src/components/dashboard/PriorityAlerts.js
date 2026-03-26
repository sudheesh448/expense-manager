import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { formatInTZ } from '../../utils/dateUtils';
import { getCurrencySymbol } from '../../utils/currencyUtils';

const PriorityAlerts = ({ alerts, theme, fs }) => {
  const { activeUser } = useAuth();
  if (!alerts || alerts.length === 0) return null;

  return (
    <View style={styles.alertsContainer}>
      <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18) }]}>Priority Alerts</Text>
      {alerts.map(acc => (
        <View key={acc.id} style={[styles.alertCard, { backgroundColor: theme.surface }]}>
          <AlertCircle color={acc.status.isOverdue ? theme.danger : '#f59e0b'} size={24} />
          <View style={styles.alertContent}>
            <Text style={[styles.alertText, { color: theme.text, fontSize: fs(16) }]}>
              {acc.name} is {acc.status.isOverdue ? 'Overdue!' : 'Due Soon'}
            </Text>
            <Text style={[styles.alertSub, { color: theme.textSubtle, fontSize: fs(14) }]}>
              Owe: {getCurrencySymbol(activeUser?.currency)}{acc.amountOwed.toFixed(2)} due on {formatInTZ(acc.status.currentDueDate.toISOString(), activeUser?.timezone, 'dd MMM yyyy')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  alertsContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  alertCard: { padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  alertContent: { marginLeft: 12 },
  alertText: { fontSize: 16, fontWeight: 'bold' },
  alertSub: { fontSize: 14, marginTop: 4 }
});

export default PriorityAlerts;
