import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  BarChart2,
  Building2,
  ChevronRight,
  Clock,
  CreditCard,
  HandCoins,
  History,
  Landmark,
  RefreshCw,
  TrendingUp,
  Users
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert, RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import CustomHeader from '../components/CustomHeader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Storage & Utils
import { 
  getDb, getAccounts, getAccountLogs, updateLoanInfo, 
  getRecurringPayments, deleteRecurringByAccountId 
} from '../services/storage';
import { getLoanStats } from '../utils/loanUtils';
import { getEmiStats } from '../utils/emiUtils';

import { getCurrencySymbol } from '../utils/currencyUtils';

// Modular Components
import HistoryModal from '../components/accounts/HistoryModal';

const SECTIONS = [
  { key: 'BANK', label: 'Bank Accounts', Icon: Landmark, color: '#3b82f6' },
  { key: 'CREDIT_CARD', label: 'Credit Cards', Icon: CreditCard, color: '#8b5cf6' },
  { key: 'INVESTMENT', label: 'Investments', Icon: TrendingUp, color: '#10b981' },
  { key: 'SIP', label: 'SIPs', Icon: BarChart2, color: '#06b6d4' },
  { key: 'LOAN', label: 'Loans', Icon: Building2, color: '#f59e0b' },
  { key: 'BORROWED', label: 'Borrowed (Liability)', Icon: HandCoins, color: '#ef4444' },
  { key: 'LENDED', label: 'Lended (Asset)', Icon: Users, color: '#10b981' },
  { key: 'EMI', label: 'Credit Card EMIs', Icon: Clock, color: '#ec4899' },
  { key: 'RECURRING', label: 'Monthly Schedules', Icon: RefreshCw, color: '#ef4444' },
];

