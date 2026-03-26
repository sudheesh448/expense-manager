import { IndianRupee, Landmark } from 'lucide-react-native';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useAuth } from '../../context/AuthContext';
import CustomDropdown from '../CustomDropdown';

const LoanSettlementModal = ({ visible, selectedEmi, accounts, settleAccountId, onSelectAccount, onConfirm, onClose }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();

    if (!selectedEmi) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <View style={[styles.modalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <View style={styles.modalHeader}>
                        <Landmark size={24} color={theme.primary} />
                        <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Settle Installment</Text>
                    </View>

                    <View style={[styles.amountBox, { backgroundColor: theme.primary + '11' }]}>
                        <Text style={[styles.amountLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>PAYING FOR {selectedEmi.monthKey}</Text>
                        <Text style={[styles.amountValue, { color: theme.primary, fontSize: fs(24) }]}>
                            {getCurrencySymbol(activeUser?.currency)}{selectedEmi.totalOutflow.toFixed(2)}
                        </Text>
                    </View>

                    <View style={{ marginTop: 20 }}>
                        <Text style={[styles.fieldLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>SOURCE ACCOUNT</Text>
                        <CustomDropdown
                            options={(accounts || []).filter(a => a.type === 'BANK').map(a => ({ label: a.name, value: a.id }))}
                            selectedValue={settleAccountId}
                            onSelect={onSelectAccount}
                            placeholder="Select Source Account..."
                            icon={Landmark}
                        />
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity onPress={onClose} style={[styles.actionBtn, { backgroundColor: theme.border + '44' }]}>
                            <Text style={[styles.actionBtnText, { color: theme.text, fontSize: fs(14) }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onConfirm} style={[styles.actionBtn, { backgroundColor: theme.primary }]}>
                            <Text style={[styles.actionBtnText, { color: 'white', fontSize: fs(14) }]}>Confirm Payment</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 24, padding: 20, borderWidth: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    modalTitle: { fontWeight: '900', letterSpacing: 0.5 },
    amountBox: { padding: 15, borderRadius: 16, alignItems: 'center' },
    amountLabel: { fontWeight: '800', marginBottom: 4 },
    amountValue: { fontWeight: '900' },
    fieldLabel: { fontWeight: '800', marginBottom: 8, marginLeft: 4 },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    actionBtn: { flex: 1, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    actionBtnText: { fontWeight: '800' },
});

export default LoanSettlementModal;
