import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Modal, ScrollView, TextInput, Alert, Platform, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, Filter, Pencil, Trash2, Settings2, ArrowUpRight, ArrowDownLeft, RefreshCw, CreditCard, Landmark, Banknote, ShieldAlert, Clock, CornerDownRight, Link } from 'lucide-react-native';
import CustomHeader from '../components/CustomHeader';
import { getTransactions, getCategories, getAllAccountsForLookup, deleteTransaction, updateTransaction } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import CustomDropdown from '../components/CustomDropdown';
import { format, isSameDay } from 'date-fns';
import TransactionsFilterModal from '../components/TransactionsFilterModal';
import { formatInTZ } from '../utils/dateUtils';
import { getCurrencySymbol } from '../utils/currencyUtils';

export default function TransactionsList({ navigation }) {
  const { activeUser } = useAuth();
  const { theme, fs, setIsSettingsOpen } = useTheme();
  const insets = useSafeAreaInsets();

  // ── State ───────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({
    type: 'ALL',
    accountId: 'ALL',
    accountType: 'ALL',
    month: null,
    date: null
  });
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [expandedTxId, setExpandedTxId] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit modal state
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  // PIN Verification State
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinError, setPinError] = useState('');
  const [txToDelete, setTxToDelete] = useState(null);

  // ── Data Loading ─────────────────────────────────────────────────────────
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
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const backAction = () => {
      if (showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [showSearch]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  function getCategoryName(categoryId) {
    if (!categoryId) return '';
    const cat = categories.find(c => c.id === categoryId);
    return cat ? cat.name : '';
  }

  function getAccountDisplay(accId) {
    const acc = accounts.find(a => a.id === accId);
    if (!acc) return 'Unknown';
    const typeMap = {
      'BANK': 'Bank',
      'CREDIT_CARD': 'CC',
      'LOAN': 'Loan',
      'EMI': 'EMI',
      'INVESTMENT': 'Inv',
      'SIP': 'SIP',
      'BORROWED': 'Borrow',
      'LENDED': 'Lend'
    };
    const label = typeMap[acc.type] || acc.type || 'Acc';
    return `${acc.name} (${label})`;
  }

  function getTransactionVisuals(tx) {
    const type = tx.type;
    const note = tx.note || '';

    let color = '#64748b'; // Default System
    let icon = Settings2;
    let bgColor = '#64748b15';
    let label = type;

    if (type === 'INCOME') {
      color = '#10b981'; // Emerald
      icon = ArrowDownLeft;
      bgColor = '#10b98115';
      label = 'Income';
    } else if (type === 'EXPENSE') {
      color = '#e11d48'; // Rose
      icon = ArrowUpRight;
      bgColor = '#e11d4815';
      label = getCategoryName(tx.categoryId) || 'Expense';
    } else if (type === 'TRANSFER') {
      color = '#0ea5e9'; // Sky
      icon = RefreshCw;
      bgColor = '#0ea5e915';
      label = 'Transfer';
    } else if (type === 'PAYMENT') {
      color = '#6366f1'; // Indigo
      icon = CreditCard;
      bgColor = '#6366f115';
      label = 'CC Bill Pay';
    } else if (type === 'PAY_EMI' || type === 'REPAY_LOAN' || type === 'REPAY_BORROWED') {
      color = '#f59e0b'; // Amber
      icon = Landmark;
      bgColor = '#f59e0b15';
      label = type.replace(/_/g, ' ');
    } else if (type === 'EMI_LIMIT_BLOCK') {
      color = '#0ea5e9'; // Sky
      icon = Landmark;
      bgColor = '#0ea5e915';
      label = 'CC Limit Block';
    } else if (type === 'EMI_PAYMENT') {
      color = '#6366f1'; // Indigo
      icon = CreditCard;
      bgColor = '#6366f115';
      label = 'EMI Installment';
    } else if (type === 'EMI_LIMIT_RECOVERY') {
      color = '#10b981'; // Emerald
      icon = RefreshCw;
      bgColor = '#10b98115';
      label = 'Limit Recovery';
    } else if (type === 'FINE' || type === 'EMI_FINE') {
      color = '#f97316'; // Orange
      icon = ShieldAlert;
      bgColor = '#f9731615';
      label = 'Fine Paid';
    } else if (type === 'SYSTEM') {
      const isCredit = note.includes('returned') || note.includes('Deleted');
      color = isCredit ? '#10b981' : '#64748b';
      icon = Settings2;
      bgColor = color + '15';
    }

    return { color, icon, bgColor, label };
  }

  // ── Renderers ────────────────────────────────────────────────────────────
  function renderSectionHeader({ section: { title } }) {
    return (
      <View style={[styles.sectionHeader, { backgroundColor: theme.surface + 'B0' }]}>
        <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(11) }]}>
          {title}
        </Text>
      </View>
    );
  }

  function renderTransaction({ item }) {
    const { color, icon: Icon, bgColor, label } = getTransactionVisuals(item);
    const isExpanded = expandedTxId === item.id;
    const isSystem = item.type === 'SYSTEM';
    const isIncome = item.type === 'INCOME' || (isSystem && (item.note?.includes('returned') || item.note?.includes('Deleted')));
    const isTransfer = item.type === 'TRANSFER' || item.type === 'PAYMENT';

    return (
      <TouchableOpacity
        style={[
          styles.txCard,
          { backgroundColor: theme.surface, borderColor: isExpanded ? color : theme.border + '15' },
          isExpanded && { borderWidth: 1.5, shadowOpacity: 0.1, elevation: 4 }
        ]}
        onPress={() => setExpandedTxId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.txIconContainer, { backgroundColor: bgColor }]}>
            <Icon size={20} color={color} strokeWidth={2.5} />
          </View>
          
          <View style={styles.txMainContent}>
            <Text style={[styles.txNote, { color: theme.text, fontSize: fs(15) }]} numberOfLines={isExpanded ? undefined : 1}>
              {item.note || 'Untitled'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.txLabel, { color: color, fontSize: fs(10), fontWeight: '800', textTransform: 'uppercase' }]}>
                {label}
              </Text>
              <Text style={[styles.txDate, { color: theme.textSubtle, fontSize: fs(11) }]}>
                • {getAccountDisplay(item.accountId)}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.txAmount, { fontSize: fs(16), color: isIncome ? '#10b981' : (isTransfer ? theme.text : '#e11d48') }]}>
              {isIncome ? '+' : (isTransfer ? '' : '-')}{getCurrencySymbol(activeUser?.currency)}{item.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: fs(10), marginTop: 2 }}>
              {formatInTZ(item.date, activeUser?.timezone, 'h:mm a')}
            </Text>
          </View>
        </View>

        {isExpanded && (
          <View style={[styles.expandedDetails, { backgroundColor: theme.isDark ? '#1e293b40' : '#f8fafc' }]}>
            <View style={styles.expandedInfoSection}>
              <View style={styles.expandedInfoRow}>
                <View style={[styles.infoIconWrapper, { backgroundColor: theme.primarySoft }]}>
                  <Landmark size={12} color={theme.primary} />
                </View>
                <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Source Account</Text>
                <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]} numberOfLines={1}>{getAccountDisplay(item.accountId)}</Text>
              </View>

              {item.linkedItemId && (
                <View style={styles.expandedInfoRow}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: '#f59e0b20' }]}>
                    <Link size={12} color="#f59e0b" />
                  </View>
                  <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Linked To</Text>
                  <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]} numberOfLines={1}>{getAccountDisplay(item.linkedItemId)}</Text>
                </View>
              )}

              {(item.type === 'TRANSFER' || item.type === 'PAYMENT' || item.type === 'EMI_PAYMENT' || item.type === 'EMI_LIMIT_RECOVERY') && item.toAccountId && (
                <View style={styles.expandedInfoRow}>
                  <View style={[styles.infoIconWrapper, { backgroundColor: '#10b98115' }]}>
                    <CornerDownRight size={12} color="#10b981" />
                  </View>
                  <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Destination</Text>
                  <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]} numberOfLines={1}>{getAccountDisplay(item.toAccountId)}</Text>
                </View>
              )}

              <View style={styles.expandedInfoRow}>
                <View style={[styles.infoIconWrapper, { backgroundColor: '#94a3b815' }]}>
                  <Clock size={12} color="#64748b" />
                </View>
                <Text style={[styles.expandedInfoLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>Transaction Time</Text>
                <Text style={[styles.expandedInfoValue, { color: theme.text, fontSize: fs(12) }]}>{formatInTZ(item.date, activeUser?.timezone, 'hh:mm a')}</Text>
              </View>
            </View>

            {!isSystem && item.type !== 'EMI_LIMIT_BLOCK' && item.type !== 'EMI_PAYMENT' && item.type !== 'EMI_LIMIT_RECOVERY' && (
              <View style={[styles.actionRow, { borderTopColor: theme.border + '30' }]}>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={[styles.actionIconButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                  onPress={() => openEdit(item)}
                >
                  <Pencil size={14} color={theme.primary} />
                  <Text style={[styles.iconButtonLabel, { color: theme.primary, fontSize: fs(9) }]}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionIconButton, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '20' }]}
                  onPress={() => handleDelete(item)}
                >
                  <Trash2 size={14} color={theme.danger} />
                  <Text style={[styles.iconButtonLabel, { color: theme.danger, fontSize: fs(9) }]}>Revert</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // ── Logic ────────────────────────────────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matches = (tx.note || '').toLowerCase().includes(q) || 
                      getCategoryName(tx.categoryId).toLowerCase().includes(q) || 
                      getAccountDisplay(tx.accountId).toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (filters.type !== 'ALL' && tx.type !== filters.type) return false;
      if (filters.date && !isSameDay(new Date(tx.date), new Date(filters.date))) return false;
      if (filters.month && !filters.date) {
        if (format(new Date(tx.date), 'yyyy-MM') !== filters.month) return false;
      }
      if (filters.accountId !== 'ALL' && tx.accountId !== filters.accountId) return false;
      if (filters.accountType !== 'ALL') {
        const acc = accounts.find(a => a.id === tx.accountId);
        if (!acc || acc.type !== filters.accountType) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, filters, accounts, categories]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    filteredTransactions.forEach(tx => {
      const txDate = new Date(tx.date); txDate.setHours(0,0,0,0);
      let title = format(txDate, 'MMMM dd, yyyy');
      if (txDate.getTime() === today.getTime()) title = 'Today';
      else if (txDate.getTime() === yesterday.getTime()) title = 'Yesterday';
      if (!groups[title]) groups[title] = [];
      groups[title].push(tx);
    });

    return Object.keys(groups).map(title => ({ title, data: groups[title] }));
  }, [filteredTransactions]);

  const activeChips = getActiveFilterChips();

  function getActiveFilterChips() {
    const chips = [];
    if (filters.type !== 'ALL') chips.push({ id: 'type', label: `Type: ${filters.type.replace(/_/g, ' ')}` });
    if (filters.month) chips.push({ id: 'month', label: format(new Date(filters.month + '-02'), 'MMM yyyy') });
    if (filters.date) chips.push({ id: 'date', label: format(new Date(filters.date), 'MMM dd') });
    if (filters.accountId !== 'ALL') {
      const acc = accounts.find(a => a.id === filters.accountId);
      if (acc) chips.push({ id: 'accountId', label: `Acc: ${acc.name}` });
    }
    if (filters.accountType !== 'ALL') chips.push({ id: 'accountType', label: `For: ${filters.accountType}` });
    return chips;
  }

  const removeFilter = (key) => setFilters(prev => ({ ...prev, [key]: (key === 'type' || key === 'accountId' || key === 'accountType' ? 'ALL' : null) }));
  const openEdit = (item) => { setEditingTx(item); setEditAmount(item.amount.toString()); setEditNote(item.note || ''); };
  const handleDelete = (item) => { setTxToDelete(item); setPinValue(''); setPinError(''); setShowPinModal(true); };

  const confirmSecureDelete = async () => {
    if (pinValue !== activeUser.pin) { setPinError('Incorrect PIN'); setPinValue(''); return; }
    if (!txToDelete) return;
    try {
      await deleteTransaction(activeUser.id, txToDelete);
      setShowPinModal(false); setTxToDelete(null); setExpandedTxId(null); loadData();
    } catch (error) { Alert.alert('Error', 'Failed to delete transaction.'); }
  };

  const handleEditSave = () => {
    const newAmount = parseFloat(editAmount);
    if (!newAmount || newAmount <= 0) return;
    const newData = { ...editingTx, amount: newAmount, note: editNote };
    Alert.alert('Confirm Edit', 'Save changes to this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => { await updateTransaction(activeUser.id, editingTx, newData, getCurrencySymbol(activeUser?.currency)); setEditingTx(null); setExpandedTxId(null); loadData(); } }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CustomHeader 
        title="Transactions"
        theme={theme}
        fs={fs}
        showProfile={true}
        onProfilePress={() => setIsSettingsOpen(true)}
      />

      <TouchableOpacity 
        style={[styles.floatingFilterBtn, { 
          backgroundColor: activeChips.length > 0 ? theme.primary : theme.surface,
          borderColor: theme.border,
          borderWidth: activeChips.length > 0 ? 0 : 1,
          top: insets.top + 18 
        }]}
        onPress={() => setShowFilterModal(true)}
      >
        <Filter size={16} color={activeChips.length > 0 ? '#FFF' : theme.text} strokeWidth={2.5} />
        {activeChips.length > 0 && <View style={[styles.floatingBadge, { backgroundColor: '#FFF' }]} />}
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.floatingSearchBtn, { 
          backgroundColor: showSearch ? theme.transfer : theme.surface,
          borderColor: theme.border,
          borderWidth: showSearch ? 0 : 1,
          top: insets.top + 18 
        }]}
        onPress={() => { setShowSearch(!showSearch); if(showSearch) setSearchQuery(''); }}
      >
        <Search size={16} color={showSearch ? '#FFF' : theme.text} strokeWidth={2.5} />
      </TouchableOpacity>


      <SectionList
        sections={groupedTransactions.slice(0, visibleCount)}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={true}
        ListHeaderComponent={
          (showSearch || activeChips.length > 0) ? (
            <View style={[styles.headerActions, { borderBottomColor: theme.border + '15', borderBottomWidth: 1 }]}>
              {showSearch && (
                <View style={styles.searchContainer}>
                  <View style={[styles.searchInputWrapper, { backgroundColor: theme.background, borderColor: theme.border }]}>
                    <Search size={16} color={theme.textSubtle} />
                    <TextInput
                      style={[styles.searchInputField, { color: theme.text, fontSize: fs(14) }]}
                      placeholder="Search notes, accounts, labels..."
                      placeholderTextColor={theme.placeholder}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoFocus
                      onSubmitEditing={() => setShowSearch(false)}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <X size={16} color={theme.textSubtle} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              {activeChips.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
                  {activeChips.map(chip => (
                    <TouchableOpacity 
                      key={chip.id} 
                      style={[styles.chip, { backgroundColor: theme.primary + '11', borderColor: theme.primary + '40' }]}
                      onPress={() => removeFilter(chip.id)}
                    >
                      <Text style={[styles.chipText, { color: theme.primary, fontSize: fs(10) }]}>{chip.label.toUpperCase()}</Text>
                      <X size={10} color={theme.primary} />
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    onPress={() => { setSearchQuery(''); setFilters({ type: 'ALL', accountId: 'ALL', accountType: 'ALL', month: null, date: null }); }}
                    style={styles.clearAllBtn}
                  >
                    <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '700' }}>CLEAR ALL</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </View>
          ) : null
        }
        onEndReached={() => {
          if (visibleCount < groupedTransactions.length) setVisibleCount(visibleCount + 20);
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 100 }}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconContainer, { backgroundColor: theme.surfaceMuted }]}>
              <Search size={40} color={theme.textSubtle} />
            </View>
            <Text style={[styles.emptyText, { color: theme.text, fontSize: fs(18) }]}>No transactions found</Text>
            <Text style={[styles.emptySubtext, { color: theme.textSubtle, fontSize: fs(14) }]}>Try adjusting your search or filters.</Text>
            {(searchQuery || activeChips.length > 0) && (
              <TouchableOpacity 
                style={[styles.resetBtn, { backgroundColor: theme.primary }]}
                onPress={() => { setSearchQuery(''); setFilters({ type: 'ALL', accountId: 'ALL', accountType: 'ALL', month: null, date: null }); }}
              >
                <Text style={{ color: 'white', fontWeight: '800' }}>Reset Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      <TransactionsFilterModal 
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        setFilters={setFilters}
        accounts={accounts}
        theme={theme}
        fs={fs}
        insets={insets}
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

            <Text style={[styles.editLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Amount ({getCurrencySymbol(activeUser?.currency)})</Text>
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

            <TouchableOpacity style={[styles.editSaveBtn, { backgroundColor: theme.primary }]} onPress={handleEditSave}>
              <Text style={[styles.editSaveBtnText, { fontSize: fs(16) }]}>Save & Adjust Balance</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* PIN VERIFICATION MODAL */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 28, width: '100%', maxWidth: 400 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: theme.danger + '15', justifyContent: 'center', alignItems: 'center' }}>
                <ShieldAlert color={theme.danger} size={22} />
              </View>
              <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: '900' }}>Confirm Action</Text>
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 20, lineHeight: 18 }}>
              This will revert <Text style={{ color: theme.text, fontWeight: '700' }}>{getCurrencySymbol(activeUser?.currency)}{txToDelete?.amount?.toLocaleString()}</Text> back to account. Enter your 4-digit PIN to authorize this change.
            </Text>
            <TextInput 
              style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: pinError ? theme.danger : theme.border, borderRadius: 16, padding: 14, fontSize: fs(22), color: theme.text, letterSpacing: 12, textAlign: 'center', marginBottom: 8, fontWeight: '900' }} 
              keyboardType="numeric" maxLength={4} secureTextEntry value={pinValue} onChangeText={(v) => { setPinValue(v); setPinError(''); }} placeholder="••••" placeholderTextColor={theme.textMuted} autoFocus 
            />
            {pinError ? <Text style={{ color: theme.danger, fontSize: fs(12), marginBottom: 16, textAlign: 'center', fontWeight: '600' }}>{pinError}</Text> : <View style={{ height: 16 }} />}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }} onPress={() => setShowPinModal(false)}>
                <Text style={{ color: theme.textSubtle, fontWeight: '800', fontSize: fs(14) }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: theme.danger, alignItems: 'center', elevation: 4 }} onPress={confirmSecureDelete}>
                <Text style={{ color: 'white', fontWeight: '900', fontSize: fs(14) }}>Revert Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </View>
    );
  }

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerActions: { borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  headerTitle: { fontWeight: '900', letterSpacing: -0.5 },
  headerButtons: { flexDirection: 'row', gap: 10 },
  headerIconBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 2, borderColor: '#fff' },
  searchContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, gap: 10 },
  searchInputField: { flex: 1, fontWeight: '600' },
  chipsContainer: { paddingHorizontal: 20, gap: 8, paddingVertical: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  chipText: { fontWeight: '800', letterSpacing: 0.5 },
  clearAllBtn: { paddingHorizontal: 10, justifyContent: 'center' },
  txCard: { padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  txIconContainer: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  txMainContent: { flex: 1, justifyContent: 'center' },
  txNote: { fontWeight: '800', marginBottom: 2, letterSpacing: -0.3 },
  txLabel: { letterSpacing: 0.5 },
  txDate: { fontWeight: '600' },
  txAmount: { fontWeight: '900', letterSpacing: -0.5 },
  expandedDetails: { marginTop: 8, padding: 12, borderTopWidth: 1, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  expandedInfoSection: { gap: 8, marginBottom: 8 },
  expandedInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoIconWrapper: { width: 22, height: 22, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  expandedInfoLabel: { width: 110, fontWeight: '500' },
  expandedInfoValue: { flex: 1, fontWeight: '600', textAlign: 'right' },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 4, paddingTop: 10, borderTopWidth: 1, alignItems: 'center' },
  actionIconButton: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 54, height: 42, borderRadius: 10, borderWidth: 1, gap: 3 },
  iconButtonLabel: { fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.2 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8, marginTop: 0, marginBottom: 8 },
  sectionTitle: { fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 40 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyText: { fontWeight: '900', marginBottom: 8 },
  emptySubtext: { textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  resetBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: 'bold' },
  editOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  editSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: (Platform.OS === 'ios' ? 40 : 20) },
  editLabel: { fontWeight: '800', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  editInput: { borderWidth: 1, borderRadius: 16, padding: 20, fontWeight: '900' },
  editInputNote: { borderWidth: 1, borderRadius: 16, padding: 16, minHeight: 80, marginBottom: 20 },
  editSaveBtn: { padding: 18, borderRadius: 16, alignItems: 'center', elevation: 4 },
  editSaveBtnText: { color: 'white', fontWeight: '900' },
  floatingFilterBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 25
  },
  floatingSearchBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 60,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    zIndex: 25
  },
  floatingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
  }
});

