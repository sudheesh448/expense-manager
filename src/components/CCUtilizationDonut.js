import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { getCCUtilizationByMonth } from '../services/storage';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32;

const CCDonutPage = ({ userId, monthKey, label, year }) => {
  const { theme, fs } = useTheme();
  const { activeUser } = useAuth();
  const [data, setData] = useState([]);
  const [activeCard, setActiveCard] = useState(null); // { id, name, used, limit, color }

  useEffect(() => {
    const loadData = async () => {
      const utilData = await getCCUtilizationByMonth(userId, monthKey);
      setData(utilData);
    };
    loadData();
  }, [userId, monthKey]);

  if (data.length === 0) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted, fontStyle: 'italic', fontSize: fs(14) }}>No CC utilization for {label} {year}</Text>
      </View>
    );
  }

  const totalUsed = data.reduce((sum, item) => sum + item.used, 0);
  const totalLimit = data.reduce((sum, item) => sum + item.limit, 0);
  
  if (totalUsed === 0) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted, fontStyle: 'italic', fontSize: fs(14) }}>No CC expenses for {label} {year}</Text>
      </View>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const totalForChart = totalUsed; // Donut represents total CC expenses
  let cumulativePercentage = 0;

  // We show used vs available in the donut.
  // Actually, the user wants "utilisation across all cards and utilisation for each card in different color".
  // This implies the donut is made of usage slices.
  // If we have total limit 100k, and Card A uses 10k, Card B uses 5k.
  // The donut should probably show the 10k, 5k and then the remaining 85k as "Available".

  const segments = data.filter(d => d.used > 0);

  return (
    <View style={styles.page}>
      <Text style={[styles.pageTitle, { color: theme.text, fontSize: fs(16) }]}>CC Utilization ({label} {year})</Text>
      
      <View style={styles.chartContainer}>
        <View style={styles.svgWrapper}>
          <Svg width={120} height={120} viewBox="0 0 140 140">
            <G rotation="-90" origin="70, 70">
              <Circle key="bg" cx="70" cy="70" r={radius} stroke={theme.border} strokeWidth="12" fill="none" opacity={0.3} />
              {segments.map((seg, i) => {
                // Percentage of TOTAL CC EXPENSES, not limit
                const actualPercentage = (seg.used / totalForChart) * 100;
                const visualPercentage = Math.max(actualPercentage, 2); // Minimum visibility 2%
                
                const dashLen = (circumference * visualPercentage) / 100;
                const rotation = (cumulativePercentage / 100) * 360;
                cumulativePercentage += visualPercentage;
                
                return (
                  <Circle
                    key={seg.id || i}
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke={seg.color}
                    strokeWidth="14" // Slightly thicker than background
                    strokeDasharray={`${dashLen} ${circumference}`}
                    strokeDashoffset={0}
                    fill="none"
                    transform={`rotate(${rotation}, 70, 70)`}
                    onPress={() => {
                      if (activeCard?.id === seg.id) setActiveCard(null);
                      else setActiveCard(seg);
                    }}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centerText}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(9), textAlign: 'center' }}>
              {activeCard ? activeCard.name : 'Total Usage'}
            </Text>
            <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold', textAlign: 'center' }}>
              {getCurrencySymbol(activeUser?.currency)}{Math.round(activeCard ? activeCard.used : totalUsed)}
            </Text>
          </View>
        </View>

        <View style={styles.legend}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true} style={{ maxHeight: 120 }}>
            {data.map((item, i) => (
              <TouchableOpacity 
                key={i} 
                style={styles.legendItem}
                onPress={() => {
                  if (activeCard?.id === item.id) setActiveCard(null);
                  else setActiveCard(item);
                }}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.legendText, { color: theme.text, fontSize: fs(11) }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: fs(9) }}>
                    {getCurrencySymbol(activeUser?.currency)}{Math.round(item.used)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default function CCUtilizationDonut({ userId, availableMonths }) {
  const { theme, fs } = useTheme();
  const flatListRef = React.useRef(null);
  
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  
  // Create a 12-month window (6 months before, current, 5 months after)
  const windowMonths = [];
  const now = new Date();
  for (let i = -6; i <= 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    windowMonths.push(d.toISOString().substring(0, 7));
  }

  // Merge with availableMonths and sort/deduplicate
  const allMonths = [...new Set([...windowMonths, ...availableMonths])].sort();

  // Month keys are YYYY-MM
  const monthsData = allMonths.map(mKey => {
    const [y, m] = mKey.split('-').map(Number);
    const dateObj = new Date(y, m - 1, 1);
    return {
      monthKey: mKey,
      label: dateObj.toLocaleString('default', { month: 'short' }),
      year: y.toString()
    };
  });

  const initialIndex = monthsData.findIndex(m => m.monthKey === currentMonthKey);
  const [activeIndex, setActiveIndex] = useState(initialIndex !== -1 ? initialIndex : 0);

  const onScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    if (index >= 0 && index < monthsData.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <FlatList
        ref={flatListRef}
        data={monthsData}
        keyExtractor={(item) => item.monthKey}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialScrollIndex={initialIndex !== -1 ? initialIndex : 0}
        getItemLayout={(data, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <CCDonutPage 
            userId={userId} 
            monthKey={item.monthKey} 
            label={item.label} 
            year={item.year} 
          />
        )}
      />
      
      {/* Pagination Dots */}
      {monthsData.length > 1 && (
        <View style={styles.pagination}>
          {monthsData.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.dot_indicator, 
                { 
                  backgroundColor: i === activeIndex ? theme.primary : theme.border,
                  width: i === activeIndex ? 12 : 6,
                  opacity: i === activeIndex ? 1 : 0.5
                }
              ]} 
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
    paddingBottom: 16
  },
  page: {
    width: SLIDE_WIDTH,
    padding: 16,
    minHeight: 220
  },
  pageTitle: {
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    width: 80
  },
  legend: {
    flex: 1,
    marginLeft: 16,
    gap: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    fontWeight: '500'
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4
  },
  dot_indicator: {
    height: 6,
    borderRadius: 3,
  }
});
