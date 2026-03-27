import { ArrowUpRight, Calendar, PieChart } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import {
  getAccounts, getCCAccountDueInfo, getDb,
  getTransactionsByMonth
} from '../../services/storage';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;

const DonutChart = ({ data, total, theme, fs, currency }) => {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return (
    <View style={styles.chartWrapper}>
      <Svg width={90} height={90} viewBox="0 0 100 100">
        <G rotation="-90" origin="50, 50">
          <Circle cx="50" cy="50" r={radius} stroke={theme.border} strokeWidth="8" fill="none" opacity={0.1} />
          {data.map((seg, i) => {
            if (seg.value <= 0) return null;
            const percentage = (seg.value / (total || 1)) * 100;
            const dashLen = (circumference * percentage) / 100;
            const rotation = (cumulativePercentage / 100) * 360;
            cumulativePercentage += percentage;

            return (
              <Circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                stroke={seg.color}
                strokeWidth="10"
                strokeDasharray={`${dashLen} ${circumference}`}
                strokeDashoffset={0}
                fill="none"
                transform={`rotate(${rotation}, 50, 50)`}
              />
            );
          })}
        </G>
      </Svg>
      <View style={styles.centerText}>
        <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: 'bold' }}>
          {currency}{total > 1000 ? (total / 1000).toFixed(1) + 'k' : Math.round(total)}
        </Text>
      </View>
    </View>
  );
};

