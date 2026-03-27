import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CreditCard, AlertCircle, Clock } from 'lucide-react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { getAccounts, getCCAccountDueInfo, getDb } from '../../services/storage';

const COLORS = ['#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

export default function CreditCardStatusCard({ userId, theme, fs, currency, mode = 'dues' }) {
  const [isFetching, setIsFetching] = useState(false);
  const [cards, setCards] = useState([]);
  const [activeSegment, setActiveSegment] = useState(null);

  const isDuesMode = mode === 'dues';
  const title = isDuesMode ? 'Credit Card Dues' : 'Credit Card Total';
  const titleIconColor = isDuesMode ? theme.danger : '#8b5cf6';

  const loadData = async () => {
    if (!userId) return;
    setIsFetching(true);
    try {
      const db = await getDb();
      const allAccounts = await getAccounts(db, userId);
      const ccAccounts = allAccounts.filter(a => a.type === 'CREDIT_CARD');
      
      const cardData = await Promise.all(
        ccAccounts.map(async (acc, index) => {
          const dueInfo = await getCCAccountDueInfo(userId, acc.id);
          const amount = isDuesMode ? dueInfo.totalAmountDue : (dueInfo.totalAmountDue + dueInfo.currentCycleUsage);
          return {
            id: acc.id,
            name: acc.name,
            amount: amount,
            color: COLORS[index % COLORS.length]
          };
        })
      );
      
      setCards(cardData);
      setActiveSegment(null);
    } catch (error) {
      console.error('Error loading CC status card:', error);
    } finally {
      setIsFetching(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [userId, mode])
  );

  // If we found NO CC accounts at all, then hide the entire component
  if (cards.length === 0 && !isFetching) return null;

  const totalAmount = cards.reduce((sum, c) => sum + c.amount, 0);
  const radius = 50;
  const strokeWidth = 15;
  const circumference = 2 * Math.PI * radius;
  let cumulativePercentage = 0;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={[styles.titleIcon, { backgroundColor: titleIconColor + '15' }]}>
                <CreditCard size={18} color={titleIconColor} strokeWidth={2.5} />
            </View>
            <Text style={[styles.title, { color: theme.text, fontSize: fs(15) }]}>{title}</Text>
        </View>
      </View>

      {isFetching && cards.length === 0 ? (
        <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 30 }} />
      ) : (
        <View style={styles.centeredContent}>
          <View style={styles.chartWrapperLarge}>
            <Svg width={180} height={180} viewBox="0 0 140 140">
              <G rotation="-90" origin="70, 70">
                <Circle cx="70" cy="70" r={radius} stroke={theme.border + '30'} strokeWidth={strokeWidth} fill="none" />
                {totalAmount === 0 ? (
                  <Circle
                    cx="70" cy="70" r={radius}
                    stroke={theme.border + '40'}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={0}
                    fill="none"
                  />
                ) : (
                  cards.filter(c => c.amount > 0).map((card) => {
                    const percentage = (card.amount / totalAmount) * 100;
                    const strokeDasharray = (circumference * percentage) / 100;
                    const rotation = (cumulativePercentage / 100) * 360;
                    cumulativePercentage += percentage;
                    const isActive = activeSegment?.id === card.id;

                    return (
                      <Circle
                        key={card.id}
                        cx="70" cy="70" r={radius}
                        stroke={card.color}
                        strokeWidth={isActive ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={`${strokeDasharray} ${circumference}`}
                        strokeDashoffset={0}
                        fill="none"
                        transform={`rotate(${rotation}, 70, 70)`}
                        onPress={() => setActiveSegment(isActive ? null : card)}
                      />
                    );
                  })
                )}
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
              {cards.map((card) => (
                <TouchableOpacity 
                  key={card.id} 
                  style={styles.legendItemSmall}
                  onPress={() => setActiveSegment(activeSegment?.id === card.id ? null : card)}
                >
                  <View style={[styles.dot, { backgroundColor: totalAmount === 0 ? theme.border : card.color, opacity: card.amount > 0 ? 1 : 0.3 }]} />
                  <Text style={[styles.legendName, { color: theme.text, fontSize: fs(10), opacity: card.amount > 0 ? 1 : 0.5 }]}>{card.name}</Text>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(9), fontWeight: '600', marginLeft: 4 }}>
                    {totalAmount > 0 ? `${Math.round((card.amount / totalAmount) * 100)}%` : '0%'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <View style={[styles.footer, { borderTopColor: theme.border + '15' }]}>
         <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: '600' }}>
            {isDuesMode 
              ? 'Distribution of your currently billed credit card dues' 
              : 'Distribution of your total outstanding utilization'}
         </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24, padding: 20, marginBottom: 20,
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12
  },
  titleIcon: {
    width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center'
  },
  title: {
    fontWeight: '900', letterSpacing: -0.5
  },
  centeredContent: {
    alignItems: 'center', justifyContent: 'center',
  },
  chartWrapperLarge: {
    width: 200, height: 200, justifyContent: 'center', alignItems: 'center'
  },
  centerTextLarge: {
    position: 'absolute', width: 90, alignItems: 'center'
  },
  horizontalLegend: {
    paddingHorizontal: 10, marginTop: 10, gap: 12,
  },
  legendItemSmall: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.03)'
  },
  dot: {
    width: 6, height: 6, borderRadius: 3, marginRight: 6
  },
  legendName: {
    fontWeight: '700',
  },
  footer: {
    marginTop: 15, paddingTop: 12, borderTopWidth: 1
  }
});
