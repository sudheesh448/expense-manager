import { Calendar, IndianRupee, Info, Percent, Wallet, Clock, CheckCircle2 } from 'lucide-react-native';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';

const LoanDetailsModal = ({ visible, selectedMonth, onClose, insets }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();

    if (!selectedMonth) return null;

    const DetailRow = ({ icon: Icon, label, value, color }) => (
        <View style={[styles.detailRow, { borderBottomColor: theme.border + '33' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[styles.iconBox, { backgroundColor: (color || theme.primary) + '15' }]}>
                    <Icon size={14} color={color || theme.primary} />
                </View>
                <Text style={[styles.detailLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>{label}</Text>
            </View>
            <Text style={[styles.detailValue, { color: theme.text, fontSize: fs(14) }]}>{value}</Text>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 20 }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                        <View>
                            <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Installment Details</Text>
                            <Text style={[styles.modalSubtitle, { color: theme.textSubtle, fontSize: fs(12) }]}>Month {selectedMonth.month} • {selectedMonth.date}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.border + '44' }]}>
                            <Text style={{ color: theme.text, fontWeight: '900' }}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={{ padding: 20 }}>
                        <View style={[styles.amountCard, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '22' }]}>
                            <Text style={[styles.amountLabel, { color: theme.primary, fontSize: fs(11) }]}>TOTAL INSTALLMENT</Text>
                            <Text style={[styles.amountValue, { color: theme.primary, fontSize: fs(32) }]}>
                                {getCurrencySymbol(activeUser?.currency)}{selectedMonth.totalOutflow.toFixed(2)}
                            </Text>
                        </View>

                        <View style={{ marginTop: 10 }}>
                            <DetailRow icon={Wallet} label="Principal Portion" value={`${getCurrencySymbol(activeUser?.currency)}${selectedMonth.principal.toFixed(2)}`} />
                            <DetailRow icon={Percent} label="Interest Portion" value={`${getCurrencySymbol(activeUser?.currency)}${selectedMonth.interest.toFixed(2)}`} color="#8b5cf6" />
                            <DetailRow icon={Clock} label="Remaining Balance" value={`${getCurrencySymbol(activeUser?.currency)}${selectedMonth.balance.toFixed(2)}`} color="#f59e0b" />
                            <DetailRow icon={CheckCircle2} label="Status" value={selectedMonth.isCompleted ? 'PAID' : 'PENDING'} color={selectedMonth.isCompleted ? theme.success : theme.primary} />
                        </View>

                        <View style={[styles.infoBox, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                            <Info size={14} color={theme.textSubtle} />
                            <Text style={[styles.infoText, { color: theme.textSubtle, fontSize: fs(11) }]}>
                                This breakdown is estimated based on the standard amortization formula.
                            </Text>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, maxHeight: '80%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1 },
    modalTitle: { fontWeight: '900', letterSpacing: 0.5 },
    modalSubtitle: { fontWeight: '700', marginTop: 2 },
    closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    amountCard: { padding: 24, borderRadius: 20, alignItems: 'center', borderWidth: 1, marginBottom: 20 },
    amountLabel: { fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
    amountValue: { fontWeight: '900', letterSpacing: -1 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
    iconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    detailLabel: { fontWeight: '700' },
    detailValue: { fontWeight: '800' },
    infoBox: { padding: 12, borderRadius: 12, flexDirection: 'row', gap: 8, marginTop: 20, borderWidth: 1, alignItems: 'center' },
    infoText: { flex: 1, fontWeight: '600', lineHeight: 16 },
});

export default LoanDetailsModal;
