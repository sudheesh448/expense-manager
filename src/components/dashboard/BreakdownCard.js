import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { getCurrencySymbol } from '../../utils/currencyUtils';

const BreakdownCard = ({ 
  title, 
  icon: Icon, 
  iconColor, 
  overallTotal, 
  segments, 
  groups, 
  activeTooltip, 
  setActiveTooltip, 
  tooltipTitle,
  theme, 
  fs 
}) => {
  const { activeUser } = useAuth();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        {Icon && <Icon color={iconColor} size={20} />}
        <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>{title}</Text>
      </View>
      
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <G rotation="-90" origin="70, 70">
              <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
              {overallTotal > 0 && segments.map((seg, i) => {
                const percentage = (seg.value / overallTotal) * 100;
                if (percentage === 0) return null;
                const radius = 60;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (circumference * percentage) / 100;
                
                let cumulativePercentage = 0;
                for (let j = 0; j < i; j++) {
                  cumulativePercentage += (segments[j].value / overallTotal) * 100;
                }
                const rotation = (cumulativePercentage / 100) * 360;

                return (
                  <Circle
                    key={seg.label}
                    cx="70" cy="70" r={radius}
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    fill="none"
                    strokeLinecap="round"
                    transform={`rotate(${rotation}, 70, 70)`}
                    onPress={() => {
                      if (activeTooltip?.label === seg.label && activeTooltip?.title === tooltipTitle) setActiveTooltip(null);
                      else setActiveTooltip({ title: tooltipTitle, label: seg.label, value: seg.value, color: seg.color });
                    }}
                  />
                );
              })}
            </G>
          </Svg>
          <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
              {activeTooltip?.title === tooltipTitle ? activeTooltip.label : 'Total'}
            </Text>
            <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === tooltipTitle ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
              {getCurrencySymbol(activeUser?.currency)}{activeTooltip?.title === tooltipTitle ? Math.round(activeTooltip.value) : Math.round(overallTotal)}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
          <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            {groups && groups.length > 0 ? (
              groups.map((group, gIdx) => (
                <View key={group.title} style={{ marginBottom: gIdx === groups.length - 1 ? 0 : 12 }}>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: 'bold', marginBottom: 6, letterSpacing: 0.5 }}>{group.title}</Text>
                  {group.items.map((acc, i) => (
                    <TouchableOpacity 
                      key={acc.id || i} 
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
                      onPress={() => {
                        if (activeTooltip?.label === acc.name && activeTooltip?.title === tooltipTitle) setActiveTooltip(null);
                        else setActiveTooltip({ title: tooltipTitle, label: acc.name, value: acc.currentBalance, color: group.color });
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: group.color }} />
                        <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{acc.name}</Text>
                      </View>
                      <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>
                        {getCurrencySymbol(activeUser?.currency)}{acc.currentBalance.toFixed(0)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            ) : (
              <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontStyle: 'italic' }}>No data available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  sectionTitle: { fontWeight: 'bold' }
});

export default BreakdownCard;
