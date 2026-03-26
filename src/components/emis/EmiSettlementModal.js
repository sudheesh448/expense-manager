import React from 'react';
import { View, Text, StyleSheet, Modal, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Info } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import { useTheme } from '../../context/ThemeContext';

const EmiSettlementModal = ({ visible, selectedEmi, accounts, settleAccountId, onSelectAccount, onConfirm, onClose }) => {
    const { theme, fs } = useTheme();
    const { activeUser } = useAuth();
    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
            <TouchableOpacity 
                style={styles.modalOverlay} 
                activeOpacity={1} 
                onPress={onClose}
            >
                <View style={[styles.pickerSheet, { backgroundColor: theme.surface }]}>
                    <View style={styles.headerIndicator} />
                    <View style={styles.modalHeaderInnerAlt}>
                        <View>
                            <Text style={[styles.modalTitleInner, { color: theme.text, fontSize: fs(16) }]}>Confirm Payment</Text>
                            <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600', textTransform: 'uppercase' }}>Month {selectedEmi?.month} Installment</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.border + '50' }]}>
                             <X color={theme.text} size={18} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
                        <View style={[styles.amountHero, { backgroundColor: theme.primary + '08', borderColor: theme.primary + '20' }]}>
                             <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '800' }}>TOTAL OUTFLOW</Text>
                             <Text style={{ color: theme.primary, fontSize: fs(22), fontWeight: '900' }}>{getCurrencySymbol(activeUser?.currency)}{selectedEmi?.totalOutflow?.toLocaleString()}</Text>
                        </View>

                        <Text style={[styles.modalSubtitle, { color: theme.textMuted, fontSize: fs(10), marginTop: 16 }]}>PAY FROM ACCOUNT</Text>

                        <View style={{ maxHeight: 300 }}>
                            <FlatList
                                data={accounts.filter(a => a.type === 'BANK' || a.type === 'SAVINGS')}
                                keyExtractor={(item) => item.id.toString()}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingVertical: 8 }}
                                renderItem={({ item: acc }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.accountOption,
                                            { 
                                                backgroundColor: theme.surfaceMuted, 
                                                borderColor: settleAccountId === acc.id ? theme.primary : theme.border,
                                                borderWidth: settleAccountId === acc.id ? 2 : 1
                                            }
                                        ]}
                                        onPress={() => onSelectAccount(acc.id)}
                                    >
                                        <View style={[styles.accIconBox, { backgroundColor: settleAccountId === acc.id ? theme.primary : theme.textMuted + '22' }]}>
                                            <Text style={{ color: '#FFF', fontSize: fs(10), fontWeight: '900' }}>{acc.name[0]}</Text>
                                        </View>
                                         <View style={{ flex: 1 }}>
                                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: fs(13) }}>{acc.name}</Text>
                                            <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>Bal: {getCurrencySymbol(activeUser?.currency)}{acc.balance.toLocaleString()}</Text>
                                        </View>
                                        {settleAccountId === acc.id && (
                                            <View style={[styles.checkIndicator, { backgroundColor: theme.primary }]}>
                                                <Text style={{ color: '#FFF', fontSize: fs(8) }}>✓</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                )}
                            />
                        </View>

                         <TouchableOpacity
                            style={[styles.settleActionBtn, { backgroundColor: theme.primary, marginTop: 16 }]}
                            onPress={onConfirm}
                        >
                            <Text style={{ color: '#fff', fontWeight: '900', fontSize: fs(16), letterSpacing: 1 }}>CONFIRM PAYMENT</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    pickerSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: 12, elevation: 25 },
    headerIndicator: { width: 36, height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, alignSelf: 'center', marginTop: 10 },
    modalHeaderInnerAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16 },
    modalTitleInner: { fontWeight: '900', letterSpacing: -0.5 },
    closeBtn: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    modalSubtitle: { fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    amountHero: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', gap: 2 },
    accountOption: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, marginBottom: 6, gap: 10 },
    accIconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    checkIndicator: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
    catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    settleActionBtn: { padding: 14, borderRadius: 16, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
});

export default EmiSettlementModal;
