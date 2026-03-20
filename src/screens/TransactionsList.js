import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, ScrollView, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { X, Search, Pencil, Trash2, Settings2 } from 'lucide-react-native';
import { getTransactions, getCategories, getAllAccountsForLookup, deleteTransaction, updateTransaction } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CustomDropdown from '../components/CustomDropdown';
import { format } from 'date-fns';

export default function TransactionsList({ navigation }) {
  const { activeUser } = useAuth();
  const { theme, fs } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  const [filterType, setFilterType] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');


  const [accounts, setAccounts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(20);
  const [expandedTxId, setExpandedTxId] = useState(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal state
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const loadData = async () => {
    const txs = await getTransactions(activeUser.id);
    const sortedTxs = txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    setTransactions(sortedTxs);
    const cats = await getCategories(activeUser.id, 'EXPENSE');
    setCategories(cats);
    const accs = await getAllAccountsForLookup(activeUser.id);
    setAccounts(accs);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: showSearch ? () => (
        <TextInput
          style={{ flex: 1, minWidth: 200, fontSize: fs(15), backgroundColor: theme.background, color: theme.text, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 }}
          placeholderTextColor={theme.textSubtle}
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
        />
      ) : 'Transactions',
      headerRight: () => (
        <TouchableOpacity style={{ marginRight: 16, padding: 4 }} onPress={() => { setShowSearch(!showSearch); setSearchQuery(''); setVisibleCount(20); }}>
          {showSearch ? <X color={theme.textMuted} size={22} /> : <Search color={theme.text} size={22} />}
        </TouchableOpacity>
      ),
    });
  }, [navigation, showSearch, searchQuery, theme, fs]);

  const getCategoryName = (categoryId) => {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : '';
  };

  const getAccountName = (accId) => {
    const acc = accounts.find(a => a.id === accId);
    return acc ? acc.name : 'Unknown Account';
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    if (filterType === 'EXPENSE' && filterCategory !== 'ALL' && tx.categoryId !== filterCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const catName = getCategoryName(tx.categoryId).toLowerCase();
      if (!tx.note?.toLowerCase().includes(q) && !catName.includes(q)) return false;
    }
    return true;
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (item) => {
    Alert.alert(
      'Delete Transaction',
      `This will reverse ₹${item.amount.toFixed(2)} back to "${getAccountName(item.accountId)}" and log a system record. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Revert',
          style: 'destructive',
          onPress: async () => {
            await deleteTransaction(activeUser.id, item);
            setExpandedTxId(null);
            loadData();
          },
        },
      ]
    );
  };

  // ── Edit save ─────────────────────────────────────────────────────────────
  const handleEditSave = () => {
    const newAmount = parseFloat(editAmount);
    if (!newAmount || newAmount <= 0) return;
    const newData = { ...editingTx, amount: newAmount, note: editNote };
    const amountChanged = newAmount !== editingTx.amount;
    const confirmMsg = amountChanged
      ? `This will revert ₹${editingTx.amount.toFixed(2)} and apply ₹${newAmount.toFixed(2)} to "${getAccountName(editingTx.accountId)}". A system record will be logged. Continue?`
      : `Update the note for this transaction? A system record will be logged.`;

    Alert.alert('Confirm Edit', confirmMsg, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm & Save',
        onPress: async () => {
          await updateTransaction(activeUser.id, editingTx, newData);
          setEditingTx(null);
          setExpandedTxId(null);
          loadData();
        },
      },
    ]);
  };


  const openEdit = (item) => {
    setEditingTx(item);
    setEditAmount(item.amount.toString());
    setEditNote(item.note || '');
  };

  // ── Render transaction card ───────────────────────────────────────────────
  const renderTransaction = ({ item }) => {
    const isSystem = item.type === 'SYSTEM';
    const isPositive = item.type === 'INCOME';
    const isTransfer = item.type === 'TRANSFER' || item.type === 'PAYMENT';
    const isExpanded = expandedTxId === item.id;

    // For SYSTEM entries derive direction from note text
    const systemIsCredit = isSystem && (item.note?.includes('returned') || item.note?.includes('Deleted'));
    const systemIsDebit  = isSystem && item.note?.includes('deducted');

    const amountColor = isSystem
      ? (systemIsCredit ? theme.success : systemIsDebit ? theme.danger : theme.textMuted)
      : isPositive ? theme.success
      : isTransfer ? theme.textSubtle
      : theme.danger;

    const amountPrefix = isSystem
      ? (systemIsCredit ? '+' : systemIsDebit ? '-' : '')
      : isPositive ? '+' : isTransfer ? '' : '-';

    return (
      <TouchableOpacity
        style={[
          styles.txCard,
          { backgroundColor: isSystem ? theme.surfaceSoft : theme.surface },
          isExpanded && { borderColor: theme.primary, borderWidth: 1 },
          isSystem && { borderLeftWidth: 2, borderLeftColor: theme.textMuted },
        ]}
        onPress={() => setExpandedTxId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.txHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {isSystem && <Settings2 size={12} color={theme.textMuted} />}
            <Text style={[styles.txType, { color: isSystem ? theme.textMuted : theme.textMuted, fontSize: fs(12) }]}>
              {item.type}
            </Text>
          </View>
          <Text style={[styles.txDate, { color: theme.textSubtle, fontSize: fs(12) }]}>
            {format(new Date(item.date), 'MMM dd, yyyy')}
          </Text>
        </View>

        <View style={styles.txBody}>
          <View style={styles.txLeft}>
            <Text style={[styles.txNote, { color: isSystem ? theme.textMuted : theme.text, fontSize: fs(16) }]}
              numberOfLines={isExpanded ? undefined : 1}>
              {item.note || 'Untitled'}
            </Text>
            {item.type === 'EXPENSE' && item.categoryId ? (
              <Text style={[styles.txCat, { color: theme.primary, fontSize: fs(13) }]}>
                {getCategoryName(item.categoryId)}
              </Text>
            ) : null}
          </View>
          <Text style={[styles.txAmount, { fontSize: fs(18), color: amountColor }]}>
            {amountPrefix}₹{item.amount.toFixed(2)}
          </Text>
        </View>

        {isExpanded && (
          <View style={[styles.expandedDetails, { borderTopColor: theme.border }]}>
            <View style={styles.expandedRow}>
              <Text style={[styles.expandedLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Account:</Text>
              <Text style={[styles.expandedValue, { color: theme.text, fontSize: fs(13) }]}>{getAccountName(item.accountId)}</Text>
            </View>
            {(item.type === 'TRANSFER' || item.type === 'PAYMENT') && item.toAccountId && (
              <View style={styles.expandedRow}>
                <Text style={[styles.expandedLabel, { color: theme.textMuted, fontSize: fs(13) }]}>To Account:</Text>
                <Text style={[styles.expandedValue, { color: theme.text, fontSize: fs(13) }]}>{getAccountName(item.toAccountId)}</Text>
              </View>
            )}
            <View style={styles.expandedRow}>
              <Text style={[styles.expandedLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Time:</Text>
              <Text style={[styles.expandedValue, { color: theme.text, fontSize: fs(13) }]}>{format(new Date(item.date), 'hh:mm a')}</Text>
            </View>

            {/* Edit / Delete — only for non-system transactions */}
            {!isSystem && (
              <View style={[styles.actionRow, { borderTopColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.primarySoft }]}
                  onPress={() => openEdit(item)}
                >
                  <Pencil size={14} color={theme.primary} />
                  <Text style={[styles.actionBtnText, { color: theme.primary, fontSize: fs(13) }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: theme.isDark ? '#3b1010' : '#fef2f2' }]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={14} color={theme.danger} />
                  <Text style={[styles.actionBtnText, { color: theme.danger, fontSize: fs(13) }]}>Delete & Revert</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.container, { backgroundColor: theme.background }]}>

      <View style={[styles.filtersContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 12 }}>
          <CustomDropdown
            containerStyle={{ flex: 1, marginBottom: 0 }}
            selectedValue={filterType}
            onSelect={(val) => { setFilterType(val); setFilterCategory('ALL'); setVisibleCount(20); }}
            options={[
              { label: 'All Types', value: 'ALL' },
              { label: 'Expense', value: 'EXPENSE' },
              { label: 'Income', value: 'INCOME' },
              { label: 'Transfer', value: 'TRANSFER' },
              { label: 'CC Pay', value: 'PAYMENT' },
              { label: 'System', value: 'SYSTEM' },
            ]}
          />
          {filterType === 'EXPENSE' && categories.length > 0 && (
            <CustomDropdown
              containerStyle={{ flex: 1, marginBottom: 0 }}
              selectedValue={filterCategory}
              onSelect={(val) => { setFilterCategory(val); setVisibleCount(20); }}
              options={[
                { label: 'All Categories', value: 'ALL' },
                ...categories.map(c => ({ label: c.name, value: c.id }))
              ]}
            />
          )}
        </View>
      </View>

      <FlatList
        data={filteredTransactions.slice(0, visibleCount)}
        keyExtractor={item => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (visibleCount < filteredTransactions.length) setVisibleCount(prev => prev + 20);
        }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyStateText, { color: theme.textSubtle }]}>No transactions found.</Text>
          </View>
        }
      />

      {/* Edit Transaction Modal */}
      <Modal visible={!!editingTx} animationType="slide" transparent onRequestClose={() => setEditingTx(null)}>
        <SafeAreaView style={styles.editOverlay}>
          <View style={[styles.editSheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border, marginHorizontal: -20, paddingHorizontal: 20 }]}>
              <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(17) }]}>Edit Transaction</Text>
              <TouchableOpacity onPress={() => setEditingTx(null)}>
                <X color={theme.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.editLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Amount (₹)</Text>
            <TextInput
              style={[styles.editInput, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, fontSize: fs(28) }]}
              keyboardType="numeric"
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="0.00"
              placeholderTextColor={theme.textSubtle}
              textAlign="center"
            />

            <Text style={[styles.editLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Note</Text>
            <TextInput
              style={[styles.editInputNote, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border, fontSize: fs(15) }]}
              value={editNote}
              onChangeText={setEditNote}
              placeholder="Description..."
              placeholderTextColor={theme.textSubtle}
              multiline
            />

            {editingTx && parseFloat(editAmount) !== editingTx.amount && (
              <View style={[styles.diffBanner, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.diffText, { color: theme.primary, fontSize: fs(13) }]}>
                  ₹{editingTx.amount.toFixed(2)} → ₹{parseFloat(editAmount || 0).toFixed(2)} · Difference will be reverted to account
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.editSaveBtn, { backgroundColor: theme.primary }]}
              onPress={handleEditSave}
            >
              <Text style={[styles.editSaveBtnText, { fontSize: fs(16) }]}>Save & Adjust Balance</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  iconBtn: { padding: 4 },
  fabBtn: {
    position: 'absolute', bottom: 24, right: 24,
    width: 60, height: 60, borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5, zIndex: 1000,
  },
  filtersContainer: { paddingVertical: 12, borderBottomWidth: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  txCard: { padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  txHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  txType: { fontWeight: 'bold', letterSpacing: 0.5 },
  txDate: {},
  txBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  txLeft: { flex: 1, paddingRight: 16 },
  txNote: { fontWeight: '600', marginBottom: 4 },
  txCat: { fontWeight: '500' },
  txAmount: { fontWeight: 'bold' },
  expandedDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  expandedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  expandedLabel: { fontWeight: '500' },
  expandedValue: { fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyStateText: { fontStyle: 'italic' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: 'bold' },
  closeBtn: { padding: 4 },
  // Edit sheet
  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  editSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  editLabel: { fontWeight: '600', marginTop: 16, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  editInput: { borderWidth: 1, borderRadius: 14, padding: 16, fontWeight: 'bold' },
  editInputNote: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 60 },
  diffBanner: { marginTop: 14, padding: 12, borderRadius: 10 },
  diffText: { fontWeight: '500', textAlign: 'center' },
  editSaveBtn: { marginTop: 20, padding: 16, borderRadius: 14, alignItems: 'center' },
  editSaveBtnText: { color: 'white', fontWeight: 'bold' },
});
