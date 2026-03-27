import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { 
  CheckCircle, Wallet, Edit2, Trash2, 
  ArrowDownCircle, PlusCircle, Calendar as CalendarIcon
} from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { formatInTZ } from '../../../utils/dateUtils';
import { getLoanStats } from '../../../utils/loanUtils';
import { useNavigation } from '@react-navigation/native';

const BorrowedAccountCard = ({ 
  item, theme, fs, onRepay, onForeclose, onEdit, onDelete, onRefresh, color 
}) => {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const loan = getLoanStats(item);
  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  const isClosed = item.isClosed === 1;
  const typeColor = '#ef4444'; // Dedicated red for Borrowed

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border + '20' }]}
      onPress={() => navigation.navigate('LoanDetails', { accountId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ArrowDownCircle size={18} color={typeColor} />
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
            {isClosed && (
              <View style={[styles.statusBadge, { backgroundColor: theme.success + '22' }]}>
                <Text style={{ fontSize: fs(9), fontWeight: '800', color: theme.success }}>CLOSED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: theme.textSubtle, fontSize: fs(11), marginTop: 2 }}>
            Taken on {item.startDate ? formatInTZ(item.startDate, activeUser?.timezone, 'dd MMM yyyy') : 'N/A'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: isClosed ? theme.success : theme.danger, fontSize: fs(18) }]}>
            {currencySymbol}{loan.remainingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>{isClosed ? 'Paid Back' : 'Remaining'}</Text>
        </View>
      </View>

      <View style={[styles.statsBox, { backgroundColor: theme.background + '40', borderColor: theme.border + '15' }]}>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>TOTAL BORROWED</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13), fontWeight: '700' }]}>
              {currencySymbol}{loan.principal_original.toLocaleString()}
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>INTEREST RATE</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13), fontWeight: '700' }]}>
              {loan.rate}%
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsBar}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity 
              onPress={() => onRepay?.(item)} 
              style={[styles.btn, { backgroundColor: theme.primary + '15' }]}
              disabled={isClosed}
            >
              <PlusCircle size={14} color={theme.primary} />
              <Text style={{ color: theme.primary, fontSize: fs(11), fontWeight: 'bold', marginLeft: 6 }}>Repay</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => onForeclose?.(item)} 
              style={[styles.btn, { backgroundColor: theme.success + '15' }]}
              disabled={isClosed}
            >
              <CheckCircle size={14} color={theme.success} />
              <Text style={{ color: theme.success, fontSize: fs(11), fontWeight: 'bold', marginLeft: 6 }}>Foreclose</Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => onDetails?.(item)} style={styles.iconBtn}>
               <CalendarIcon size={16} color={theme.textSubtle} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onEdit?.(item)} style={styles.iconBtn}>
              <Edit2 size={16} color={theme.textSubtle} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.iconBtn}>
              <Trash2 size={16} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
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

export default BorrowedAccountCard;
