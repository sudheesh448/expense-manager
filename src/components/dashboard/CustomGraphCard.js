import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { TrendingUp } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';

const CustomGraphCard = ({ graph, data, activeTooltip, setActiveTooltip, theme, fs }) => {
  const { activeUser } = useAuth();
  if (graph.enabled === false) return null;
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <View key={graph.id} style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <TrendingUp color={theme.primary} size={20} />
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>{graph.name}</Text>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {total === 0 ? (
          <View style={{ flex: 1, height: 140, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.textSubtle, fontStyle: 'italic', fontSize: fs(14), textAlign: 'center' }}>
              No transactions for selected categories this month.
            </Text>
          </View>
        ) : (
          <>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
              <Svg width={140} height={140} viewBox="0 0 140 140">
                <G rotation="-90" origin="70, 70">
                  <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
                  {total > 0 && data.map((item, i) => {
                    const percentage = (item.amount / total) * 100;
                    if (percentage === 0) return null;
                    const radius = 60;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (circumference * percentage) / 100;

                    let cumulativePercentage = 0;
                    for (let j = 0; j < i; j++) {
                      cumulativePercentage += (data[j].amount / total) * 100;
                    }
                    const rotation = (cumulativePercentage / 100) * 360;

                    return (
                      <Circle
                        key={item.category}
                        cx="70" cy="70" r={radius}
                        stroke={item.color}
                        strokeWidth="12"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        fill="none"
                        strokeLinecap="round"
                        transform={`rotate(${rotation}, 70, 70)`}
                        onPress={() => {
                          if (activeTooltip?.label === item.category && activeTooltip?.title === graph.id) setActiveTooltip(null);
                          else setActiveTooltip({ title: graph.id, label: item.category, value: item.amount, color: item.color });
                        }}
                      />
                    );
                  })}
                </G>
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
                <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                  {activeTooltip?.title === graph.id ? activeTooltip.label : 'Total'}
                </Text>
                <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === graph.id ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                  {getCurrencySymbol(activeUser?.currency)}{activeTooltip?.title === graph.id ? Math.round(activeTooltip.value) : Math.round(total)}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {data.map((item, i) => (
                  <TouchableOpacity 
                    key={item.category} 
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
                    onPress={() => {
                      if (activeTooltip?.label === item.category && activeTooltip?.title === graph.id) setActiveTooltip(null);
                      else setActiveTooltip({ title: graph.id, label: item.category, value: item.amount, color: item.color });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color }} />
                      <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{item.category}</Text>
                    </View>
                    <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>{getCurrencySymbol(activeUser?.currency)}{item.amount.toFixed(0)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  sectionTitle: { fontWeight: 'bold' }
});

export default CustomGraphCard;
