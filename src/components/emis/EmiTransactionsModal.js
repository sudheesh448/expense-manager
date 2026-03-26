import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { X, History, ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Landmark, ShieldAlert, Settings2 } from 'lucide-react-native';
import { format } from 'date-fns';
import { getTransactionsByLinkedItem } from '../../services/storage';
import { useAuth } from '../../context/AuthContext';
import { formatInTZ } from '../../utils/dateUtils';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useTheme } from '../../context/ThemeContext';

const EmiTransactionsModal = ({ visible, accountId, onClose, insets }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && accountId) {
            loadTransactions();
        }
    }, [visible, accountId]);

    const loadTransactions = async () => {
        setLoading(true);
        try {
            const txs = await getTransactionsByLinkedItem(accountId);
            setTransactions(txs);
        } catch (error) {
            console.error('Error loading EMI transactions', error);
        } finally {
            setLoading(false);
        }
    };

    const getVisuals = (tx) => {
        const type = tx.type;
        const note = tx.note || '';

        let color = '#64748b';
        let Icon = Settings2;
        let label = 'Transaction';

        if (type === 'INCOME') {
            color = '#10b981';
            Icon = ArrowDownLeft;
            label = 'Income';
        } else if (type === 'EXPENSE' || type === 'EMI_PAYMENT') {
            color = '#e11d48';
            Icon = ArrowUpRight;
            label = type === 'EMI_PAYMENT' ? 'Installment' : 'Expense';
        } else if (type === 'TRANSFER' || type === 'PAYMENT' || type === 'EMI_LIMIT_BLOCK') {
            color = '#0ea5e9';
            Icon = RefreshCw;
            label = type.replace(/_/g, ' ');
        } else if (type === 'FINE' || type === 'EMI_FINE') {
            color = '#f97316';
            Icon = ShieldAlert;
            label = 'Fine';
        } else if (type === 'EMI_LIMIT_RECOVERY') {
            color = '#10b981';
            Icon = RefreshCw;
            label = 'Limit Recovery';
        }

        return { color, Icon, label };
    };

    const renderItem = ({ item }) => {
        const { color, Icon, label } = getVisuals(item);
        const isIncome = item.type === 'INCOME' || item.type === 'EMI_LIMIT_RECOVERY';

        return (
            <View style={[styles.txRow, { borderBottomColor: theme.border + '15' }]}>
                <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                    <Icon size={16} color={color} />
                </View>
                <View style={styles.txMain}>
                    <Text style={[styles.txNote, { color: theme.text, fontSize: fs(14) }]} numberOfLines={1}>
                        {item.note || 'Untitled'}
                    </Text>
                    <View style={styles.txSub}>
                        <Text style={[styles.txLabel, { color: color, fontSize: fs(9) }]}>{label.toUpperCase()}</Text>
                        <Text style={[styles.txDate, { color: theme.textSubtle, fontSize: fs(10) }]}>
                            • {formatInTZ(item.date, activeUser?.timezone, 'MMM dd, yyyy • h:mm a')}
                        </Text>
                    </View>
                </View>
                <View style={styles.amountContainer}>
                    <Text style={[styles.txAmount, { color: isIncome ? '#10b981' : '#e11d48', fontSize: fs(15) }]}>
                        {isIncome ? '+' : '-'}{getCurrencySymbol(activeUser?.currency)}{item.amount.toLocaleString()}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, paddingBottom: 20 + insets.bottom }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <History size={20} color={theme.primary} />
                            <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Transaction History</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color={theme.text} size={24} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={transactions}
                            keyExtractor={item => item.id}
                            renderItem={renderItem}
                            contentContainerStyle={styles.listContainer}
                            ListEmptyComponent={
                                <View style={styles.emptyState}>
                                    <Text style={[styles.emptyText, { color: theme.textSubtle, fontSize: fs(14) }]}>No transactions found for this EMI.</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
    modalTitle: { fontWeight: '900' },
    closeBtn: { padding: 4 },
    listContainer: { padding: 20 },
    txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    iconContainer: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    txMain: { flex: 1 },
    txNote: { fontWeight: '700', marginBottom: 2 },
    txSub: { flexDirection: 'row', alignItems: 'center' },
    txLabel: { fontWeight: '900', letterSpacing: 0.5 },
    txDate: { marginLeft: 6 },
    amountContainer: { alignItems: 'flex-end' },
    txAmount: { fontWeight: '900' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyState: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontWeight: '600' }
});

export default EmiTransactionsModal;
