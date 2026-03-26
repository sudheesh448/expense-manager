import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useTheme } from '../../context/ThemeContext';

const EmiDetailsModal = ({ visible, selectedMonth, onClose, insets }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, paddingBottom: 40 + insets.bottom }]}>
                    <View style={[styles.modalHeaderInner, { borderBottomColor: theme.border }]}>
                        <View>
                            <Text style={[styles.modalSubtitle, { color: theme.textSubtle, fontSize: fs(10) }]}>MONTH {selectedMonth?.month}</Text>
                            <Text style={[styles.modalTitleInner, { color: theme.text, fontSize: fs(18) }]}>{selectedMonth?.date}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                            <X color={theme.text} size={24} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <View style={styles.outflowCenter}>
                            <Text style={[styles.outflowLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>TOTAL OUTFLOW</Text>
                            <Text style={[styles.outflowValue, { color: theme.text, fontSize: fs(32) }]}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.totalOutflow || 0).toFixed(2)}</Text>
                        </View>

                        <View style={styles.splitGrid}>
                            <View style={[styles.splitCard, { backgroundColor: theme.background, borderColor: '#3b82f644' }]}>
                                <Text style={[styles.splitLabel, { color: '#3b82f6', fontSize: fs(10) }]}>PRODUCT PRICE</Text>
                                <Text style={[styles.splitVal, { color: theme.text, fontSize: fs(16) }]}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.principal || 0).toFixed(2)}</Text>
                            </View>
                            <View style={[styles.splitCard, { backgroundColor: theme.background, borderColor: '#f59e0b44' }]}>
                                <Text style={[styles.splitLabel, { color: '#f59e0b', fontSize: fs(10) }]}>INTEREST</Text>
                                <Text style={[styles.splitVal, { color: theme.text, fontSize: fs(16) }]}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.interest || 0).toFixed(2)}</Text>
                            </View>
                            <View style={[styles.splitCard, { backgroundColor: theme.background, borderColor: '#6366f144' }]}>
                                <Text style={[styles.splitLabel, { color: '#6366f1', fontSize: fs(10) }]}>MONTHLY TAX</Text>
                                <Text style={[styles.splitVal, { color: theme.text, fontSize: fs(16) }]}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.tax || 0).toFixed(2)}</Text>
                            </View>
                            {selectedMonth?.serviceChargePaid > 0 && (
                                <View style={[styles.splitCard, { backgroundColor: '#ec489911', borderColor: '#ec489944' }]}>
                                    <Text style={[styles.splitLabel, { color: '#ec4899', fontSize: fs(10) }]}>SERVICE CHARGE + TAX</Text>
                                    <Text style={[styles.splitVal, { color: '#ec4899', fontSize: fs(16) }]}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.serviceChargePaid || 0).toFixed(2)}</Text>
                                </View>
                            )}
                        </View>

                        <View style={[styles.balanceFooter, { backgroundColor: theme.surfaceMuted, borderTopColor: theme.border }]}>
                            <Text style={{ color: theme.textSubtle, fontSize: fs(11), fontWeight: '800' }}>REMAINING BALANCE</Text>
                            <Text style={{ color: theme.text, fontSize: fs(16), fontWeight: '900' }}>{getCurrencySymbol(activeUser?.currency)}{(selectedMonth?.balance || 0).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32 },
    modalHeaderInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
    modalSubtitle: { fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
    modalTitleInner: { fontWeight: '900' },
    modalClose: { padding: 4 },
    modalBody: { padding: 24 },
    outflowCenter: { alignItems: 'center', marginBottom: 32 },
    outflowLabel: { fontWeight: '800', letterSpacing: 1.5, marginBottom: 12 },
    outflowValue: { fontWeight: '900' },
    splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center' },
    splitCard: { width: '47%', padding: 18, borderRadius: 20, borderWidth: 1, elevation: 1 },
    splitLabel: { fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
    splitVal: { fontWeight: '900' },
    balanceFooter: { padding: 18, borderRadius: 20, marginTop: 32, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1 }
});

export default EmiDetailsModal;