export default function Accounts() {
  const navigation = useNavigation();
  const { activeUser } = useAuth();
  const { theme, fs, setIsSettingsOpen } = useTheme();

  const [accounts, setAccounts] = useState([]);
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const [showHistory, setShowHistory] = useState(false);

  // State for focused items
  const [logs, setLogs] = useState([]);

  const expenseCategories = useMemo(() => activeUser?.categories?.filter(c => c.type === 'EXPENSE') || [], [activeUser]);

  const loadData = useCallback(async () => {
    if (!activeUser) return;
    const db = await getDb();
    const [accs, recurs] = await Promise.all([
      getAccounts(db, activeUser.id),
      getRecurringPayments(activeUser.id)
    ]);
    setAccounts(accs);
    setRefreshing(false);
    setRecurringPayments(recurs);
  }, [activeUser]);


  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const sectionItems = (key) => {
    if (key === 'RECURRING') return (recurringPayments || []).filter(i => !!i);
    const baseItems = (accounts || []).filter(acc => acc && acc.type === key);

    if (key === 'CREDIT_CARD') {
      return baseItems.map(cc => ({ ...cc, totalUsage: cc.balance || 0 }));
    }
    return baseItems;
  };

  const totals = useMemo(() => {
    const res = {};
    SECTIONS.forEach(s => {
      const items = sectionItems(s.key);
      if (s.key === 'RECURRING') {
        res[s.key] = items.reduce((sum, i) => sum + ((i && i.status === 'ACTIVE') ? i.amount : 0), 0);
      } else if (s.key === 'LOAN' || s.key === 'BORROWED' || s.key === 'LENDED') {
        res[s.key] = items.reduce((sum, i) => sum + (i ? getLoanStats(i).remainingTotal : 0), 0);
      } else if (s.key === 'EMI') {
        res[s.key] = items.reduce((sum, i) => sum + (i ? getEmiStats(i).remainingTotal : 0), 0);

      } else if (s.key === 'CREDIT_CARD') {
        res[s.key] = items.reduce((sum, i) => sum + (i ? (i.creditLimit || 0) - (i.totalUsage || 0) : 0), 0);
      } else if (s.key === 'SIP') {
        res[s.key] = items.reduce((sum, i) => sum + (i ? (i.totalPaid || 0) : 0), 0);
      } else {
        res[s.key] = items.reduce((sum, i) => sum + (i ? (i.balance || 0) : 0), 0);
      }
    });
    return res;
  }, [accounts, recurringPayments]);

  const recurringStats = useMemo(() => {
    const stats = {};
    (recurringPayments || []).forEach(rp => {
      if (!rp) return;
      const sessions = activeUser?.sessions || [];
      const relevant = sessions.filter(s => s.details && s.details.includes(rp.name));
      const year = new Date().getFullYear();
      stats[rp.name] = {
        totalPaid: relevant.reduce((sum, s) => {
          const match = s.details && (s.details.match(/[^0-9\s,]{1,5}\s?([\d,.]+)/));
          return sum + (match ? parseFloat(match[1].replace(/,/g, '')) : 0);
        }, 0),
        yearPaid: relevant.filter(s => s.timestamp && new Date(s.timestamp).getFullYear() === year).reduce((sum, s) => {
          const match = s.details && (s.details.match(/[^0-9\s,]{1,5}\s?([\d,.]+)/));
          return sum + (match ? parseFloat(match[1].replace(/,/g, '')) : 0);
        }, 0),
        timesTotal: relevant.length
      };
    });
    return stats;
  }, [recurringPayments, activeUser?.sessions]);

  const openHistory = useCallback(async () => {
    if (!activeUser) return;
    const db = await getDb();
    const history = await getAccountLogs(db, activeUser.id);
    setLogs(history);
    setShowHistory(true);
  }, [activeUser]);

  // Header options moved to inline custom header

  const handleRevertFromEmi = async (item) => {
    Alert.alert('Revert to Loan', 'Convert this EMI back to a standard reducing balance loan?', [
      { text: 'No' },
      {
        text: 'Revert', onPress: async () => {
          const db = await getDb();
          await Promise.all([
            updateLoanInfo(db, item.id, { ...item, isEmi: 0, loanTenure: (item.loanTenure || 0) / 12 }),
            deleteRecurringByAccountId(item.id)
          ]);
          loadData();
        }
      }
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CustomHeader
        title="Accounts"
        showProfile={true}
        onProfilePress={() => setIsSettingsOpen(true)}
        theme={theme}
        fs={fs}
        rightComponent={
          <TouchableOpacity onPress={openHistory} style={styles.historyBtnTop}>
            <History color={theme.text} size={22} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} colors={[theme.primary]} tintColor={theme.primary} />}
      >
        <View style={styles.grid}>
          {SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.key}
              style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => navigation.navigate('AccountDetail', { sectionKey: section.key })}
            >
              <View style={[styles.iconBox, { backgroundColor: section.color + '15' }]}>
                <section.Icon color={section.color} size={24} />
              </View>
              <Text style={[styles.tileLabel, { color: theme.textSubtle, fontSize: fs(12) }]}>{section.label}</Text>
              {section.key !== 'RECURRING' && (
                <Text style={[styles.tileAmount, { color: theme.text, fontSize: fs(18) }]} numberOfLines={1}>
                  {section.key === 'CREDIT_CARD' ? 'Avl: ' : ''}{getCurrencySymbol(activeUser?.currency)}{totals[section.key]?.toFixed(0) || '0'}
                </Text>
              )}
              <View style={styles.tileFooter}>
                <Text style={{ color: theme.textMuted, fontSize: fs(11) }}>{sectionItems(section.key).length} items</Text>
                <ChevronRight color={theme.textMuted} size={14} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <HistoryModal visible={showHistory} logs={logs} theme={theme} fs={fs} onClose={() => setShowHistory(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  profileBtn: {
    marginLeft: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  headerTitle: { fontWeight: '800', letterSpacing: -0.5, marginLeft: 8 },
  historyBtnTop: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 16,
    bottom: -22,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    zIndex: 20
  },
  scrollContent: { padding: 16, paddingBottom: 100 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '48%', borderRadius: 16, padding: 16, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  tileLabel: { fontWeight: '600', marginBottom: 4 },
  tileAmount: { fontWeight: '700' },
  tileFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  modalWrap: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontWeight: '700' },
  addBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
});
