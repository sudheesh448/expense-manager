import { CalendarClock, Calendar as CalendarIcon, CheckCircle, CreditCard, Info, Percent, Wallet, ChevronDown, ChevronUp, History, ShieldCheck } from 'lucide-react-native';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { StyleSheet, Text, View, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { getLoanStats } from '../../utils/accountUtils';
import { calculateTotalPayable, calculateRemainingPayable, calculateExtraCost, calculateExtraPercentage } from '../../utils/emiUtils';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EmiSummaryCard = ({ account, totals, schedule = [], scheduleLength, theme, fs, onViewTransactions }) => {
    const [expanded, setExpanded] = useState(false);
    const { activeUser } = useAuth();
    const regularSchedule = schedule.filter(i => typeof i.month === 'number');
    const paidAmount = Number(account.totalPaid || 0);
    const paidCount = regularSchedule.filter(i => i.isCompleted).length;
    const completedCount = regularSchedule.filter(i => i.isCompleted || i.isForeclosed).length;
    const progressPercent = scheduleLength > 0 ? Math.round((completedCount / scheduleLength) * 100) : 0;

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    return (
        <View style={styles.headerContainer}>
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={toggleExpand}
                style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
                <View style={styles.topRow}>
                    <TouchableOpacity 
                        onPress={(e) => { e.stopPropagation(); onViewTransactions(); }} 
                        style={[styles.headerIconBtn, { backgroundColor: theme.surfaceMuted || theme.border + '15' }]}
                    >
                        <History size={16} color={theme.primary} />
                    </TouchableOpacity>

                    <View style={styles.titleContainer}>
                        <Text style={[styles.headerName, { color: theme.textSubtle, fontSize: fs(11) }]}>
                            {account.name.toUpperCase()}
                        </Text>
                    </View>

                    <View style={{ minWidth: 32, alignItems: 'flex-end', justifyContent: 'center' }}>
                        {account.linkedAccountName && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.primary + '11', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}>
                                <CreditCard size={12} color={theme.primary} />
                                <Text style={{ color: theme.primary, fontSize: fs(9), fontWeight: '800' }}>
                                    {account.linkedAccountName.toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.heroRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.heroLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>
                            {account.isClosed === 1 ? 'SETTLED TOTAL' : 'TOTAL PAYABLE'}
                        </Text>
                        <Text style={[styles.heroValue, { color: account.isClosed === 1 ? theme.success : theme.danger, fontSize: fs(24) }]}>
                           {getCurrencySymbol(activeUser?.currency)}{calculateTotalPayable(account).toFixed(0)}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        <Text style={[styles.heroLabel, { color: theme.success, fontSize: fs(10), fontWeight: '800' }]}>TOTAL PAID</Text>
                        <Text style={[styles.heroValue, { color: theme.success, fontSize: fs(20) }]}>{getCurrencySymbol(activeUser?.currency)}{(paidAmount || 0).toFixed(0)}</Text>
                    </View>
                </View>


                {expanded && (
                    <View style={styles.statsGrid}>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.primary + '11' }]}>
                                <Wallet size={14} color={theme.primary} />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>PRODUCT PRICE</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{(account.productPrice || account.loanPrincipal || 0).toLocaleString()}</Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf611' }]}>
                                <Info size={14} color="#8b5cf6" />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: '#8b5cf6', fontSize: fs(9) }]}>EXTRA COST</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{calculateExtraCost(account).toFixed(0)}</Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf611' }]}>
                                <Percent size={14} color="#8b5cf6" />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>EXTRA %</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>
                                    {calculateExtraPercentage(account).toFixed(1)}%
                                </Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: '#f59e0b11' }]}>
                                <CalendarIcon size={14} color="#f59e0b" />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>TENURE</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>{scheduleLength} Mo</Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: '#f43f5e11' }]}>
                                <CreditCard size={14} color="#f43f5e" />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>REMAINING</Text>
                                <Text style={[styles.statValue, { color: theme.danger, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{calculateRemainingPayable(account).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: '#6366f111' }]}>
                                <CalendarClock size={14} color="#6366f1" />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>START DATE</Text>
                                <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>
                                    {new Date(account.emiStartDate || account.loanStartDate).toLocaleDateString('default', { month: 'short', day: '2-digit', year: 'numeric' })}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.statGroup}>
                            <View style={[styles.iconContainer, { backgroundColor: theme.success + '11' }]}>
                                <CheckCircle size={14} color={theme.success} />
                            </View>
                            <View>
                                <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>TOTAL PAID</Text>
                                <Text style={[styles.statValue, { color: theme.success, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{(paidAmount || 0).toFixed(0)}</Text>
                            </View>
                        </View>
                        {account.isClosed === 1 && (account.closureAmount > 0 || account.loanClosureAmount > 0) && (
                            <View style={styles.statGroup}>
                                <View style={[styles.iconContainer, { backgroundColor: '#8b5cf611' }]}>
                                    <ShieldCheck size={14} color="#8b5cf6" />
                                </View>
                                <View>
                                    <Text style={[styles.statLabel, { color: '#8b5cf6', fontSize: fs(9) }]}>FORECLOSURE</Text>
                                    <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{(account.closureAmount || account.loanClosureAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text>
                                </View>
                            </View>
                        )}
                        {account.processingFee > 0 && (
                            <View style={styles.statGroup}>
                                <View style={[styles.iconContainer, { backgroundColor: '#8b5cf611' }]}>
                                    <Percent size={14} color="#8b5cf6" />
                                </View>
                                <View>
                                    <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>PROCESSING FEE</Text>
                                    <Text style={[styles.statValue, { color: theme.text, fontSize: fs(13) }]}>{getCurrencySymbol(activeUser?.currency)}{account.processingFee.toLocaleString()}</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Granular Progress Graph */}
                <View style={{ marginTop: expanded ? 20 : 10, marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={[styles.statLabel, { color: theme.textSubtle, fontSize: fs(10), fontWeight: '800' }]}>REPAYMENT PROGRESS</Text>
                        <Text style={{ color: account.isClosed === 1 ? theme.success : theme.primary, fontWeight: '900', fontSize: fs(expanded ? 12 : 14) }}>
                            {account.isClosed === 1 ? '100%' : `${progressPercent}%`}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', height: expanded ? 8 : 16, gap: 2 }}>
                        {regularSchedule.map((row, i) => {
                            let bgColor = theme.border + '33';
                            const now = new Date();
                            const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                            
                            if (row.isCompleted) bgColor = theme.success;
                            else if (row.isForeclosed) bgColor = theme.textSubtle + '66';
                            else if (row.monthKey < currentMonthKey) bgColor = theme.danger;
                            else if (row.monthKey === currentMonthKey) bgColor = theme.primary;

                            return (
                                <View key={i} style={{ flex: 1, backgroundColor: bgColor, borderRadius: 4, height: '100%' }} />
                            );
                        })}
                    </View>
                    {!expanded && (
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                            <Text style={{ color: theme.textSubtle, fontSize: fs(11), fontWeight: '700' }}>{account.isClosed === 1 ? (paidCount === scheduleLength ? 'Fully Paid' : 'Settled Early') : `${paidCount}/${scheduleLength} Months Paid`}</Text>
                            <Text style={{ color: theme.primary, fontSize: fs(10), fontWeight: '800' }}>Tap for details</Text>
                        </View>
                    )}
                    {expanded && (
                        <>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                                <Text style={{ color: theme.textSubtle, fontSize: fs(9), fontWeight: '700' }}>{paidCount} PAID</Text>
                                <Text style={{ color: theme.textSubtle, fontSize: fs(9), fontWeight: '700' }}>{account.isClosed === 1 ? `${scheduleLength - paidCount} FORECLOSED` : `${scheduleLength - paidCount} REMAINING`}</Text>
                            </View>
                        </>
                    )}
                </View>
            </TouchableOpacity>

            <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(15) }]}>Repayment Timeline</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.textSubtle, fontSize: fs(11) }]}>{scheduleLength} Installments</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    headerContainer: { padding: 12, paddingBottom: 0 },
    summaryCard: {
        padding: 12,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 8,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    heroRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    titleContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: -1,
    },
    titleContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: -1,
    },
    headerName: {
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    headerIconBtn: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroLabel: { fontWeight: '800', marginBottom: 2, letterSpacing: 1 },
    heroValue: { fontWeight: '900', letterSpacing: -0.5 },
    heroBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 16,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
        marginBottom: 8,
    },
    statGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '48%',
    },
    iconContainer: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statLabel: { fontWeight: '800', letterSpacing: 0.5, marginBottom: 1 },
    statValue: { fontWeight: '900' },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 4,
        marginBottom: 8,
        marginTop: 10
    },
    sectionTitle: { fontWeight: '900', letterSpacing: 0.5 },
    sectionSubtitle: { fontWeight: '700' },
    historyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
    },
    historyBtnText: {
        fontWeight: '900',
        letterSpacing: 1,
    }
});

export default EmiSummaryCard;
