import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { 
  CheckCircle, Edit2, Trash2, 
  ArrowUpCircle, PlusCircle
} from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { formatInTZ } from '../../../utils/dateUtils';
import { getLoanStats } from '../../../utils/loanUtils';
import { useNavigation } from '@react-navigation/native';

const LendedAccountCard = ({ 
  item, theme, fs, onRepay, onEdit, onDelete, onRefresh, color 
}) => {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const loan = getLoanStats(item);
  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  const isClosed = item.isClosed === 1;
  const typeColor = '#10b981'; // Dedicated green for Lended

  const getAge = (createdAt, closedAt) => {
    if (!createdAt) return 'N/A';
    const start = new Date(createdAt);
    const end = isClosed && closedAt ? new Date(closedAt) : new Date();
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
    if (months < 0) return '0m';
    
    if (isClosed) return `${months} months`;

    const years = Math.floor(months / 12);
    const m = months % 12;
    if (years > 0) return `${years}y ${m}m`;
    return `${m}m`;
  };

  return (
    <View 
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border + '20' }]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ArrowUpCircle size={18} color={typeColor} />
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
            {isClosed && (
              <View style={[styles.statusBadge, { backgroundColor: theme.success + '22' }]}>
                <Text style={{ fontSize: fs(9), fontWeight: '800', color: theme.success }}>SETTLED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: theme.textSubtle, fontSize: fs(11), marginTop: 2 }}>
            Lent on {item.startDate ? formatInTZ(item.startDate, activeUser?.timezone, 'dd MMM yyyy') : (item.loanStartDate ? formatInTZ(item.loanStartDate, activeUser?.timezone, 'dd MMM yyyy') : 'N/A')}
          </Text>
          {item.note && (
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), marginTop: 4, fontStyle: 'italic' }} numberOfLines={2}>
              {item.note}
            </Text>
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: isClosed ? theme.success : theme.primary, fontSize: fs(18) }]}>
            {currencySymbol}{(isClosed ? loan.totalPaid : loan.remainingTotal).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>{isClosed ? 'Received Total' : 'To Receive'}</Text>
        </View>
      </View>

      <View style={[styles.statsBox, { backgroundColor: theme.background + '40', borderColor: theme.border + '15' }]}>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>TOTAL LENT</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13), fontWeight: '700' }]}>
              {currencySymbol}{loan.principal_original.toLocaleString()}
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>
              {isClosed ? 'SETTLED IN' : 'AGE OF ACCOUNT'}
            </Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13), fontWeight: '700' }]}>
              {getAge(item.createdAt, item.closedAt)}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsBar}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              onPress={() => onRepay?.(item)} 
              style={[styles.btn, { backgroundColor: theme.primary + '15', opacity: isClosed ? 0.4 : 1 }]}
              disabled={isClosed}
            >
              <PlusCircle size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: fs(11), fontWeight: 'bold', marginLeft: 6 }}>Receive</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => onEdit?.(item)} 
              style={[styles.iconBtn, { opacity: isClosed ? 0.4 : 1 }]}
              disabled={isClosed}
            >
              <Edit2 size={16} color={theme.textSubtle} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.iconBtn}>
              <Trash2 size={16} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardName: { fontWeight: '900', letterSpacing: -0.5 },
  cardAmount: { fontWeight: '900', letterSpacing: -0.5 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statsBox: { padding: 12, borderRadius: 16, borderWidth: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 16 },
  statItem: { alignItems: 'center' },
  divider: { width: 1, height: 24, opacity: 0.1 },
  label: { marginBottom: 4, letterSpacing: 0.5 },
  value: { letterSpacing: -0.2 },
  actionsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  btn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  iconBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.03)' },
});

export default LendedAccountCard;
