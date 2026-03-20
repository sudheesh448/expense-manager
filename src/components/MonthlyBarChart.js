import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

const CHART_HEIGHT = 180;
const BAR_WIDTH = 12;
const BAR_GAP = 4;
const COLUMN_GAP = 20;

export default function MonthlyBarChart({ data }) {
  const { theme, fs } = useTheme();
  const scrollViewRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0) return;
    
    // Find index of current month
    const todayKey = new Date().toISOString().substring(0, 7);
    const currentIndex = data.findIndex(d => d.monthKey === todayKey);
    
    if (currentIndex !== -1) {
      const columnWidth = BAR_WIDTH * 3 + BAR_GAP * 2 + COLUMN_GAP;
      // Scroll so current month is visible with some padding or centered
      // User said: "see previous two months and current month graph then i can scroll"
      // So if current is at index i, we scroll to (i-2) * columnWidth
      const scrollX = Math.max(0, (currentIndex - 2) * columnWidth);
      
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: scrollX, animated: true });
      }, 500);
    } else {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 500);
    }
  }, [data]);

  if (!data || data.length === 0) return null;

  const maxVal = Math.max(...data.map(d => Math.max(d.income, d.expense, d.savings)), 5000);
  
  // Round up maxVal to a nice number for grid lines
  const gridMax = Math.ceil(maxVal / 5000) * 5000;
  const gridLines = [0, gridMax / 2, gridMax];

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text, fontSize: fs(16) }]}>Monthly Trends</Text>
      
      <View style={styles.chartArea}>
        {/* Y-Axis Labels */}
        <View style={styles.yAxis}>
          {gridLines.reverse().map((val, i) => (
            <Text key={i} style={[styles.axisLabel, { color: theme.textSubtle, fontSize: fs(10) }]}>
              {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
            </Text>
          ))}
        </View>

        {/* Scrollable Bar Platform */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {data.map((item, index) => {
            const incomeHeight = (item.income / gridMax) * CHART_HEIGHT;
            const expenseHeight = (item.expense / gridMax) * CHART_HEIGHT;
            const savingsHeight = (item.savings / gridMax) * CHART_HEIGHT;

            return (
              <View key={index} style={styles.monthColumn}>
                <View style={styles.barsContainer}>
                  {/* Income Bar */}
                  <View style={[styles.bar, { height: incomeHeight, backgroundColor: theme.success, width: BAR_WIDTH }]} />
                  {/* Expense Bar */}
                  <View style={[styles.bar, { height: expenseHeight, backgroundColor: theme.danger, width: BAR_WIDTH, marginHorizontal: BAR_GAP }]} />
                  {/* Savings Bar */}
                  <View style={[styles.bar, { height: savingsHeight, backgroundColor: theme.primary, width: BAR_WIDTH }]} />
                </View>
                <Text style={[styles.monthLabel, { color: theme.text, fontSize: fs(11) }]}>{item.label}</Text>
                <Text style={[styles.yearLabel, { color: theme.textSubtle, fontSize: fs(9) }]}>{item.year}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.success }]} />
          <Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(11) }]}>Income</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.danger }]} />
          <Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(11) }]}>Expense</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.legendText, { color: theme.textSubtle, fontSize: fs(11) }]}>Savings</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 },
  title: { fontWeight: 'bold', marginBottom: 20 },
  chartArea: { flexDirection: 'row', height: CHART_HEIGHT + 40 },
  yAxis: { width: 30, justifyContent: 'space-between', paddingBottom: 40, alignItems: 'flex-end', paddingRight: 8 },
  axisLabel: { textAlign: 'right' },
  scrollContent: { paddingLeft: 10, paddingRight: 20, alignItems: 'flex-end' },
  monthColumn: { alignItems: 'center', width: BAR_WIDTH * 3 + BAR_GAP * 2 + COLUMN_GAP },
  barsContainer: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, marginBottom: 8 },
  bar: { borderRadius: 3 },
  monthLabel: { fontWeight: '600' },
  yearLabel: { marginTop: 2 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontWeight: '500' }
});
