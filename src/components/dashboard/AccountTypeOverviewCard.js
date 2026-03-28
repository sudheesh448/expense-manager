import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { 
  Landmark, CreditCard, TrendingUp, BarChart2, 
  Building2, HandCoins, Users, Clock, ArrowUpRight, ArrowDownRight,
  Wallet, ShieldCheck, AlertCircle
} from 'lucide-react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { getAccounts, getDb, getCCAccountDueInfo } from '../../services/storage';
import { getCurrencySymbol } from '../../utils/currencyUtils';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;

const TYPE_CONFIG = {
  BANK: { label: 'Savings', icon: Landmark, color: '#3b82f6', isAsset: true },
  INVESTMENT: { label: 'Investments', icon: TrendingUp, color: '#10b981', isAsset: true },
  SIP: { label: 'SIPs', icon: BarChart2, color: '#06b6d4', isAsset: true },
  LENDED: { label: 'Lended', icon: Users, color: '#10b981', isAsset: true },
  CREDIT_CARD: { label: 'Cards', icon: CreditCard, color: '#8b5cf6', isAsset: false },
  LOAN: { label: 'Loans', icon: Building2, color: '#f59e0b', isAsset: false },
  BORROWED: { label: 'Borrowed', icon: HandCoins, color: '#ef4444', isAsset: false },
  EMI: { label: 'EMIs', icon: Clock, color: '#ec4899', isAsset: false },
};

