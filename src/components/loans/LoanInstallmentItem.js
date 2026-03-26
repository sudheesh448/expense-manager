import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, ArrowUpRight, ArrowDownLeft, Landmark } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';

const LoanInstallmentItem = ({ item, isPaid, isPast, isCurrent, finePaid, onSettle, onFine, onDetails, theme, fs, type }) => {
    const { activeUser } = useAuth();
    
    const isLended = type === 'LENDED';
    const isBorrowed = type === 'BORROWED';
    const typeColor = isLended ? '#10b981' : (isBorrowed ? '#f59e0b' : theme.primary);
    
    let statusColor = '#0ea5e9'; // Upcoming
    let statusText = 'Upcoming';
    let StatusIcon = Clock;

    if (item.isForeclosure || item.isForeclosed) {
        statusColor = theme.textSubtle;
        statusText = 'Settled';
        StatusIcon = ShieldCheck;
    } else if (isPaid) {
        statusColor = '#10b981';
        statusText = 'Paid';
        StatusIcon = CheckCircle2;
    } else if (!isPaid && isPast) {
        statusColor = '#ef4444';
        statusText = 'Overdue';
        StatusIcon = AlertTriangle;
    } else if (!isPaid && isCurrent) {
        statusColor = typeColor;
        statusText = 'Due Now';
        StatusIcon = Clock;
    }

    return (
        <View style={[
            styles.loanCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
            isPaid && { backgroundColor: theme.surfaceMuted, opacity: 0.85 }
        ]}>
            <View style={styles.cardMain}>
                <View style={styles.leftSection}>
                    <View style={[styles.monthCircle, { backgroundColor: statusColor }]}>
                        <Text style={{ color: '#FFF', fontSize: fs(10), fontWeight: '900' }}>{item.month}</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                        <Text style={[styles.cardDate, { color: theme.text, fontSize: fs(13) }]}>{item.date}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '10' }]}>
                            <StatusIcon size={8} color={statusColor} />
                            <Text style={{ color: statusColor, fontSize: fs(8), fontWeight: '800', textTransform: 'uppercase' }}>{statusText}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.rightSection}>
                    {!isPaid && !item.isForeclosed && !item.isForeclosure && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {(isPast || isCurrent) && (
                                <TouchableOpacity
                                    style={[styles.settlePill, { backgroundColor: typeColor, marginRight: 10 }]}
                                    onPress={() => onSettle(item)}
                                >
                                    <Text style={{ color: '#FFF', fontSize: fs(9), fontWeight: '800' }}>SETTLE</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                    <TouchableOpacity 
                        style={{ alignItems: 'flex-end' }}
                        onPress={() => onDetails(item)}
                    >
                        <Text style={[styles.cardAmount, { color: theme.text, fontSize: fs(15) }]}>{getCurrencySymbol(activeUser?.currency)}{(item.totalOutflow || 0).toFixed(0)}</Text>
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <Text style={{ color: '#8b5cf6', fontSize: fs(8), fontWeight: '700' }}>INT: {getCurrencySymbol(activeUser?.currency)}{(item.interest || 0).toFixed(0)}</Text>
                            <View style={{ width: 1, height: 8, backgroundColor: theme.border, opacity: 0.5 }} />
                            <Text style={{ color: theme.textSubtle, fontSize: fs(8), fontWeight: '700' }}>BAL: {getCurrencySymbol(activeUser?.currency)}{(item.balance || 0).toFixed(0)}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    loanCard: {
        marginHorizontal: 12,
        marginVertical: 4,
        padding: 10,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    cardMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    monthCircle: { 
        width: 26, 
        height: 26, 
        borderRadius: 13, 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    cardDate: { fontWeight: '800', letterSpacing: 0.2 },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        marginTop: 2,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardAmount: { fontWeight: '900', letterSpacing: -0.3 },
    settlePill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default LoanInstallmentItem;
