import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, TrendingDown, Target, Zap, ArrowRight, Wallet } from 'lucide-react-native';
import { 
  getAccounts, getTransactions, getExpectedExpenses, 
  getBudgets, getCategories, getDb, stabilizeSIPExpenses, generateAllRecurringExpenses
} from '../../services/storage';
import { generateProjections } from '../../utils/projections';
import { getCurrencySymbol } from '../../utils/currencyUtils';

export default function SavingsOverviewCard({ userId, theme, fs, currency }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ actual: 0, predicted: 0 });

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const database = await getDb();
      // Ensure all recurring and SIP expenses are topped up for the forecast horizon
      await stabilizeSIPExpenses(database, userId);
      await generateAllRecurringExpenses(userId);

      const accounts = await getAccounts(database, userId);
      const transactions = await getTransactions(database, userId);
      const expected = await getExpectedExpenses(userId);
      const budgets = await getBudgets(userId);
      const limitCats = await getCategories(userId, ['CC Limit Blockage', 'CC Limit Recovery', 'EMI Limit Blockage', 'EMI Limit Recovery']);
      const excludeIds = limitCats.map(c => c.id);

      // Generate 12 months: 5 months before + Current month + 6 months forward
      const timeline = generateProjections(accounts, transactions, expected, budgets, 7, 5, excludeIds);
      
      // Index 0-5: Actual Savings (Past 5 months + Current month)
      const actualSavings = timeline.slice(0, 6).reduce((sum, slot) => {
        return sum + (slot.actualInputs - slot.actualOutputs);
      }, 0);

      // Index 6-11: Predicted Savings (Next 6 months)
      const predictedSavings = timeline.slice(6, 12).reduce((sum, slot) => {
        return sum + (slot.totalInputs - slot.totalOutputs);
      }, 0);

      setData({
        actual: actualSavings,
        predicted: predictedSavings
      });
    } catch (error) {
      console.error('Error calculating savings overview:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [userId])
  );

  if (loading) {
    return (
      <View style={[styles.card, { backgroundColor: theme.surface, height: 160, justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const isActualPositive = data.actual >= 0;
  const isPredictedPositive = data.predicted >= 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={[styles.titleIcon, { backgroundColor: theme.primary + '15' }]}>
            <Zap size={18} color={theme.primary} strokeWidth={2.5} />
        </View>
        <Text style={[styles.title, { color: theme.text, fontSize: fs(15) }]}>Savings Overview</Text>
      </View>

      <View style={styles.statsContainer}>
        {/* Actual Savings Card */}
        <View style={[styles.subCard, { backgroundColor: theme.background + '80', borderColor: theme.border + '15' }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(10) }]}>LAST 6 MONTHS</Text>
            <View style={[styles.badge, { backgroundColor: isActualPositive ? theme.success + '15' : theme.danger + '15' }]}>
                {isActualPositive ? <TrendingUp size={10} color={theme.success} /> : <TrendingDown size={10} color={theme.danger} />}
                <Text style={[styles.badgeText, { color: isActualPositive ? theme.success : theme.danger, fontSize: fs(8) }]}>
                    {isActualPositive ? 'SAVED' : 'OVERSPENT'}
                </Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: isActualPositive ? theme.success : theme.danger, fontSize: fs(22) }]}>
            {isActualPositive ? '' : '-'}{currency}{Math.abs(Math.round(data.actual)).toLocaleString()}
          </Text>
          <Text style={[styles.subLabel, { color: theme.textMuted, fontSize: fs(9) }]}>Actual Net Savings</Text>
        </View>

        {/* Predicted Savings Card */}
        <View style={[styles.subCard, { backgroundColor: theme.background + '80', borderColor: theme.border + '15' }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: theme.textSubtle, fontSize: fs(10) }]}>NEXT 6 MONTHS</Text>
            <View style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
                <Target size={10} color={theme.primary} />
                <Text style={[styles.badgeText, { color: theme.primary, fontSize: fs(8) }]}>FORECAST</Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: theme.text, fontSize: fs(22) }]}>
            {isPredictedPositive ? '' : '-'}{currency}{Math.abs(Math.round(data.predicted)).toLocaleString()}
          </Text>
          <Text style={[styles.subLabel, { color: theme.textMuted, fontSize: fs(9) }]}>Projected Potential</Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: theme.border + '15' }]}>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: isActualPositive ? theme.success : theme.danger }} />
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600' }}>
               Aggregate view of past performance vs future roadmap
            </Text>
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
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center'
  },
  title: {
    fontWeight: '900',
    letterSpacing: -0.5
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8
  },
  subCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1
  },
  labelRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 12,
    minHeight: 42,
    justifyContent: 'space-between'
  },
  label: {
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  badgeText: {
    fontWeight: '900',
    letterSpacing: 0.3
  },
  amount: {
    fontWeight: '900',
    letterSpacing: -1,
    marginBottom: 4
  },
  subLabel: {
    fontWeight: '600',
    letterSpacing: 0.3
  },
  footer: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1
  }
});
