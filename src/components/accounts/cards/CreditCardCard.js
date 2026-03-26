import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { CreditCard, Edit2, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';

const CreditCardCard = ({ item, theme, fs, onEdit, onDelete, onDetails }) => {
  const { activeUser } = useAuth();
  const usage = item.balance || 0;
  const limit = item.creditLimit || 0;
  const available = Math.max(0, limit - usage);
  const usagePercent = limit > 0 ? Math.round((usage / limit) * 100) : 0;

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => onDetails?.(item)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
          </View>
          <Text style={[styles.cardSub, { color: theme.textMuted, fontSize: fs(11) }]}>
            Cycle: {item.billingDay || '--'}th · Due: {item.dueDay || '--'}th
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: theme.danger, fontSize: fs(18) }]}>
            {getCurrencySymbol(activeUser?.currency)}{usage.toLocaleString()}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>Total Usage</Text>
        </View>
      </View>

      <View style={[styles.statsBox, { backgroundColor: theme.surfaceMuted || theme.background, borderColor: theme.border }]}>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(10), fontWeight: '800' }]}>TOTAL LIMIT</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{limit.toLocaleString()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(10), fontWeight: '800' }]}>AVAILABLE</Text>
             <Text style={[styles.value, { color: theme.success, fontSize: fs(13), fontWeight: '800' }]}>{getCurrencySymbol(activeUser?.currency)}{available.toLocaleString()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(10), fontWeight: '800' }]}>USAGE %</Text>
            <Text style={[styles.value, { color: usagePercent > 80 ? theme.danger : theme.text, fontSize: fs(13), fontWeight: '800' }]}>
              {usagePercent}%
            </Text>
          </View>
        </View>

        <View style={styles.actionsBar}>
          <TouchableOpacity onPress={() => onEdit?.(item)} style={styles.actionBtn}>
            <Edit2 size={14} color={theme.textSubtle} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.actionBtn}>
            <Trash2 size={14} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'transparent', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardName: { fontWeight: '900', letterSpacing: -0.5 },
  cardSub: { marginTop: 2 },
  cardAmount: { fontWeight: '900', letterSpacing: -0.5 },
  statsBox: { padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 20, opacity: 0.2 },
  label: { marginBottom: 2 },
  value: { letterSpacing: -0.2 },
  actionsBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.02)' },
});

export default CreditCardCard;
