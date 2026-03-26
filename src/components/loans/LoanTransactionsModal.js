import { History, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';
import { getTransactionsByLinkedItem } from '../../services/storage';

const LoanTransactionsModal = ({ visible, accountId, onClose, insets }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible && accountId) {
            setLoading(true);
            getTransactionsByLinkedItem(accountId)
                .then(setTransactions)
                .finally(() => setLoading(false));
        }
    }, [visible, accountId]);

    const renderItem = ({ item }) => (
        <View style={[styles.txItem, { borderBottomColor: theme.border + '33' }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.txNote, { color: theme.text, fontSize: fs(13) }]}>{item.note || 'Loan Payment'}</Text>
                <Text style={[styles.txDate, { color: theme.textSubtle, fontSize: fs(11) }]}>{new Date(item.date).toLocaleDateString()}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.txAmount, { color: item.type === 'INCOME' ? theme.success : theme.danger, fontSize: fs(14) }]}>
                    {item.type === 'INCOME' ? '+' : '-'}{getCurrencySymbol(activeUser?.currency)}{item.amount.toFixed(0)}
                </Text>
                <Text style={[styles.txType, { color: theme.textSubtle, fontSize: fs(9) }]}>{item.type}</Text>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 20 }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <History size={20} color={theme.primary} />
                            <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Transaction History</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.border + '44' }]}>
                            <X size={20} color={theme.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loaderContainer}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={transactions}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: 20 }}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={{ color: theme.textSubtle, fontSize: fs(14) }}>No transactions found for this loan.</Text>
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
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '70%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalTitle: { fontWeight: '900' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    txItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
    txNote: { fontWeight: '700', marginBottom: 2 },
    txDate: { fontWeight: '600' },
    txAmount: { fontWeight: '900' },
    txType: { fontWeight: '800', letterSpacing: 0.5 },
    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
});

export default LoanTransactionsModal;
