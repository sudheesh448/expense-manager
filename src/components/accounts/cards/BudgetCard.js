import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Target, Trash2, Layers, Pencil } from 'lucide-react-native';

export default function BudgetCard({ item, categories, theme, fs, onDelete, onEdit }) {
  const linkedCategories = (categories || [])
    .filter(c => (item.categoryIds || []).includes(c.id))
    .map(c => c.name)
    .join(', ');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
            <Target color={theme.primary} size={20} />
        </View>
        <View style={styles.titleInfo}>
          <Text style={[styles.name, { color: theme.text, fontSize: fs(15) }]} numberOfLines={1}>{item.name}</Text>
          <Text style={[styles.subText, { color: theme.textSubtle, fontSize: fs(11) }]}>
            Amount Locked
          </Text>
        </View>
        <View style={styles.amountBox}>
          <Text style={[styles.limitLabel, { color: theme.textMuted, fontSize: fs(10) }]}>MONTHLY LIMIT</Text>
          <Text style={[styles.amount, { color: theme.text, fontSize: fs(18) }]}>
             ₹{item.amount?.toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.1 }]} />

      <View style={styles.content}>
          <View style={styles.metaRow}>
              <Layers size={14} color={theme.textMuted} style={{ marginRight: 6, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                  <Text style={[styles.metaLabel, { color: theme.textMuted, fontSize: fs(11) }]}>LINKED CATEGORIES</Text>
                  <Text style={[styles.metaText, { color: theme.textSubtle, fontSize: fs(12) }]} numberOfLines={2}>
                      {linkedCategories || 'None'}
                  </Text>
              </View>
          </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statusBox}>
            <View style={[styles.dot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.statusText, { color: theme.textSubtle, fontSize: fs(11) }]}>Monitoring Active</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
                <Pencil size={16} color={theme.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => onDelete(item)}>
                <Trash2 size={16} color={theme.danger} />
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  titleInfo: { flex: 1 },
  name: { fontWeight: '700', marginBottom: 2 },
  subText: { fontWeight: '600', opacity: 0.8 },
  amountBox: { alignItems: 'flex-end' },
  limitLabel: { fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  amount: { fontWeight: '900' },
  divider: { height: 1, marginVertical: 12 },
  content: { marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start' },
  metaLabel: { fontWeight: '800', marginBottom: 2 },
  metaText: { fontWeight: '500', lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  statusBox: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontWeight: '600' },
  deleteBtn: { padding: 4 }
});
