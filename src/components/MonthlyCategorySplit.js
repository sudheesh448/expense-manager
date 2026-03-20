import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { getMonthlyCategorySplit } from '../services/storage';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 32; // Full width minus container padding

const MonthPiePage = ({ userId, monthKey, label, year }) => {
  const { theme, fs } = useTheme();
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [activeCategory, setActiveCategory] = useState(null); // { name, amount, color }

  useEffect(() => {
    const loadData = async () => {
      const split = await getMonthlyCategorySplit(userId, monthKey);
      setData(split);
      setTotal(split.reduce((sum, item) => sum + item.amount, 0));
    };
    loadData();
  }, [userId, monthKey]);

  if (data.length === 0) {
    return (
      <View style={[styles.page, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted, fontStyle: 'italic', fontSize: fs(14) }}>No expenses for {label} {year}</Text>
      </View>
    );
  }

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return (
    <View style={styles.page}>
      <Text style={[styles.pageTitle, { color: theme.text, fontSize: fs(16) }]}>{label} {year} Expenses</Text>
      
      <View style={styles.chartContainer}>
        <View style={styles.svgWrapper}>
          <Svg width={120} height={120} viewBox="0 0 140 140">
            <G rotation="-90" origin="70, 70">
              <Circle cx="70" cy="70" r={radius} stroke={theme.border} strokeWidth="12" fill="none" />
              {data.map((seg, i) => {
                const percentage = (seg.amount / total) * 100;
                const strokeDashoffset = circumference - (circumference * percentage) / 100;
                const rotation = (cumulativePercentage / 100) * 360;
                cumulativePercentage += percentage;
                
                return (
                  <Circle
                    key={i}
                    cx="70"
                    cy="70"
                    r={radius}
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    fill="none"
                    strokeLinecap="round"
                    transform={`rotate(${rotation}, 70, 70)`}
                    onPress={() => {
                      if (activeCategory?.name === seg.category) setActiveCategory(null);
                      else setActiveCategory({ name: seg.category, amount: seg.amount, color: seg.color });
                    }}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centerText}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
              {activeCategory ? activeCategory.name : 'Total'}
            </Text>
            <Text style={{ color: theme.text, fontSize: fs(activeCategory ? 12 : 14), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
              ₹{Math.round(activeCategory ? activeCategory.amount : total)}
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
                  if (activeCategory?.name === item.category) setActiveCategory(null);
                  else setActiveCategory({ name: item.category, amount: item.amount, color: item.color });
                }}
              >
                <View style={[styles.dot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendText, { color: theme.textMuted, fontSize: fs(11) }]}>
                  {item.category}: ₹{Math.round(item.amount)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

export default function MonthlyCategorySplit({ userId, availableMonths }) {
  const { theme, fs } = useTheme();
  const flatListRef = React.useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const currentMonthKey = new Date().toISOString().substring(0, 7);
  
  const monthsData = availableMonths.map(mKey => {
    const dateObj = new Date(parseInt(mKey.split('-')[0]), parseInt(mKey.split('-')[1]) - 1, 1);
    return {
      monthKey: mKey,
      label: dateObj.toLocaleString('default', { month: 'long' }),
      year: mKey.split('-')[0]
    };
  }); // Chronological order

  useEffect(() => {
    const initialIndex = monthsData.findIndex(m => m.monthKey === currentMonthKey);
    if (initialIndex !== -1) {
      setActiveIndex(initialIndex);
      // Small delay to ensure layout is ready
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, []);

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
        getItemLayout={(data, index) => ({
          length: SLIDE_WIDTH,
          offset: SLIDE_WIDTH * index,
          index,
        })}
        renderItem={({ item }) => (
          <MonthPiePage 
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
    alignItems: 'center'
  },
  legend: {
    flex: 1,
    marginLeft: 16,
    gap: 8
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  legendText: {
    flex: 1,
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
