import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, Dimensions, FlatList, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { PieChart as PieIcon, CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import Svg, { G, Circle, Text as SvgText } from 'react-native-svg';
import { format, startOfMonth, isSameMonth } from 'date-fns';
import { getDb, getTransactionsByMonth, getCategories } from '../../services/storage';

const { width } = Dimensions.get('window');
const SLIDE_WIDTH = width - 72; // Accounting for card padding (20*2) and some margin

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e', '#14b8a6', '#f97316'];

/**
 * Renders the actual chart and legend for a specific month.
 */
function CustomGraphSlide({ userId, theme, fs, currency, customGraph, monthKey, refreshKey }) {
  const [isFetching, setIsFetching] = useState(false);
  const [data, setData] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);

  const loadData = async () => {
    if (!userId || !customGraph) return;
    setIsFetching(true);
    try {
      const allCategories = await getCategories(userId, 'ALL');
      const targetCategoryIds = customGraph.categoryIds || [];
      const transactions = await getTransactionsByMonth(userId, monthKey);
      
      const filtered = transactions.filter(t => targetCategoryIds.includes(t.categoryId));
      const grouping = {};
      
      // Initialize all target categories with 0
      targetCategoryIds.forEach(id => {
        const cat = allCategories.find(c => c.id === id);
        if (cat) grouping[cat.name] = 0;
      });

      filtered.forEach(t => {
        const cat = allCategories.find(c => c.id === t.categoryId);
        if (cat) {
          grouping[cat.name] = (grouping[cat.name] || 0) + (t.amount || 0);
        }
      });

      const chartData = Object.keys(grouping).map((name, index) => ({
        name,
        amount: grouping[name],
        color: COLORS[index % COLORS.length]
      }));

      setData(chartData);
      setActiveSegment(null);
    } catch (error) {
      console.error('Error loading custom graph slide data:', error);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId, monthKey, customGraph.id, refreshKey]);

  if (isFetching) {
    return (
      <View style={[styles.slide, { width: SLIDE_WIDTH, justifyContent: 'center' }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={[styles.slide, { width: SLIDE_WIDTH, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontStyle: 'italic' }}>No categories selected for this graph</Text>
      </View>
    );
  }

  const totalAmount = data.reduce((sum, d) => sum + d.amount, 0);
  const radius = 50;
  const strokeWidth = 15;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return (
    <View style={[styles.slide, { width: SLIDE_WIDTH }]}>
      <View style={styles.centeredContent}>
        <View style={styles.chartWrapperLarge}>
          <Svg width={180} height={180} viewBox="0 0 140 140">
            <G rotation="-90" origin="70, 70">
              <Circle cx="70" cy="70" r={radius} stroke={theme.border + '30'} strokeWidth={strokeWidth} fill="none" />
              {totalAmount > 0 && data.map((seg, i) => {
                const percentage = (seg.amount / totalAmount) * 100;
                const strokeDasharray = (circumference * percentage) / 100;
                const rotation = (cumulativePercentage / 100) * 360;
                cumulativePercentage += percentage;
                const isActive = activeSegment?.name === seg.name;

                return (
                  <Circle
                    key={seg.name}
                    cx="70" cy="70" r={radius}
                    stroke={seg.color}
                    strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                    strokeDasharray={`${strokeDasharray} ${circumference}`}
                    strokeDashoffset={0}
                    fill="none"
                    transform={`rotate(${rotation}, 70, 70)`}
                    onPress={() => setActiveSegment(isActive ? null : seg)}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={styles.centerTextLarge}>
             <Text style={{ color: activeSegment ? activeSegment.color : theme.text, fontSize: fs(10), fontWeight: '600', textAlign: 'center' }} numberOfLines={1}>
                {activeSegment ? activeSegment.name : 'Total'}
              </Text>
              <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                {currency}{Math.round(activeSegment ? activeSegment.amount : totalAmount).toLocaleString()}
              </Text>
          </View>
        </View>

        <View style={{ width: '100%', marginTop: 15 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalLegend}>
            {data.map((seg) => (
              <TouchableOpacity 
                key={seg.name} 
                style={styles.legendItemSmall}
                onPress={() => setActiveSegment(activeSegment?.name === seg.name ? null : seg)}
              >
                <View style={[styles.dot, { backgroundColor: seg.color }]} />
                <Text style={[styles.legendName, { color: theme.text, fontSize: fs(10) }]}>{seg.name}</Text>
                <Text style={{ color: theme.textSubtle, fontSize: fs(9), fontWeight: '600', marginLeft: 4 }}>
                  {Math.round((seg.amount / (totalAmount || 1)) * 100)}%
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

export default function CustomGraphCard({ userId, theme, fs, currency, customGraph }) {
  const isScrollable = customGraph.isScrollable !== false;
  const flatListRef = useRef(null);
  
  // Generate Timeline window
  const monthsList = useMemo(() => {
    const list = [];
    const years = [2024, 2025, 2026];
    const now = startOfMonth(new Date());
    for (const y of years) {
      for (let m = 0; m < 12; m++) {
        const d = new Date(y, m, 1);
        list.push({
          monthKey: format(d, 'yyyy-MM'),
          label: format(d, 'MMMM yyyy'),
          year: y,
          monthIdx: m,
          id: format(d, 'yyyy-MM'),
          isCurrent: isSameMonth(now, d)
        });
      }
    }
    return list;
  }, []);

  const currentMonthIndex = monthsList.findIndex(m => m.isCurrent);
  const [activeIndex, setActiveIndex] = useState(currentMonthIndex !== -1 ? currentMonthIndex : monthsList.length - 1);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  const onScroll = (event) => {
    if (!isScrollable) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SLIDE_WIDTH);
    if (index >= 0 && index < monthsList.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const jumpToMonth = (index) => {
    setActiveIndex(index);
    setShowPicker(false);
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }, 100);
  };

  // Fixed monthly logic
  const activeMonth = isScrollable ? monthsList[activeIndex] : monthsList.find(m => m.isCurrent) || monthsList[monthsList.length-1];

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={[styles.titleIcon, { backgroundColor: theme.primary + '15' }]}>
                <PieIcon size={18} color={theme.primary} strokeWidth={2.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.text, fontSize: fs(15) }]} numberOfLines={1}>{customGraph.name}</Text>
              <Text style={{ color: theme.textSubtle, fontSize: fs(11), fontWeight: '600' }}>{activeMonth.label}</Text>
            </View>
        </View>
        
        {isScrollable && (
          <TouchableOpacity 
            style={[styles.pickerBtn, { backgroundColor: theme.primary + '10' }]}
            onPress={() => setShowPicker(true)}
          >
            <CalendarDays size={18} color={theme.primary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={{ marginTop: 10 }}>
        <FlatList
          ref={flatListRef}
          data={isScrollable ? monthsList : [activeMonth]}
          horizontal
          pagingEnabled
          scrollEnabled={isScrollable}
          onScroll={onScroll}
          scrollEventThrottle={16}
          initialScrollIndex={isScrollable ? activeIndex : 0}
          getItemLayout={(data, index) => ({ length: SLIDE_WIDTH, offset: SLIDE_WIDTH * index, index })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CustomGraphSlide 
              userId={userId}
              theme={theme}
              fs={fs}
              currency={currency}
              customGraph={customGraph}
              monthKey={item.monthKey}
              refreshKey={refreshKey}
            />
          )}
        />
      </View>

      <Modal visible={showPicker} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
              <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, maxHeight: '80%' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold' }}>Go to Month</Text>
                    <TouchableOpacity onPress={() => setShowPicker(false)}><X size={24} color={theme.text} /></TouchableOpacity>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, marginBottom: 20 }}>
                      <TouchableOpacity onPress={() => setPickerYear(prev => prev - 1)}><ChevronLeft color={theme.text} /></TouchableOpacity>
                      <Text style={{ fontSize: fs(24), fontWeight: 'bold', color: theme.primary }}>{pickerYear}</Text>
                      <TouchableOpacity onPress={() => setPickerYear(prev => prev + 1)}><ChevronRight color={theme.text} /></TouchableOpacity>
                  </View>

                  <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                      {Array.from({ length: 12 }).map((_, i) => {
                          const mKey = `${pickerYear}-${String(i + 1).padStart(2, '0')}`;
                          const idx = monthsList.findIndex(x => x.monthKey === mKey);
                          const isDisabled = idx === -1;
                          
                          return (
                              <TouchableOpacity 
                                  key={i} 
                                  style={[
                                      styles.monthBtn, 
                                      { width: '30%', backgroundColor: theme.border + '30' },
                                      idx === activeIndex && { backgroundColor: theme.primary }
                                  ]}
                                  disabled={isDisabled}
                                  onPress={() => jumpToMonth(idx)}
                              >
                                  <Text style={{ color: idx === activeIndex ? 'white' : (isDisabled ? theme.textMuted : theme.text), fontWeight: 'bold' }}>
                                      {format(new Date(2000, i, 1), 'MMM')}
                                  </Text>
                              </TouchableOpacity>
                          );
                      })}
                  </ScrollView>
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12
  },
  titleIcon: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center'
  },
  title: {
    fontWeight: '900', letterSpacing: -0.5,
  },
  pickerBtn: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center'
  },
  slide: {
    minHeight: 220,
  },
  centeredContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row', alignItems: 'center', gap: 15
  },
  chartWrapperLarge: {
    width: 200, height: 200, justifyContent: 'center', alignItems: 'center'
  },
  centerTextLarge: {
    position: 'absolute', width: 80, alignItems: 'center'
  },
  horizontalLegend: {
    paddingHorizontal: 10,
    marginTop: 10,
    gap: 12,
  },
  legendItemSmall: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)'
  },
  legend: {
    flex: 1, gap: 4
  },
  legendItem: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, marginRight: 6
  },
  legendName: {
    fontWeight: '700',
  },
  monthBtn: {
      paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 10
  }
});
