import { format, parseISO } from 'date-fns';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Calendar,
    Pause,
    Pencil,
    Play,
    RefreshCw,
    StopCircle,
    Trash2
} from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function RecurringCard({
    item, theme, fs, recurringStats,
    onPause, onStop, onRestart, onDelete, onEdit
}) {
    const isStopped = item.status === 'STOPPED';
    const isPaused = item.status === 'PAUSED';
    const isIncome = item.type === 'INCOME';
    const color = isIncome ? theme.success : theme.danger;
    const stats = recurringStats ? recurringStats[item.name] : null;

    const nextDate = item.nextDueDate ? format(parseISO(item.nextDueDate), 'dd MMM yyyy') : 'N/A';

    return (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.header}>
                <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
                    {isIncome ? <ArrowUpRight color={color} size={18} /> : <ArrowDownLeft color={color} size={18} />}
                </View>
                <View style={styles.titleInfo}>
                    <Text style={[styles.name, { color: theme.text, fontSize: fs(15) }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.subText, { color: theme.textSubtle, fontSize: fs(11) }]}>
                        {item.isStandalone
                            ? `One-time: ${item.monthKey}`
                            : (item.scheduleType === 'FIXED' ? `Fixed: Day ${item.anchorDay}` : `Every ${item.cycleDays} days`)}
                    </Text>
                </View>
                <View style={styles.amountBox}>
                    <Text style={[styles.amount, { color: theme.text, fontSize: fs(16) }]}>
                        {isIncome ? '+' : '-'}{item.amount?.toLocaleString()}
                    </Text>
                    <View style={[styles.statusBadge, {
                        backgroundColor: isStopped ? theme.border : (isPaused ? '#f59e0b20' : theme.primarySubtle),
                        borderColor: isStopped ? theme.border : (isPaused ? '#f59e0b40' : theme.primary + '30')
                    }]}>
                        <Text style={[styles.statusText, {
                            color: isStopped ? theme.textSubtle : (isPaused ? '#f59e0b' : theme.primary),
                            fontSize: fs(8)
                        }]}>
                            {item.status || 'ACTIVE'}
                        </Text>
                    </View>
                </View>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.1 }]} />

            <View style={styles.content}>
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Calendar size={12} color={theme.textMuted} style={{ marginRight: 4 }} />
                        <Text style={[styles.metaText, { color: theme.textSubtle, fontSize: fs(11) }]}>Next: {nextDate}</Text>
                    </View>
                    {stats && (
                        <View style={styles.metaItem}>
                            <RefreshCw size={12} color={theme.textMuted} style={{ marginRight: 4 }} />
                            <Text style={[styles.metaText, { color: theme.textSubtle, fontSize: fs(11) }]}>{stats.timesTotal} payments</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.footer}>
                <View style={styles.actions}>
                    {!isStopped && (
                        <>
                            {isPaused ? (
                                <TouchableOpacity style={styles.actionBtn} onPress={() => onRestart(item)}>
                                    <Play size={16} color={theme.success} />
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity style={styles.actionBtn} onPress={() => onPause(item)}>
                                    <Pause size={16} color={theme.primary} />
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                    {!isStopped && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => onStop(item)}>
                            <StopCircle size={16} color={theme.textMuted} />
                        </TouchableOpacity>
                    )}
                    {isStopped && (
                        <TouchableOpacity style={styles.actionBtn} onPress={() => onRestart(item)}>
                            <RefreshCw size={16} color={theme.primary} />
                        </TouchableOpacity>
                    )}
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
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    titleInfo: { flex: 1 },
    name: { fontWeight: '700', marginBottom: 2 },
    subText: { fontWeight: '500' },
    amountBox: { alignItems: 'flex-end' },
    amount: { fontWeight: '800', marginBottom: 4 },
    statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    statusText: { fontWeight: 'bold', letterSpacing: 0.5 },
    divider: { height: 1, marginVertical: 12 },
    content: { marginBottom: 16 },
    metaRow: { flexDirection: 'row', gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center' },
    metaText: { fontWeight: '500' },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    actions: { flexDirection: 'row', gap: 12 },
    actionBtn: { padding: 4 },
    editBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }
});
