import { Calendar as CalendarIcon, CheckCircle, Edit2, Trash2 } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';
import { getLoanStats } from '../../../utils/accountUtils';
import { getCurrencySymbol } from '../../../utils/currencyUtils';
import { formatInTZ } from '../../../utils/dateUtils';
import { calculateAmortizationSchedule } from '../../../utils/emiUtils';

const EmiAccountCard = ({ item, theme, fs, onDetails, onCalendar, onForeclose, onAddEmi, onEdit, onDelete, color }) => {
  const loan = getLoanStats(item);
  const schedule = calculateAmortizationSchedule(item);
  const scheduleLength = schedule.length;

  const { activeUser } = useAuth();
  const now = new Date().toISOString();
  const currentMonthKey = formatInTZ(now, activeUser?.timezone, 'yyyy-MM');
  const regularSchedule = schedule.filter(i => typeof i.month === 'number');
  const completedCount = regularSchedule.filter(i => i.isCompleted || i.isForeclosed).length;
  const progressPercent = scheduleLength > 0 ? Math.round((completedCount / scheduleLength) * 100) : 0;

  const currencySymbol = getCurrencySymbol(activeUser?.currency);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => onDetails?.(item)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: loan.isEmi ? '#3b82f622' : '#f59e0b22' }]}>
              <Text style={{ fontSize: fs(9), fontWeight: '800', color: loan.isEmi ? '#3b82f6' : '#f59e0b' }}>
                {loan.isEmi ? 'EMI' : 'ONE-TIME'}
              </Text>
            </View>
            {item.isClosed === 1 && (
              <View style={[styles.statusBadge, { backgroundColor: '#10b98122' }]}>
                <Text style={{ fontSize: fs(9), fontWeight: '800', color: '#10b981' }}>CLOSED</Text>
              </View>
            )}
          </View>
          {item.linkedAccountName && (
            <Text style={[styles.cardSub, { color: theme.primary, fontSize: fs(11), fontWeight: '600' }]}>
              💳 {item.linkedAccountName}
            </Text>
          )}
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
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>PRINCIPAL</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13) }]}>{currencySymbol}{loan.principal_original.toLocaleString()}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>TOTAL PAYABLE</Text>
            <Text style={[styles.value, { color: theme.text, fontSize: fs(13) }]}>{currencySymbol}{loan.originalTotalPayable.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>{loan.isEmi ? 'MONTHLY EMI' : 'LUMP SUM'}</Text>
            <Text style={[styles.value, { color: color || theme.primary, fontSize: fs(13), fontWeight: '800' }]}>
              {currencySymbol}{loan.emi.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </View>
        </View>

        {/* Secondary Stats */}
        <View style={[styles.statsGrid, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border + '15' }]}>
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>PAID TOTAL</Text>
            <Text style={[styles.value, { color: theme.success, fontSize: fs(13), fontWeight: '800' }]}>
              {currencySymbol}{loan.totalPaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(9), fontWeight: '800' }]}>EXTRA COST</Text>
            <Text style={[styles.value, { color: theme.danger, fontSize: fs(13), fontWeight: '800' }]}>
              {currencySymbol}{loan.extraCost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({loan.extraPercentage.toFixed(0)}%)
            </Text>
          </View>
        </View>

        {/* Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity onPress={() => onCalendar?.(item)} style={styles.actionBtn}>
            <CalendarIcon size={14} color={theme.primary} />
            <Text style={[styles.actionText, { color: theme.primary, fontSize: fs(10) }]}>Schedule</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => item.isClosed === 1 ? null : onForeclose?.(item)}
            style={[styles.actionBtn, item.isClosed === 1 && { opacity: 0.5 }]}
            disabled={item.isClosed === 1}
          >
            <CheckCircle size={14} color={item.isClosed === 1 ? theme.textMuted : theme.success} />
            <Text style={[styles.actionText, { color: item.isClosed === 1 ? theme.textMuted : theme.success, fontSize: fs(10) }]}>Foreclose</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => (item.isClosed === 1 || completedCount > 0) ? null : onEdit?.(item)}
            style={[styles.actionBtn, (item.isClosed === 1 || completedCount > 0) && { opacity: 0.3 }]}
            disabled={item.isClosed === 1 || completedCount > 0}
          >
            <Edit2 size={14} color={(item.isClosed === 1 || completedCount > 0) ? theme.textMuted : theme.textSubtle} />
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
  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  statsBox: { padding: 12, borderRadius: 16, borderWidth: 1, marginTop: 4 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  divider: { width: 1, height: 20, opacity: 0.2 },
  label: { marginBottom: 2 },
  value: { letterSpacing: -0.2 },
  actionsBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.02)' },
  actionText: { fontWeight: '700' },
});

export default EmiAccountCard;
