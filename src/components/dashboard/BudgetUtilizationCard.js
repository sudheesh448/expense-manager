import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions, TouchableOpacity, FlatList, Modal, ScrollView } from 'react-native';
import { BarChart3, AlertCircle, CheckCircle2, TrendingUp, Calendar } from 'lucide-react-native';
import { getBudgetUtilization } from '../../services/storage';
import { useTheme } from '../../context/ThemeContext';
import { format, isSameMonth, startOfMonth } from 'date-fns';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;

const BudgetUtilizationSlide = ({ userId, monthKey, theme, fs, currency, refreshKey, isActive, onPressSelector, monthLabel, budgetSettings }) => {
  const [budgets, setBudgets] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const { sortOrder, defaultItems } = budgetSettings || { sortOrder: [], defaultItems: 3 };

  const loadData = useCallback(async (isMounted) => {
    setIsFetching(true);
    try {
      const data = await getBudgetUtilization(userId, monthKey);
      if (isMounted) {
        const sortedData = data.sort((a, b) => {
          if (sortOrder && sortOrder.length > 0) {
            const idxA = sortOrder.indexOf(a.id);
            const idxB = sortOrder.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
          }
          const percA = a.amount > 0 ? a.utilized / a.amount : 0;
          const percB = b.amount > 0 ? b.utilized / b.amount : 0;
          return percB - percA;
        });
        setBudgets(sortedData);
        setIsFetching(false);
      }
    } catch (error) {
      console.error('Error loading budget utilization:', error);
      if (isMounted) setIsFetching(false);
    }
  }, [userId, monthKey, sortOrder]);

  useEffect(() => {
    let isMounted = true;
    if (isActive && (!hasLoaded || refreshKey > 0)) {
      loadData(isMounted);
      setHasLoaded(true);
    }
    return () => { isMounted = false; };
  }, [isActive, userId, monthKey, refreshKey, hasLoaded, loadData]);

  const renderContent = () => {
    if (isFetching && budgets.length === 0) {
      const loadingHeight = Math.min(defaultItems || 3, 3) * 77;
      return (
        <View style={{ height: loadingHeight, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    if (budgets.length === 0) {
      return (
        <View style={{ height: 120, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontStyle: 'italic' }}>No budgets defined for this month</Text>
        </View>
      );
    }

    return (
      <ScrollView 
        style={{ maxHeight: (defaultItems || 3) * 77 }} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={true}
      >
        <View style={styles.content}>
          {budgets.map((budget) => {
          const percentage = budget.amount > 0 ? (budget.utilized / budget.amount) * 100 : 0;
          const isExceeded = budget.utilized > budget.amount;
          const remaining = budget.amount - budget.utilized;
          
          let progressColor = theme.success;
          if (percentage >= 100) progressColor = theme.danger;
          else if (percentage >= 80) progressColor = '#f59e0b'; // Amber

          return (
            <View key={budget.id} style={styles.budgetItem}>
              <View style={styles.budgetHeader}>
                <Text style={[styles.budgetName, { color: theme.text, fontSize: fs(13) }]}>{budget.name}</Text>
                <Text style={[styles.budgetAmount, { color: theme.textSubtle, fontSize: fs(11) }]}>
                  {currency}{Math.round(budget.utilized).toLocaleString()} / {currency}{Math.round(budget.amount).toLocaleString()}
                </Text>
              </View>

              <View style={[styles.progressBarBg, { backgroundColor: theme.border + '20' }]}>
                 <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${Math.min(100, percentage)}%`, 
                      backgroundColor: progressColor,
                    }
                  ]} 
                />
              </View>

              <View style={styles.budgetFooter}>
                {isExceeded ? (
                  <View style={styles.statusRow}>
                    <AlertCircle size={10} color={theme.danger} />
                    <Text style={[styles.statusText, { color: theme.danger, fontSize: fs(10) }]}>
                      Exceeded by {currency}{Math.round(Math.abs(remaining)).toLocaleString()}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.statusRow}>
                    <CheckCircle2 size={10} color={theme.success} />
                    <Text style={[styles.statusText, { color: theme.success, fontSize: fs(10) }]}>
                      {currency}{Math.round(remaining).toLocaleString()} left
                    </Text>
                  </View>
                )}
                <View style={[styles.percentageBadge, { backgroundColor: progressColor + '15' }]}>
                    <Text style={[styles.percentageText, { color: progressColor, fontSize: fs(10) }]}>
                    {Math.round(percentage)}%
                    </Text>
                </View>
              </View>
            </View>
          );
        })}
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={[styles.slideCard, { backgroundColor: theme.surface }]}>
      <TouchableOpacity style={styles.header} onPress={onPressSelector} activeOpacity={0.7}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <View style={styles.headerTitle}>
            <BarChart3 size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold' }}>
              Budget Utilization: {monthLabel}
            </Text>
          </View>
          <Calendar size={18} color={theme.primary} />
        </View>
      </TouchableOpacity>

      {renderContent()}

      <View style={[styles.footer, { borderTopColor: theme.border + '15' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={12} color={theme.primary} />
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600' }}>
               Swipe to browse months
            </Text>
          </View>
      </View>
    </View>
  );
};

export default function BudgetUtilizationCard({ userId, theme, fs, currency, refreshKey }) {
  const { budgetGraphSettings } = useTheme();
  const [monthsList, setMonthsList] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const flatListRef = useRef(null);

  const years = useMemo(() => [2024, 2025, 2026], []);

  useEffect(() => {
    const list = [];
    const now = startOfMonth(new Date());
    
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        list.push({
          monthKey: format(d, 'yyyy-MM'),
          label: format(d, 'MMMM yyyy'),
          monthName: format(d, 'MMM'),
          year: y,
          monthIdx: m,
          dateObj: d,
          id: format(d, 'yyyy-MM'),
          isCurrent: isSameMonth(now, d)
        });
      }
    }
    setMonthsList(list);
    const currIdx = list.findIndex(m => m.isCurrent);
    if (currIdx !== -1) {
      setActiveIndex(currIdx);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: currIdx, animated: false });
      }, 500);
    }
  }, [years]);

  const onScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    if (index >= 0 && index < monthsList.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const jumpToMonth = (index) => {
    setActiveIndex(index);
    setShowMonthSelector(false);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <FlatList
        ref={flatListRef}
        data={monthsList}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={item => item.id}
        getItemLayout={(data, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <View style={{ width: SLIDE_WIDTH }}>
            <BudgetUtilizationSlide 
              userId={userId}
              monthKey={item.monthKey}
              monthLabel={item.label}
              theme={theme}
              fs={fs}
              currency={currency}
              refreshKey={refreshKey}
              isActive={activeIndex === index}
              onPressSelector={() => setShowMonthSelector(true)}
              budgetSettings={budgetGraphSettings}
            />
          </View>
        )}
      />

      {/* Internal Month Selector Modal */}
      <Modal visible={showMonthSelector} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, maxHeight: '80%' }}>
                <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold', marginBottom: 16 }}>Go to Month (Budgets)</Text>
                
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {years.map(y => (
                        <TouchableOpacity 
                            key={y} 
                            onPress={() => setPickerYear(y)}
                            style={{ 
                                paddingVertical: 8, paddingHorizontal: 16, 
                                backgroundColor: pickerYear === y ? theme.primary : theme.border, 
                                borderRadius: 8, opacity: pickerYear === y ? 1 : 0.4 
                            }}
                        >
                            <Text style={{ color: pickerYear === y ? '#fff' : theme.text, fontWeight: 'bold' }}>{y}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                    {Array.from({ length: 12 }).map((_, mIdx) => {
                        const date = new Date(pickerYear, mIdx, 1);
                        const mLabel = format(date, 'MMM');
                        const targetIdx = monthsList.findIndex(m => m.year === pickerYear && m.monthIdx === mIdx);
                        const isCurrent = isSameMonth(new Date(), date);
                        const isSelected = activeIndex === targetIdx;

                        return (
                            <TouchableOpacity 
                                key={mIdx} 
                                onPress={() => jumpToMonth(targetIdx)}
                                style={{ 
                                    width: '30%', height: 50, justifyContent: 'center', alignItems: 'center',
                                    backgroundColor: isSelected ? theme.primarySubtle : (isCurrent ? 'rgba(0,0,0,0.02)' : 'transparent'),
                                    borderWidth: 1, borderColor: isCurrent ? theme.primary : theme.border,
                                    borderRadius: 12, opacity: targetIdx === -1 ? 0.2 : 1
                                }}
                                disabled={targetIdx === -1}
                            >
                                <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }}>
                                    {mLabel}
                                </Text>
                                {isCurrent && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.primary, marginTop: 2 }} />}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <TouchableOpacity onPress={() => setShowMonthSelector(false)} style={{ marginTop: 24, padding: 12, alignItems: 'center' }}>
                     <Text style={{ color: theme.textSubtle }}>Cancel</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  slideCard: { borderRadius: 16, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, marginHorizontal: 2, minHeight: 180 },
  header: { marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  headerTitle: { flexDirection: 'row', alignItems: 'center' },
  content: {
    gap: 16,
    marginBottom: 8
  },
  budgetItem: {
    gap: 8,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  budgetName: {
    fontWeight: '700',
  },
  budgetAmount: {
    fontWeight: '600',
  },
  progressBarBg: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontWeight: '700',
  },
  percentageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  percentageText: {
    fontWeight: '900',
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)'
  }
});