export default function AccountTypeOverviewCard({ userId, theme, fs, currency }) {
  const navigation = useNavigation();
  const [isFetching, setIsFetching] = useState(false);
  const [stats, setStats] = useState([]);
  const [totals, setTotals] = useState({ assets: 0, liabilities: 0 });

  const loadData = async () => {
    if (!userId) return;
    setIsFetching(true);
    try {
      const db = await getDb();
      const accounts = await getAccounts(db, userId);
      
      let assetTotal = 0;
      let liabilityTotal = 0;
      const typeTotals = {};

      for (const type in TYPE_CONFIG) {
        const items = accounts.filter(a => a.type === type && !a.isClosed);
        let amount = 0;

        if (type === 'CREDIT_CARD') {
          for (const card of items) {
            const dueInfo = await getCCAccountDueInfo(db, userId, card.id);
            amount += (dueInfo.totalAmountDue + dueInfo.currentCycleUsage);
          }
        } else if (['LOAN', 'BORROWED', 'LENDED', 'EMI'].includes(type)) {
          amount = items.reduce((sum, i) => sum + (i.balance || 0), 0);
        } else if (type === 'SIP') {
          amount = items.reduce((sum, i) => sum + (i.balance ?? i.totalPaid ?? 0), 0);
        } else {
          amount = items.reduce((sum, i) => sum + (i.balance || 0), 0);
        }

        typeTotals[type] = amount;
        if (TYPE_CONFIG[type].isAsset) {
          assetTotal += amount;
        } else {
          liabilityTotal += amount;
        }
      }

      const statsArray = Object.keys(TYPE_CONFIG).map(type => ({
        type,
        amount: typeTotals[type],
        ...TYPE_CONFIG[type]
      })).filter(s => s.amount > 0);

      setStats(statsArray);
      setTotals({ assets: assetTotal, liabilities: liabilityTotal });
    } catch (error) {
      console.error('Error loading account overview:', error);
    } finally {
      setIsFetching(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [userId])
  );

  const netWorth = totals.assets - totals.liabilities;
  const totalVolume = totals.assets + totals.liabilities;
  
  // Chart Logic
  const radius = 35;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const assetRatio = totalVolume > 0 ? totals.assets / totalVolume : 1;
  const assetOffset = circumference * (1 - assetRatio);

  if (isFetching && stats.length === 0) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, height: 200, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
           <View style={[styles.headerIconBox, { backgroundColor: theme.primary + '15' }]}>
             <Wallet size={18} color={theme.primary} />
           </View>
           <Text style={[styles.headerTitle, { color: theme.text, fontSize: fs(16) }]}>Account Portfolio</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Accounts')}>
          <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: fs(12) }}>View All</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainContent}>
        {/* Donut Chart and Net Worth */}
        <View style={styles.chartSection}>
          <View style={styles.chartWrapper}>
            <Svg width="90" height="90" viewBox="0 0 90 90">
              <G rotation="-90" origin="45, 45">
                {/* Liability Base */}
                <Circle
                  cx="45" cy="45" r={radius}
                  stroke={theme.danger + '30'}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                {/* Asset Segment */}
                <Circle
                  cx="45" cy="45" r={radius}
                  stroke={theme.success}
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={assetOffset}
                  strokeLinecap="round"
                  fill="none"
                />
              </G>
            </Svg>
            <View style={styles.chartCenter}>
               <Text style={{ color: theme.textSubtle, fontSize: fs(8), fontWeight: '800' }}>ASSET</Text>
               <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '900' }}>{Math.round(assetRatio * 100)}%</Text>
            </View>
          </View>

          <View style={styles.netWorthBox}>
            <Text style={[styles.netWorthLabel, { color: theme.textSubtle, fontSize: fs(10) }]}>ESTIMATED NET WORTH</Text>
            <Text style={[styles.netWorthValue, { color: theme.text, fontSize: fs(24) }]}>
              {currency}{Math.round(netWorth).toLocaleString()}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
              <View style={styles.miniLabelRow}>
                 <ArrowUpRight size={12} color={theme.success} />
                 <Text style={{ color: theme.success, fontSize: fs(10), fontWeight: 'bold' }}>{currency}{Math.round(totals.assets).toLocaleString()}</Text>
              </View>
              <View style={styles.miniLabelRow}>
                 <ArrowDownRight size={12} color={theme.danger} />
                 <Text style={{ color: theme.danger, fontSize: fs(10), fontWeight: 'bold' }}>{currency}{Math.round(totals.liabilities).toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Total Summary Mini-Dashboard */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: theme.success + '10', borderColor: theme.success + '20' }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: theme.success + '15' }]}>
              <ShieldCheck size={16} color={theme.success} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>TOTAL SAVINGS</Text>
              <Text style={[styles.summaryValue, { color: theme.success, fontSize: fs(17) }]}>
                {currency}{Math.round(totals.assets).toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryBox, { backgroundColor: theme.danger + '10', borderColor: theme.danger + '20' }]}>
            <View style={[styles.summaryIconBox, { backgroundColor: theme.danger + '15' }]}>
              <AlertCircle size={16} color={theme.danger} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={[styles.summaryLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>TOTAL LIABILITY</Text>
              <Text style={[styles.summaryValue, { color: theme.danger, fontSize: fs(17) }]}>
                {currency}{Math.round(totals.liabilities).toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Inner Cards Grid */}
        <View style={styles.gridContainer}>
          {stats.map((item, idx) => (
            <TouchableOpacity 
              key={item.type} 
              style={[styles.innerCard, { backgroundColor: theme.background + '80', borderColor: theme.border + '20' }]}
              onPress={() => navigation.navigate('Accounts', { screen: 'AccountDetail', params: { sectionKey: item.type } })}
            >
              <View style={[styles.innerIconBox, { backgroundColor: item.color + '15' }]}>
                <item.icon size={14} color={item.color} />
              </View>
              <View>
                <Text style={[styles.innerLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>{item.label.toUpperCase()}</Text>
                <Text style={[styles.innerValue, { color: theme.text, fontSize: fs(13) }]} numberOfLines={1}>
                  {currency}{Math.round(item.amount).toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  headerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerTitle: {
    fontWeight: '900',
    letterSpacing: -0.5
  },
  mainContent: {
    gap: 20
  },
  chartSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20
  },
  chartWrapper: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center'
  },
  chartCenter: {
    position: 'absolute',
    alignItems: 'center'
  },
  netWorthBox: {
    flex: 1
  },
  netWorthLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2
  },
  netWorthValue: {
    fontWeight: '900',
    letterSpacing: -1
  },
  miniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  innerCard: {
    width: (SLIDE_WIDTH - 48) / 2, // 2 columns minus gap and padding
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1
  },
  innerIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  innerLabel: {
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 1
  },
  innerValue: {
    fontWeight: '900',
    letterSpacing: -0.5
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  summaryIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryLabel: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 0,
  },
  summaryValue: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
