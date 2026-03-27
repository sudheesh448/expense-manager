import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  X, TrendingUp, TrendingDown, CheckCircle2, Circle, Trash2, PlusCircle, CreditCard, ChevronRight, Check, ArrowUpRight
} from 'lucide-react-native';
import CustomHeader from '../CustomHeader';

const { width, height } = Dimensions.get('window');

/**
 * MonthDetailModal: Standardized detail view for a specific month's forecast.
 * Shows Scheduled Income vs Scheduled Expenses in a tabbed interface.
 */
export default function MonthDetailModal({ 
  visible, onClose, month, theme, fs, activeUser, getCurrencySymbol, 
  onDelete, onSaveItem 
}) {
  const [activeDetailTab, setActiveDetailTab] = useState('EXPENSE');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [expName, setExpName] = useState('');
  const [expAmount, setExpAmount] = useState('');

  if (!month) return null;

  const handleSave = () => {
    if (!expName || !expAmount) return;
    onSaveItem(month.monthKey, expName, Number(expAmount), activeDetailTab);
    setExpName('');
    setExpAmount('');
    setIsAddingItem(false);
  };

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1 }}>
          <CustomHeader
            title={month.label}
            subtitle="Monthly Forecast Details"
            leftComponent={
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X size={24} color={theme.text} />
              </TouchableOpacity>
            }
            theme={theme}
            fs={fs}
            containerStyle={{ paddingTop: 12 }}
          />

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            {/* Quick Summary Cards */}
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: theme.success + '10', borderColor: theme.success + '30' }]}>
                <Text style={{ color: theme.success, fontSize: fs(10), fontWeight: 'bold' }}>INCOME</Text>
                <Text style={{ color: theme.success, fontSize: fs(16), fontWeight: 'bold' }}>
                  {getCurrencySymbol(activeUser?.currency)}{month.expectedIncome.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '30' }]}>
                <Text style={{ color: theme.danger, fontSize: fs(10), fontWeight: 'bold' }}>EXPENSE</Text>
                <Text style={{ color: theme.danger, fontSize: fs(16), fontWeight: 'bold' }}>
                  {getCurrencySymbol(activeUser?.currency)}{month.expectedDue.toFixed(0)}
                </Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '30' }]}>
                <Text style={{ color: theme.primary, fontSize: fs(10), fontWeight: 'bold' }}>INVEST</Text>
                <Text style={{ color: theme.primary, fontSize: fs(16), fontWeight: 'bold' }}>
                  {getCurrencySymbol(activeUser?.currency)}{(month.totalInvestments || 0).toFixed(0)}
                </Text>
              </View>
            </View>

            {/* Tab Switcher */}
            <View style={[styles.tabRow, { backgroundColor: theme.surface }]}>
              {[['Income', 'INCOME', theme.success], ['Expenses', 'EXPENSE', theme.danger], ['Invest', 'SIP_PAY', theme.primary]].map(([lbl, val, col]) => (
                <TouchableOpacity
                  key={val}
                  onPress={() => {
                    setActiveDetailTab(val);
                    setIsAddingItem(false); // Reset form on tab change
                  }}
                  style={[
                    styles.tab, 
                    activeDetailTab === val && { borderBottomColor: col, borderBottomWidth: 3 }
                  ]}
                >
                  <Text style={[
                    styles.tabText, 
                    { color: activeDetailTab === val ? theme.text : theme.textSubtle, fontSize: fs(13) },
                    activeDetailTab === val && { fontWeight: '800' }
                  ]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* List Table */}
            <View style={styles.tableBlock}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                {isAddingItem ? (
                  <View style={[styles.addForm, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <TextInput 
                      style={[styles.input, { color: theme.text, flex: 2 }]} 
                      placeholder="Name" placeholderTextColor={theme.textSubtle}
                      value={expName} onChangeText={setExpName}
                    />
                    <TextInput 
                      style={[styles.input, { color: theme.text, flex: 1.2 }]} 
                      placeholder="Amount" placeholderTextColor={theme.textSubtle}
                      keyboardType="numeric" value={expAmount} onChangeText={setExpAmount}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleSave}>
                        <Check size={18} color="white" />
                      </TouchableOpacity>
                      <TouchableOpacity style={{ marginLeft: 12 }} onPress={() => setIsAddingItem(false)}>
                        <X size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={[styles.quickAdd, { backgroundColor: theme.primary + '10' }]} onPress={() => setIsAddingItem(true)}>
                    <PlusCircle size={16} color={theme.primary} />
                    <Text style={{ color: theme.primary, fontSize: fs(13), fontWeight: '700', marginLeft: 8 }}>
                      Add One-off {activeDetailTab === 'INCOME' ? 'Income' : 'Expense'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ padding: 16 }}>
                {(activeDetailTab === 'INCOME' 
                  ? month.expectedDetails.filter(d => d.type === 'INCOME') 
                  : activeDetailTab === 'SIP_PAY'
                  ? (month.investmentDetails || [])
                  : [...(month.budgetDetails || []), ...month.expectedDetails.filter(d => d.type !== 'INCOME')]
                ).map((item, i) => (
                  <View key={item.id || i} style={[styles.lineItem, item.isDone && styles.lineItemDone, { borderBottomColor: theme.border + '30' }]}>
                    <View style={[styles.checkRow, { flex: 1 }]}>
                      {item.type === 'SIP_PAY' ? (
                        item.isDone ? <CheckCircle2 size={20} color={theme.success} /> : <ArrowUpRight size={20} color={theme.primary} />
                      ) : (
                        item.isBudget ? <CheckCircle2 size={20} color={theme.primary} /> :
                        item.isDone ? <CheckCircle2 size={20} color={theme.success} /> : 
                        item.isCoveredByBudget ? <CheckCircle2 size={20} color={theme.primary} /> :
                        <Circle size={20} color={theme.textMuted} />
                      )}
                      <View style={{ marginLeft: 12, flex: 1, paddingRight: 8 }}>
                        <Text numberOfLines={1} style={[styles.lineName, { color: theme.text, fontSize: fs(14) }, item.isDone && { textDecorationLine: 'line-through', color: theme.textSubtle }]}>
                          {item.name}
                        </Text>
                        {item.isCoveredByBudget && <Text style={{ color: theme.textMuted, fontSize: fs(9), fontWeight: '600' }}>ABSORBED BY BUDGET</Text>}
                        {item.isBudget && <Text style={{ color: theme.primary, fontSize: fs(9), fontWeight: '700' }}>CATEGORY BUDGET</Text>}
                      </View>
                    </View>
                    <View style={styles.checkRow}>
                      <Text style={[styles.lineVal, { color: theme.text, fontSize: fs(14), fontWeight: '600' }]}>
                        {getCurrencySymbol(activeUser?.currency)}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </Text>
                      {!item.isDone && !item.isBudget && (
                        <TouchableOpacity 
                          onPress={() => onDelete(item.id)} 
                          style={{ marginLeft: 12, opacity: (item.linkedAccountId || (item.name && item.name.startsWith('EMI:'))) ? 0.3 : 1 }}
                          disabled={!!(item.linkedAccountId || (item.name && item.name.startsWith('EMI:')))}
                        >
                          <Trash2 size={18} color={theme.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
                
                {(activeDetailTab === 'INCOME' 
                   ? month.expectedDetails.filter(d => d.type === 'INCOME') 
                   : [...(month.budgetDetails || []), ...month.expectedDetails.filter(d => d.type !== 'INCOME')]
                ).length === 0 && (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: theme.textMuted, fontSize: fs(14) }}>No items scheduled</Text>
                  </View>
                )}
              </View>
            </View>

            {/* CC Section */}
            <View style={[styles.ccSection, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} color="#8b5cf6" />
                  <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold' }}>Credit Card Summary</Text>
                </View>
                <View style={{ backgroundColor: '#8b5cf615', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                   <Text style={{ color: "#8b5cf6", fontSize: fs(14), fontWeight: '800' }}>
                     {getCurrencySymbol(activeUser?.currency)}{month.creditCardDue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                   </Text>
                </View>
              </View>
              
              {month.ccDetails.length > 0 ? (
                month.ccDetails.map((cc, i) => (
                  <View key={i} style={styles.ccRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                       <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.textMuted }} />
                       <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontWeight: '500' }}>{cc.name}</Text>
                    </View>
                    <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '700' }}>
                      {getCurrencySymbol(activeUser?.currency)}{cc.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ color: theme.textMuted, fontSize: fs(11), fontStyle: 'italic', textAlign: 'center', marginTop: 4 }}>
                   No active credit card dues for this cycle.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: height * 0.85, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '800' },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.05)', padding: 8, borderRadius: 12 },
  
  summaryRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  summaryCard: { flex: 1, padding: 18, borderRadius: 24, borderWidth: 1 },
  
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 10, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  tab: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontWeight: '700' },
  
  tableBlock: { flex: 1 },
  quickAdd: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, justifyContent: 'center', marginHorizontal: 4 },
  addForm: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, borderWidth: 1, marginHorizontal: 4 },
  input: { paddingHorizontal: 12, height: 44, fontSize: 14 },
  saveBtn: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  lineItemDone: { opacity: 0.4 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  lineName: { fontWeight: '700' },
  
  ccSection: { padding: 24, paddingBottom: 40, borderTopWidth: 1 },
  ccRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' },
});
