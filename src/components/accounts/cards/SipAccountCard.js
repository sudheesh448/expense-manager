import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { BarChart2, Trash2, Calendar, Pause, Play, StopCircle, RefreshCw, Pencil } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { setSIPStatus } from '../../../services/storage/sipStorage';
import { getDb } from '../../../services/storage/utils';

const SipAccountCard = ({ item, theme, fs, onEdit, onDelete, onRefresh, onPauseMonth }) => {
  const { activeUser } = useAuth();
  const currency = getCurrencySymbol(activeUser?.currency);

  const totalInvested = item.balance || item.totalPaid || 0;
  const currentVal = item.sipCurrentValue || item.balance || totalInvested;
  const returns = currentVal - totalInvested;
  const returnPerc = totalInvested > 0 ? (returns / totalInvested) * 100 : 0;
  
  const status = item.status || 'ACTIVE';
  const isStopped = status === 'STOPPED';

  const handleStatusChange = async (newStatus) => {
    try {
      const db = await getDb();
      await setSIPStatus(db, item.id, newStatus);
      onRefresh?.();
    } catch (error) {
      Alert.alert('Error', 'Failed to update SIP status');
    }
  };

  const getStatusConfig = () => {
    switch(status) {
      case 'PAUSED': return { color: '#f59e0b', label: 'PAUSED', icon: Pause };
      case 'STOPPED': return { color: theme.danger, label: 'STOPPED', icon: StopCircle };
      default: return { color: theme.success, label: 'ACTIVE', icon: Play };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.surface }]}
      onLongPress={() => onEdit?.(item)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.iconBox, { backgroundColor: isStopped ? theme.danger + '15' : '#06b6d4' + '15' }]}>
            <BarChart2 size={18} color={isStopped ? theme.danger : "#06b6d4"} />
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
                <Text style={{ color: statusConfig.color, fontSize: fs(8), fontWeight: '800' }}>{statusConfig.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Calendar size={10} color={theme.textSubtle} />
              <Text style={[styles.cardSub, { color: theme.textSubtle, fontSize: fs(10) }]}>
                Next: {item.billingDay || '--'}th of month
              </Text>
            </View>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: theme.text, fontSize: fs(18) }]}>
            {currency}{currentVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600' }}>Current Value</Text>
        </View>
      </View>

      <View style={[styles.statsRow, { borderColor: theme.border + '30' }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: fs(9) }]}>INVESTED</Text>
          <Text style={[styles.statValue, { color: theme.text, fontSize: fs(12) }]}>{currency}{totalInvested.toLocaleString()}</Text>
        </View>
        <View style={[styles.statItem, { alignItems: 'center' }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: fs(9) }]}>INSTALLMENT</Text>
          <Text style={[styles.statValue, { color: '#06b6d4', fontSize: fs(12) }]}>{currency}{item.sipAmount?.toLocaleString()}</Text>
        </View>
        <View style={[styles.statItem, { alignItems: 'flex-end' }]}>
          <Text style={[styles.statLabel, { color: theme.textMuted, fontSize: fs(9) }]}>RETURNS</Text>
          <Text style={[styles.statValue, { color: returns >= 0 ? theme.success : theme.danger, fontSize: fs(12) }]}>
            {returns >= 0 ? '+' : ''}{currency}{Math.abs(returns).toLocaleString()} ({returnPerc.toFixed(1)}%)
          </Text>
        </View>
      </View>

      <View style={styles.actionsBar}>
        <View style={styles.actionsLeft}>
          {!isStopped && (
            <>
              {status === 'PAUSED' ? (
                <TouchableOpacity onPress={() => handleStatusChange('ACTIVE')} style={styles.actionIconBtn}>
                  <Play size={16} color={theme.success} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => onPauseMonth?.(item)} style={styles.actionIconBtn}>
                  <Pause size={16} color={theme.primary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleStatusChange('STOPPED')} style={styles.actionIconBtn}>
                <StopCircle size={16} color={theme.textMuted} />
              </TouchableOpacity>
            </>
          )}
          {isStopped && (
            <TouchableOpacity onPress={() => handleStatusChange('ACTIVE')} style={styles.actionIconBtn}>
              <RefreshCw size={16} color={theme.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actionsRight}>
          <TouchableOpacity onPress={() => onEdit?.(item)} style={styles.actionIconBtn}>
            <Pencil size={16} color={theme.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.actionIconBtn}>
            <Trash2 size={16} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 24, marginBottom: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.02)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontWeight: '900', letterSpacing: -0.5 },
  cardSub: { fontWeight: '600', textTransform: 'uppercase' },
  cardAmount: { fontWeight: '900', letterSpacing: -0.8 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1 },
  statItem: { flex: 1 },
  statLabel: { fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  statValue: { fontWeight: '900' },
  actionsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionsLeft: { flexDirection: 'row', gap: 16 },
  actionsRight: { flexDirection: 'row', gap: 16 },
  actionIconBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
});

export default SipAccountCard;
