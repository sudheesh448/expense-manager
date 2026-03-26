import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { 
  Calendar as CalendarIcon, CheckCircle, Wallet, Edit2, Trash2, 
  ArrowUpCircle, ArrowDownCircle, PlusCircle, AlertCircle 
} from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { formatInTZ } from '../../../utils/dateUtils';
import { calculateAmortizationSchedule, getLoanStats } from '../../../utils/loanUtils';

import PrincipalProgressBar from './PrincipalProgressBar';

import { useNavigation } from '@react-navigation/native';
import LoanActionModal from '../../loans/LoanActionModal';
import { recordPrincipalPrepayment, recordLoanFine } from '../../../services/storage/loanStorage';
import { getDb } from '../../../services/storage/utils';

const LoanAccountCard = ({ item, theme, fs, onDetails, onCalendar, onForeclose, onEdit, onDelete, onRefresh, accounts, color }) => {
  const navigation = useNavigation();
  const [showActionModal, setShowActionModal] = React.useState(false);
  const [actionMode, setActionMode] = React.useState('PREPAYMENT'); // 'PREPAYMENT' or 'FINE'
  const loan = getLoanStats(item);
  const schedule = calculateAmortizationSchedule(item);
  const scheduleLength = schedule.length;
  
  const { activeUser } = useAuth();
  const now = new Date().toISOString();
  const currentMonthKey = formatInTZ(now, activeUser?.timezone, 'yyyy-MM');
  const regularSchedule = schedule.filter(i => typeof i.month === 'number');
  const completedCount = regularSchedule.filter(i => i.isCompleted || i.isForeclosed).length;
  const progressPercent = scheduleLength > 0 ? Math.round((completedCount / scheduleLength) * 100) : 0;

  const handleActionConfirm = async (mode, amount, bankId) => {
    try {
      const db = await getDb();
      if (mode === 'PREPAYMENT') {
        await recordPrincipalPrepayment(db, item.id, bankId, amount, activeUser.id);
      } else {
        await recordLoanFine(db, item.id, bankId, amount, activeUser.id);
      }
      setShowActionModal(false);
      onRefresh?.();
    } catch (e) {
      alert(e.message);
    }
  };

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  // Determine icon based on loan subtype
  let TypeIcon = Wallet;
  let typeLabel = item.type;
  let typeColor = '#f59e0b'; // Amber for loans

  if (item.type === 'BORROWED') {
    TypeIcon = ArrowDownCircle;
    typeColor = '#ef4444'; // Red for borrowed (liability)
  } else if (item.type === 'LENDED') {
    TypeIcon = ArrowUpCircle;
    typeColor = '#10b981'; // Green for lended (asset)
  }

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => navigation.navigate('LoanDetails', { accountId: item.id })}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TypeIcon size={18} color={typeColor} />
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: typeColor + '22' }]}>
              <Text style={{ fontSize: fs(9), fontWeight: '800', color: typeColor }}>
                {typeLabel} {loan.isEmi ? '(EMI)' : '(ONE-TIME)'}
              </Text>
            </View>
            {item.isClosed === 1 && (
              <View style={[styles.statusBadge, { backgroundColor: '#10b98122' }]}>
                <Text style={{ fontSize: fs(9), fontWeight: '800', color: '#10b981' }}>CLOSED</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: (item.isClosed === 1 ? theme.success : theme.danger), fontSize: fs(18) }]}>
            {currencySymbol}{loan.remainingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>{item.isClosed === 1 ? 'Settled Total' : 'Remaining'}</Text>
        </View>
      </View>

      <View style={[styles.statsBox, { backgroundColor: theme.surfaceMuted || theme.background, borderColor: theme.border }]}>
        {/* Repayment Progress Bar (Only for EMI or if more than 1 installment) */}
        {loan.isEmi && scheduleLength > 0 && (
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800', letterSpacing: 0.5 }]}>REPAYMENT PROGRESS</Text>
              <Text style={{ color: item.isClosed === 1 ? theme.success : theme.primary, fontWeight: '900', fontSize: fs(10) }}>
                {item.isClosed === 1 ? 'SETTLED' : `${completedCount}/${scheduleLength} (${progressPercent}%)`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', height: 8, gap: 2 }}>
              {regularSchedule.map((row, i) => {
                let bgColor = theme.border + '33';
                if (row.isCompleted) bgColor = theme.success;
                else if (row.isForeclosed) bgColor = theme.textSubtle + '66';
                else if (row.monthKey < currentMonthKey) bgColor = theme.danger;
                else if (row.monthKey === currentMonthKey) bgColor = theme.primary;

                return (
                  <View 
                    key={i} 
                    style={{ 
                      flex: 1, 
                      backgroundColor: bgColor, 
                      borderRadius: 4,
                      height: '100%'
                    }} 
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Primary Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>ACTUAL PRINCIPAL</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(12) }]}>{currencySymbol}{loan.principal_original.toLocaleString()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>TOTAL PAYABLE</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(12) }]}>{currencySymbol}{loan.originalTotalPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>RATE (%)</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(12), fontWeight: '800' }]}>{loan.rate}%</Text>
          </View>
        </View>

        <View style={[styles.statsGrid, { marginTop: 10, borderTopWidth: 1, borderTopColor: theme.border + '11', paddingTop: 10 }]}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: '#8b5cf6', fontSize: fs(8), fontWeight: '800' }]}>EXTRA COST (INT)</Text>
            <Text style={[styles.value, { color: '#8b5cf6', fontSize: fs(12), fontWeight: '800' }]}>{currencySymbol}{loan.extraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>
              {loan.isEmi ? 'TENURE' : 'COMPLETION'}
            </Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(12) }]}>
              {loan.isEmi ? `${scheduleLength} Mo` : (schedule[schedule.length - 1]?.date || 'N/A')}
            </Text>
          </View>
          {loan.isEmi && (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>COMPLETION</Text>
                <Text style={[styles.value, { color: theme.text, fontSize: fs(11) }]}>
                  {schedule[schedule.length - 1]?.date || 'N/A'}
                </Text>
              </View>
            </>
          )}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }]}>{loan.isEmi ? 'MONTHLY EMI' : 'LUMP SUM'}</Text>
            <Text style={[styles.value, { color: color || typeColor, fontSize: fs(12), fontWeight: '900' }]}>
              {currencySymbol}{loan.emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>
        
        {/* Principal Lifecycle Progress Bar */}
        <PrincipalProgressBar 
          principal_original={loan.principal_original} 
          principal_current={loan.principal}
          theme={theme} 
          fs={fs} 
          currencySymbol={currencySymbol}
        />

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity 
            onPress={() => { setActionMode('PREPAYMENT'); setShowActionModal(true); }} 
            style={[styles.actionIconBtn, item.isClosed === 1 && { opacity: 0.5 }]}
            disabled={item.isClosed === 1}
          >
            <PlusCircle size={16} color={theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => { setActionMode('FINE'); setShowActionModal(true); }} 
            style={[styles.actionIconBtn, item.isClosed === 1 && { opacity: 0.5 }]}
            disabled={item.isClosed === 1}
          >
            <AlertCircle size={16} color="#f59e0b" />
          </TouchableOpacity>

          {loan.isEmi && (
            <TouchableOpacity onPress={() => onCalendar?.(item)} style={styles.actionIconBtn}>
              <CalendarIcon size={16} color={theme.primary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            onPress={() => item.isClosed === 1 ? null : onForeclose?.(item)} 
            style={[styles.actionIconBtn, item.isClosed === 1 && { opacity: 0.5 }]}
            disabled={item.isClosed === 1}
          >
            <CheckCircle size={16} color={item.isClosed === 1 ? theme.textMuted : theme.success} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => (item.isClosed === 1 || completedCount > 0) ? null : onEdit?.(item)} 
            style={[styles.actionIconBtn, (item.isClosed === 1 || completedCount > 0) && { opacity: 0.3 }]}
            disabled={item.isClosed === 1 || completedCount > 0}
          >
            <Edit2 size={16} color={(item.isClosed === 1 || completedCount > 0) ? theme.textMuted : theme.textSubtle} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.actionIconBtn}>
            <Trash2 size={16} color={theme.danger} />
          </TouchableOpacity>
        </View>
      </View>
      <LoanActionModal
        visible={showActionModal}
        mode={actionMode}
        account={item}
        accounts={accounts}
        theme={theme}
        fs={fs}
        onClose={() => setShowActionModal(false)}
        onConfirm={handleActionConfirm}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'transparent', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardName: { fontWeight: '900', letterSpacing: -0.5 },
  cardAmount: { fontWeight: '900', letterSpacing: -0.5 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statsBox: { padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 20, opacity: 0.2 },
  label: { marginBottom: 2 },
  value: { letterSpacing: -0.2 },
  actionsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  actionIconBtn: { padding: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.02)', justifyContent: 'center', alignItems: 'center' },
});

export default LoanAccountCard;
