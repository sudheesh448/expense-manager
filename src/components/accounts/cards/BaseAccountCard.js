import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Landmark, TrendingUp, Wallet, BarChart2, Edit2, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../../context/AuthContext';
import { getCurrencySymbol } from '../../../utils/currencyUtils';

const BaseAccountCard = ({ item, theme, fs, onEdit, onDelete, onDetails }) => {
  const { activeUser } = useAuth();
  const getIcon = () => {
    switch (item.type) {
      case 'BANK': return <Landmark size={18} color={theme.primary} />;
      case 'INVESTMENT': return <TrendingUp size={18} color={theme.primary} />;
      case 'SIP': return <BarChart2 size={18} color={theme.primary} />;
      default: return <Wallet size={18} color={theme.primary} />;
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.card, { backgroundColor: theme.surface }]}
      onPress={() => onDetails?.(item)}
    >
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.iconBox, { backgroundColor: theme.primary + '15' }]}>
            {getIcon()}
          </View>
          <View>
            <Text style={[styles.cardName, { color: theme.text, fontSize: fs(16) }]}>{item.name}</Text>
            <Text style={[styles.cardSub, { color: theme.textSubtle, fontSize: fs(10), textTransform: 'uppercase' }]}>
              {item.type.toLowerCase().replace('_', ' ')}
            </Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.cardAmount, { color: theme.success, fontSize: fs(18) }]}>
            {getCurrencySymbol(activeUser?.currency)}{(item.balance || 0).toLocaleString()}
          </Text>
          <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>
            {item.type === 'INVESTMENT' ? 'Current Value' : 'Balance'}
          </Text>
        </View>
      </View>

      {item.type === 'INVESTMENT' && item.investedAmount > 0 && (
        <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.02)', padding: 10, borderRadius: 12 }}>
          <View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: 'bold' }}>INVESTED</Text>
            <Text style={{ color: theme.text, fontSize: fs(13), fontWeight: '800' }}>
              {getCurrencySymbol(activeUser?.currency)}{item.investedAmount.toLocaleString()}
            </Text>
          </View>
          
          <View style={{ alignItems: 'flex-end' }}>
            {(() => {
              const returns = item.balance - item.investedAmount;
              const returnPerc = (returns / item.investedAmount) * 100;
              const isProfit = returns >= 0;
              return (
                <>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: 'bold' }}>RETURNS</Text>
                  <Text style={{ color: isProfit ? theme.success : theme.danger, fontSize: fs(13), fontWeight: '800' }}>
                    {isProfit ? '+' : ''}{getCurrencySymbol(activeUser?.currency)}{Math.abs(returns).toLocaleString()} ({returnPerc.toFixed(1)}%)
                  </Text>
                </>
              );
            })()}
          </View>
        </View>
      )}

      <View style={styles.actionsBar}>
        <TouchableOpacity onPress={() => onEdit?.(item)} style={styles.actionBtn}>
          <Edit2 size={14} color={theme.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete?.(item)} style={styles.actionBtn}>
          <Trash2 size={14} color={theme.danger} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: 'transparent', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardName: { fontWeight: '900', letterSpacing: -0.5 },
  cardSub: { fontWeight: '700', letterSpacing: 0.5 },
  cardAmount: { fontWeight: '900', letterSpacing: -0.5 },
  actionsBar: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)', paddingTop: 10 },
  actionBtn: { padding: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.02)' },
});

export default BaseAccountCard;