export default function MonthlyInsights({ userId, monthKey, label, dateObj, isActive, theme, fs, currency, onPressSelector, refreshKey }) {
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [summary, setSummary] = useState({ income: 0, outflow: 0, consumption: 0, ccBilled: 0, ccUnbilled: 0, ccLimit: 0, sip: 0 });
  const [consumption, setConsumption] = useState({ direct: 0, cc: 0, emi: 0 });

  const loadData = async (isMounted) => {
    setIsFetching(true);
    try {
      const db = await getDb();
      const accounts = await getAccounts(db, userId);
      const monthTx = await getTransactionsByMonth(userId, monthKey);

      const expActual = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
      const ccExpActual = monthTx.filter(t => t.type === 'CC_EXPENSE').reduce((s, t) => s + (t.amount || 0), 0);
      const emiActual = monthTx.filter(t => t.type === 'EMI_PAYMENT').reduce((s, t) => s + (t.amount || 0), 0);
      const ccPayActual = monthTx.filter(t => t.type === 'CC_PAY').reduce((s, t) => s + (t.amount || 0), 0);
      const incomeActual = monthTx.filter(t => t.type === 'INCOME' || t.type === 'loan income' || t.type === 'BORROWED').reduce((s, t) => s + (t.amount || 0), 0);
      const sipActual = monthTx.filter(t => t.type === 'SIP_PAY').reduce((s, t) => s + (t.amount || 0), 0);
      const lendedActual = monthTx.filter(t => t.type === 'lended').reduce((s, t) => s + (t.amount || 0), 0);

      const bankAccIds = accounts.filter(a => a.type === 'BANK').map(a => a.id);
      const transfersIn = monthTx.filter(t => (t.type === 'TRANSFER' || t.type === 'PAYMENT' || t.type === 'CC_PAY') && bankAccIds.includes(t.toAccountId)).reduce((s, t) => s + (t.amount || 0), 0);
      const transfersOut = monthTx.filter(t => (t.type === 'TRANSFER' || t.type === 'PAYMENT' || t.type === 'CC_PAY') && bankAccIds.includes(t.accountId) && !bankAccIds.includes(t.toAccountId)).reduce((s, t) => s + (t.amount || 0), 0);

      const totalIncome = incomeActual + transfersIn;
      const totalOutflow = expActual + emiActual + ccPayActual + transfersOut + lendedActual;

      let aggCCDue = 0;
      let aggCCUsage = 0;
      let aggCCLimit = 0;
      const ccAccs = accounts.filter(a => a.type === 'CREDIT_CARD');
      for (const card of ccAccs) {
        aggCCLimit += (card.creditLimit || 0);
        const info = await getCCAccountDueInfo(userId, card.id, dateObj);
        aggCCDue += info.totalAmountDue;
        aggCCUsage += info.currentCycleUsage;
      }

      if (isMounted) {
        setSummary({
          income: totalIncome,
          outflow: totalOutflow,
          sip: sipActual,
          consumption: expActual + ccExpActual + emiActual + lendedActual,
          ccBilled: aggCCDue,
          ccUnbilled: aggCCUsage,
          ccLimit: aggCCLimit
        });
        setConsumption({ direct: expActual, cc: ccExpActual, emi: emiActual });
        setIsFetching(false);
      }
    } catch (e) {
      console.error('Error loading MonthlyInsights data:', e);
      if (isMounted) setIsFetching(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    if (isActive && (!hasLoaded || (refreshKey > 0))) {
      loadData(isMounted);
      setHasLoaded(true);
    }
    return () => { isMounted = false; };
  }, [isActive, userId, monthKey, refreshKey]);

  if (!isActive && !hasLoaded) {
    return (
      <View style={[styles.mainCard, { backgroundColor: theme.surface, height: 280, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={theme.primary} opacity={0.3} />
        <Text style={{ color: theme.textSubtle, fontSize: fs(10), marginTop: 12 }}>{label}</Text>
      </View>
    );
  }

  const consumptionTotal = consumption.direct + consumption.cc + consumption.emi;
  const consumptionSegments = [
    { label: 'Bank', value: consumption.direct, color: theme.danger },
    { label: 'CC', value: consumption.cc, color: '#8b5cf6' },
    { label: 'EMI', value: consumption.emi, color: '#f59e0b' }
  ];

  return (
    <View style={[styles.mainCard, { backgroundColor: theme.surface }]}>
      <TouchableOpacity style={styles.header} onPress={onPressSelector} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <View style={styles.headerTitle}>
            <PieChart size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold' }}>
              Monthly Insights: {label}
            </Text>
          </View>
          <Calendar size={18} color={theme.primary} />
        </View>
      </TouchableOpacity>

      <View style={{ gap: 20 }}>
        {/* Bar 1: Cash Flow */}
        <View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.textSubtle, fontSize: fs(9) }]}>CASH FLOW (Total Income: {currency}{Math.round(summary.income)})</Text>
            <Text style={{ color: theme.success, fontSize: fs(9), fontWeight: 'bold' }}>Surplus: {currency}{Math.round(summary.income - summary.outflow - summary.sip)}</Text>
          </View>
          <View style={[styles.barBg, { flexDirection: 'row' }]}>
            {summary.outflow > 0 && <View style={{ flex: summary.outflow, backgroundColor: theme.danger }} />}
            {summary.sip > 0 && <View style={{ flex: summary.sip, backgroundColor: theme.primary }} />}
            {Math.max(0, summary.income - summary.outflow - summary.sip) > 0 && (
              <View style={{ flex: Math.max(0, summary.income - summary.outflow - summary.sip), backgroundColor: theme.success }} />
            )}
            {summary.income === 0 && <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />}
          </View>
          <View style={styles.miniLegend}>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: theme.danger }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>Outflow</Text></View>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: theme.primary }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>Investments</Text></View>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: theme.success }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>Surplus</Text></View>
          </View>
        </View>

        {/* Bar 2: Consumption */}
        <View>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={[styles.cardTitle, { color: theme.textSubtle, fontSize: fs(9) }]}>CONSUMPTION (Total: {currency}{Math.round(summary.consumption)})</Text>
            <Text style={{ color: theme.text, fontSize: fs(9), fontWeight: 'bold' }}>{Math.round(summary.consumption > 0 ? (summary.consumption / (summary.income || 1)) * 100 : 0)}% of Income</Text>
          </View>
          <View style={[styles.barBg, { flexDirection: 'row' }]}>
            {consumption.direct > 0 && <View style={{ flex: consumption.direct, backgroundColor: '#22c55e' }} />}
            {consumption.cc > 0 && <View style={{ flex: consumption.cc, backgroundColor: '#8b5cf6' }} />}
            {consumption.emi > 0 && <View style={{ flex: consumption.emi, backgroundColor: '#f59e0b' }} />}
            {summary.consumption === 0 && <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />}
          </View>
          <View style={styles.miniLegend}>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#22c55e' }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>Bank</Text></View>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#8b5cf6' }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>CC</Text></View>
             <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: '#f59e0b' }]} /><Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(8) }]}>EMI</Text></View>
          </View>
        </View>
      </View>

      <View style={styles.wideSection}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={[styles.cardTitle, { color: theme.textSubtle, fontSize: fs(9) }]}>CREDIT CARD STATUS (AGGR.)</Text>
          <Text style={{ color: '#8b5cf6', fontSize: fs(9), fontWeight: 'bold' }}>Total Due: {currency}{Math.round(summary.ccBilled + summary.ccUnbilled)}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(8), marginBottom: 2 }}>BILLED DUE</Text>
            <Text style={{ color: '#8b5cf6', fontSize: fs(14), fontWeight: 'bold' }}>{currency}{Math.round(summary.ccBilled)}</Text>
          </View>
          <View style={{ width: 1, backgroundColor: theme.border, opacity: 0.2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(8), marginBottom: 2 }}>UNBILLED</Text>
            <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold' }}>{currency}{Math.round(summary.ccUnbilled)}</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <View style={[styles.barBg, { flexDirection: 'row' }]}>
              {summary.ccBilled > 0 && <View style={{ flex: summary.ccBilled, backgroundColor: '#8b5cf6' }} />}
              {summary.ccUnbilled > 0 && <View style={{ flex: summary.ccUnbilled, backgroundColor: theme.primarySubtle }} />}
              {(summary.ccBilled === 0 && summary.ccUnbilled === 0) && <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.05)' }} />}
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(7), marginTop: 2, textAlign: 'center' }}>Billed vs Unbilled</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mainCard: { borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginHorizontal: 2, height: 280, marginBottom: 20 },
  header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  section: { flex: 1, minHeight: 120, justifyContent: 'space-between' },
  wideSection: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 12 },
  cardTitle: { fontWeight: 'bold', letterSpacing: 0.5 },
  chartWrapper: { alignItems: 'center', justifyContent: 'center', marginVertical: 4 },
  centerText: { position: 'absolute' },
  miniLegend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendText: { fontWeight: '500' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  barBg: { height: 10, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 }
});
