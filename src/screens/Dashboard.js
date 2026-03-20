import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getAccounts, getTransactions, getRecurringPayments, getRecurringStats, getEmis, getMonthlyComparisonData, getAvailableHistory, getCustomGraphData } from '../services/storage';
import MonthlyBarChart from '../components/MonthlyBarChart';
import MonthlyCategorySplit from '../components/MonthlyCategorySplit';
import { getCreditCardStatus } from '../utils/billing';
import Svg, { G, Circle } from 'react-native-svg';
import { AlertCircle, ChevronDown, ChevronRight, CreditCard, TrendingUp } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AccountGroup = ({ title, totalAmount, accounts, expanded, onToggle, isEmi = false, totalColor }) => {
  const { theme, fs } = useTheme();
  if (accounts.length === 0) return null;
  return (
    <View style={[styles.groupContainer, { backgroundColor: theme.surface }]}>
      <TouchableOpacity style={[styles.groupHeader, { backgroundColor: theme.surface }]} onPress={onToggle}>
        <View style={styles.groupHeaderLeft}>
          {expanded ? <ChevronDown size={20} color={theme.textMuted} /> : <ChevronRight size={20} color={theme.textMuted} />}
          <Text style={[styles.groupTitle, { color: theme.text, fontSize: fs(16) }]}>{title}</Text>
        </View>
        <Text style={[styles.groupTotal, { color: totalColor || theme.success, fontSize: fs(16) }]}>₹{totalAmount.toFixed(2)}</Text>
      </TouchableOpacity>
      
      {expanded && (
        <View style={[styles.groupList, { borderTopColor: theme.border }]}>
          {accounts.map(acc => (
            <View key={acc.id} style={styles.groupItem}>
              <Text style={[styles.groupItemName, { color: theme.textMuted, fontSize: fs(14) }]}>{acc.name}</Text>
              <Text style={[styles.groupItemAmount, { color: theme.text, fontSize: fs(14) }]}>
                ₹{isEmi ? (acc.emiAmount || 0).toFixed(2) : acc.displayBalance !== undefined ? acc.displayBalance.toFixed(2) : acc.balance.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default function Dashboard() {
  const { activeUser } = useAuth();
  const { theme, fs, dashboardGraphs, customGraphs, graphOrder } = useTheme();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [recurringStats, setRecurringStats] = useState({});
  const [emis, setEmis] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  const [customGraphsData, setCustomGraphsData] = useState({});
  
  const [expandedGroups, setExpandedGroups] = useState({
    savings: false,
    investments: false,
    sips: false,
    creditCards: false,
    emis: false
  });
  const [activeTooltip, setActiveTooltip] = useState(null); // { title, label, value, color }

  const toggleGroup = (key) => setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  const loadData = async () => {
    const accs = await getAccounts(activeUser.id);
    const txs = await getTransactions(activeUser.id);
    const recur = await getRecurringPayments(activeUser.id);
    const sipNames = accs.filter(a => a.type === 'SIP').map(a => a.name);
    const allStatNames = [...new Set([...recur.map(r => r.name), ...sipNames])];
    const stats = await getRecurringStats(activeUser.id, allStatNames);
    const fetchedEmis = await getEmis(activeUser.id);
    const chart = await getMonthlyComparisonData(activeUser.id);
    const months = await getAvailableHistory(activeUser.id);
    
    setAccounts(accs);
    setTransactions(txs);
    setRecurringStats(stats);
    setEmis(fetchedEmis);
    setChartData(chart);
    setAvailableMonths(months);

    // Dynamic categories check to ensure custom graphs have data to show
    if (!customGraphs || customGraphs.length === 0) {
      setCustomGraphsData({});
      return;
    }

    // Load Custom Graphs Data
    const monthKey = new Date().toISOString().substring(0, 7);
    const customData = {};
    for (const graph of customGraphs) {
      if (graph.enabled !== false) {
        customData[graph.id] = await getCustomGraphData(activeUser.id, graph.categoryIds, monthKey);
      }
    }
    setCustomGraphsData(customData);
  };

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [activeUser.id, customGraphs, graphOrder])
  );

  const getOrderedGraphList = () => {
    const defaultIds = [
      'monthlyTrends', 'totalSavings', 'totalCcOutstanding', 
      'nonEmiCcOutstanding', 'monthlyExpenseSplit', 'totalLiabilities'
    ];
    
    const allAvailableIds = [
      ...defaultIds,
      ...(customGraphs || []).map(g => g.id)
    ];
    
    const currentOrder = (graphOrder && graphOrder.length > 0) ? graphOrder : defaultIds;
    
    // Filter and add missing
    const ordered = currentOrder.filter(id => allAvailableIds.includes(id));
    allAvailableIds.forEach(id => {
      if (!ordered.includes(id)) ordered.push(id);
    });
    
    return ordered;
  };

  const renderMonthlyTrends = () => <MonthlyBarChart key="monthlyTrends" data={chartData} />;

  const renderMonthlyExpenseSplit = () => (
    dashboardGraphs.monthlyExpenseSplit && availableMonths.length > 0 ? (
      <MonthlyCategorySplit key="monthlyExpenseSplit" userId={activeUser.id} availableMonths={availableMonths} />
    ) : null
  );

  const renderTotalSavings = () => {
    if (!dashboardGraphs.totalSavings) return null;
    return (
      <View key="totalSavings" style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp color={theme.success} size={20} />
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Total Savings Breakdown</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
              <Svg width={140} height={140} viewBox="0 0 140 140">
                <G rotation="-90" origin="70, 70">
                  <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
                  {overallSavings > 0 && (() => {
                    let cumulativePercentage = 0;
                    const radius = 60;
                    const circumference = 2 * Math.PI * radius;
                    const segments = [
                      { label: 'Bank Accounts', value: totalSavings, color: '#3b82f6' },
                      { label: 'Investments', value: totalInvestments, color: '#10b981' },
                      { label: 'SIPs', value: totalSips, color: '#06b6d4' }
                    ].filter(s => s.value > 0);
                    
                    return segments.map((seg, i) => {
                      const percentage = (seg.value / overallSavings) * 100;
                      if (percentage === 0) return null;
                      const strokeDashoffset = circumference - (circumference * percentage) / 100;
                      const rotation = (cumulativePercentage / 100) * 360;
                      cumulativePercentage += percentage;
                      return (
                        <Circle
                          key={i}
                          cx="70" cy="70" r={radius}
                          stroke={seg.color}
                          strokeWidth="12"
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          fill="none"
                          strokeLinecap="round"
                          transform={`rotate(${rotation}, 70, 70)`}
                          onPress={() => {
                            if (activeTooltip?.label === seg.label && activeTooltip?.title === 'savings') setActiveTooltip(null);
                            else setActiveTooltip({ title: 'savings', label: seg.label, value: seg.value, color: seg.color });
                          }}
                        />
                      );
                    });
                  })()}
                </G>
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
                <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                  {activeTooltip?.title === 'savings' ? activeTooltip.label : 'Total'}
                </Text>
                <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === 'savings' ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                  ₹{activeTooltip?.title === 'savings' ? Math.round(activeTooltip.value) : Math.round(overallSavings)}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {savingsGroups.length > 0 ? (
                  savingsGroups.map((group, gIdx) => (
                    <View key={group.title} style={{ marginBottom: gIdx === savingsGroups.length - 1 ? 0 : 12 }}>
                      <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: 'bold', marginBottom: 6, letterSpacing: 0.5 }}>{group.title}</Text>
                      {group.items.map((acc, i) => (
                        <TouchableOpacity 
                          key={acc.id || i} 
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
                          onPress={() => {
                            if (activeTooltip?.label === acc.name && activeTooltip?.title === 'savings') setActiveTooltip(null);
                            else setActiveTooltip({ title: 'savings', label: acc.name, value: acc.currentBalance, color: group.color });
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: group.color }} />
                            <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{acc.name}</Text>
                          </View>
                          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>
                            ₹{acc.currentBalance.toFixed(0)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                ) : (
                  <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontStyle: 'italic' }}>No accounts yet</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
      </View>
    );
  };

  const renderTotalCc = () => {
    if (!dashboardGraphs.totalCcOutstanding || creditCardAccounts.length === 0) return null;
    return (
      <View key="totalCcOutstanding" style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <CreditCard color={theme.danger} size={20} />
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Total CC Outstandings</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
            <Svg width={140} height={140} viewBox="0 0 140 140">
              <G rotation="-90" origin="70, 70">
                <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
                {totalCreditCard > 0 && (() => {
                  let cumulativePercentage = 0;
                  const radius = 60;
                  const circumference = 2 * Math.PI * radius;
                  const colors = ['#ef4444', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f97316'];
                  return creditCardAccounts.map((acc, i) => {
                    const percentage = (acc.totalOutstanding / totalCreditCard) * 100;
                    if (percentage === 0) return null;
                    const strokeDashoffset = circumference - (circumference * percentage) / 100;
                    const rotation = (cumulativePercentage / 100) * 360;
                    cumulativePercentage += percentage;
                    return (
                      <Circle
                        key={acc.id}
                        cx="70" cy="70" r={radius}
                        stroke={colors[i % colors.length]}
                        strokeWidth="12"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        fill="none"
                        strokeLinecap="round"
                        transform={`rotate(${rotation}, 70, 70)`}
                        onPress={() => {
                          if (activeTooltip?.label === acc.name && activeTooltip?.title === 'cc_total') setActiveTooltip(null);
                          else setActiveTooltip({ title: 'cc_total', label: acc.name, value: acc.totalOutstanding, color: colors[i % colors.length] });
                        }}
                      />
                    );
                  });
                })()}
              </G>
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                {activeTooltip?.title === 'cc_total' ? activeTooltip.label : 'Total'}
              </Text>
              <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === 'cc_total' ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                ₹{activeTooltip?.title === 'cc_total' ? Math.round(activeTooltip.value) : Math.round(totalCreditCard)}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              {creditCardAccounts.map((acc, i) => {
                const colors = ['#ef4444', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f97316'];
                return (
                  <TouchableOpacity 
                    key={acc.id} 
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
                    onPress={() => {
                      if (activeTooltip?.label === acc.name) setActiveTooltip(null);
                      else setActiveTooltip({ title: 'cc_total', label: acc.name, value: acc.totalOutstanding, color: colors[i % colors.length] });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
                      <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{acc.name}</Text>
                    </View>
                    <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{acc.totalOutstanding.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderNonEmiCc = () => {
    if (!dashboardGraphs.nonEmiCcOutstanding || creditCardAccounts.length === 0) return null;
    return (
      <View key="nonEmiCcOutstanding" style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <CreditCard color={theme.primary} size={20} />
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>CC (Excl. EMIs)</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
            <Svg width={140} height={140} viewBox="0 0 140 140">
              <G rotation="-90" origin="70, 70">
                <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
                {totalNonEmiCreditCard > 0 && (() => {
                  let cumulativePercentage = 0;
                  const radius = 60;
                  const circumference = 2 * Math.PI * radius;
                  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
                  return creditCardAccounts.map((acc, i) => {
                    const percentage = (acc.displayBalance / totalNonEmiCreditCard) * 100;
                    if (percentage === 0) return null;
                    const strokeDashoffset = circumference - (circumference * percentage) / 100;
                    const rotation = (cumulativePercentage / 100) * 360;
                    cumulativePercentage += percentage;
                    return (
                      <Circle
                        key={acc.id}
                        cx="70" cy="70" r={radius}
                        stroke={colors[i % colors.length]}
                        strokeWidth="12"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        fill="none"
                        strokeLinecap="round"
                        transform={`rotate(${rotation}, 70, 70)`}
                        onPress={() => {
                          if (activeTooltip?.label === acc.name && activeTooltip?.title === 'cc_no_emi') setActiveTooltip(null);
                          else setActiveTooltip({ title: 'cc_no_emi', label: acc.name, value: acc.displayBalance, color: colors[i % colors.length] });
                        }}
                      />
                    );
                  });
                })()}
              </G>
            </Svg>
            <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
              <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                {activeTooltip?.title === 'cc_no_emi' ? activeTooltip.label : 'Total'}
              </Text>
              <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === 'cc_no_emi' ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                ₹{activeTooltip?.title === 'cc_no_emi' ? Math.round(activeTooltip.value) : Math.round(totalNonEmiCreditCard)}
              </Text>
            </View>
          </View>
          <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
              {creditCardAccounts.map((acc, i) => {
                const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
                return (
                  <TouchableOpacity 
                    key={acc.id} 
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
                    onPress={() => {
                      if (activeTooltip?.label === acc.name) setActiveTooltip(null);
                      else setActiveTooltip({ title: 'cc_no_emi', label: acc.name, value: acc.displayBalance, color: colors[i % colors.length] });
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
                      <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{acc.name}</Text>
                    </View>
                    <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{acc.displayBalance.toFixed(0)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const renderTotalLiabilities = () => {
    if (!dashboardGraphs.totalLiabilities) return null;
    return (
      <View key="totalLiabilities" style={[styles.card, { backgroundColor: theme.surface, padding: 20 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <TrendingUp color={theme.danger} size={20} style={{ transform: [{ rotate: '180deg' }] }} />
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18), marginBottom: 0 }]}>Total Liabilities Breakdown</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', justifyContent: 'center', width: 140, height: 140 }}>
              <Svg width={140} height={140} viewBox="0 0 140 140">
                <G rotation="-90" origin="70, 70">
                  <Circle cx="70" cy="70" r="60" stroke={theme.border} strokeWidth="12" fill="none" />
                  {totalLiabilitiesSum > 0 && (() => {
                    let cumulativePercentage = 0;
                    const radius = 60;
                    const circumference = 2 * Math.PI * radius;
                    const segments = [
                      { label: 'Loans', value: loanAccounts.reduce((sum, a) => sum + a.balance, 0), color: '#ef4444' },
                      { label: 'Borrowed', value: borrowedAccounts.reduce((sum, a) => sum + a.balance, 0), color: '#f97316' },
                      { label: 'Credit Cards', value: totalCreditCard, color: '#6366f1' }
                    ].filter(s => s.value > 0);
                    
                    return segments.map((seg, i) => {
                      const percentage = (seg.value / totalLiabilitiesSum) * 100;
                      if (percentage === 0) return null;
                      const strokeDashoffset = circumference - (circumference * percentage) / 100;
                      const rotation = (cumulativePercentage / 100) * 360;
                      cumulativePercentage += percentage;
                      return (
                        <Circle
                          key={i}
                          cx="70" cy="70" r={radius}
                          stroke={seg.color}
                          strokeWidth="12"
                          strokeDasharray={`${circumference} ${circumference}`}
                          strokeDashoffset={strokeDashoffset}
                          fill="none"
                          strokeLinecap="round"
                          transform={`rotate(${rotation}, 70, 70)`}
                          onPress={() => {
                            if (activeTooltip?.label === seg.label && activeTooltip?.title === 'liabilities') setActiveTooltip(null);
                            else setActiveTooltip({ title: 'liabilities', label: seg.label, value: seg.value, color: seg.color });
                          }}
                        />
                      );
                    });
                  })()}
                </G>
              </Svg>
              <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
                <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                  {activeTooltip?.title === 'liabilities' ? activeTooltip.label : 'Total Owed'}
                </Text>
                <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === 'liabilities' ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                  ₹{activeTooltip?.title === 'liabilities' ? Math.round(activeTooltip.value) : Math.round(totalLiabilitiesSum)}
                </Text>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 20, height: 140 }}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
                {liabilitiesGroups.length > 0 ? (
                  liabilitiesGroups.map((group, gIdx) => (
                    <View key={group.title} style={{ marginBottom: gIdx === liabilitiesGroups.length - 1 ? 0 : 12 }}>
                      <Text style={{ color: theme.textSubtle, fontSize: fs(10), fontWeight: 'bold', marginBottom: 6, letterSpacing: 0.5 }}>{group.title}</Text>
                      {group.items.map((acc, i) => (
                        <TouchableOpacity 
                          key={acc.id || i} 
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
                          onPress={() => {
                            if (activeTooltip?.label === acc.name && activeTooltip?.title === 'liabilities') setActiveTooltip(null);
                            else setActiveTooltip({ title: 'liabilities', label: acc.name, value: acc.currentBalance, color: group.color });
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: group.color }} />
                            <Text style={{ color: theme.textMuted, fontSize: fs(12) }} numberOfLines={1}>{acc.name}</Text>
                          </View>
                          <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>
                            ₹{acc.currentBalance.toFixed(0)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                ) : (
                  <View style={{ height: 140, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(12), fontStyle: 'italic' }}>No liabilities</Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
      </View>
    );
  };

  const renderCustomGraph = (graph) => {
    if (graph.enabled === false) return null;
    const data = customGraphsData[graph.id] || [];
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
                    {total > 0 && (() => {
                      let cumulativePercentage = 0;
                      const radius = 60;
                      const circumference = 2 * Math.PI * radius;
                      return data.map((item, i) => {
                        const percentage = (item.amount / total) * 100;
                        if (percentage === 0) return null;
                        const strokeDashoffset = circumference - (circumference * percentage) / 100;
                        const rotation = (cumulativePercentage / 100) * 360;
                        cumulativePercentage += percentage;
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
                      });
                    })()}
                  </G>
                </Svg>
                <View style={{ position: 'absolute', alignItems: 'center', width: 100 }}>
                  <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
                    {activeTooltip?.title === graph.id ? activeTooltip.label : 'Total'}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: fs(activeTooltip?.title === graph.id ? 14 : 18), fontWeight: 'bold', textAlign: 'center' }} numberOfLines={1}>
                    ₹{activeTooltip?.title === graph.id ? Math.round(activeTooltip.value) : Math.round(total)}
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
                      <Text style={{ color: theme.text, fontSize: fs(12), fontWeight: '600' }}>₹{item.amount.toFixed(0)}</Text>
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

  const renderGraph = (id) => {
    switch (id) {
      case 'monthlyTrends': return renderMonthlyTrends();
      case 'monthlyExpenseSplit': return renderMonthlyExpenseSplit();
      case 'totalSavings': return renderTotalSavings();
      case 'totalCcOutstanding': return renderTotalCc();
      case 'nonEmiCcOutstanding': return renderNonEmiCc();
      case 'totalLiabilities': return renderTotalLiabilities();
      default:
        const cg = (customGraphs || []).find(g => g.id === id);
        return cg ? renderCustomGraph(cg) : null;
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const alerts = accounts
    .filter(a => a.type === 'CREDIT_CARD' && a.billingDay && a.dueDay)
    .map(acc => {
      const status = getCreditCardStatus(acc.billingDay, acc.dueDay);
      // Calculate what is owed: spendings up to last statement - payments up to today
      const expensesUpToStatement = transactions
        .filter(t => t.accountId === acc.id && (t.type === 'EXPENSE' || t.type === 'TRANSFER') && new Date(t.date) <= status.lastStatementDate)
        .reduce((sum, t) => sum + t.amount, 0);
      // Payments are now stored with toAccountId = cc.id
      const allPayments = transactions
        .filter(t => (t.toAccountId === acc.id && (t.type === 'PAYMENT' || t.type === 'TRANSFER')) ||
                     (t.accountId === acc.id && t.type === 'INCOME'))
        .reduce((sum, t) => sum + t.amount, 0);
      const amountOwed = Math.max(0, expensesUpToStatement - allPayments);
      
      return { ...acc, status, amountOwed };
    })
    .filter(a => a.status && (a.status.isDueSoon || a.status.isOverdue) && a.amountOwed > 0);

  const savingsAccounts = accounts.filter(a => a.type === 'BANK');
  const investmentAccounts = accounts.filter(a => a.type === 'INVESTMENT');
  
  const getLoanStats = (item) => {
    const isLoan = item.type === 'LOAN' || item.type === 'BORROWED' || item.type === 'LENDED';
    if (!isLoan || !item.loanPrincipal || !item.loanInterestRate || !item.loanTenure) {
      return { isLoan: false, remainingTotal: item.balance || 0 };
    }

    const P_current = item.balance || 0;
    const annualRate = item.loanInterestRate || 0;
    const years_original = item.loanTenure || 0;
    const loanStart = new Date(item.loanStartDate);
    const n_original = years_original * 12;
    const r = annualRate / 1200;

    const differenceInMonths = (d1, d2) => {
      let m = (d1.getFullYear() - d2.getFullYear()) * 12;
      m -= d2.getMonth(); m += d1.getMonth();
      return m <= 0 ? 0 : m;
    };
    const monthsPassed = Math.max(0, differenceInMonths(new Date(), loanStart));
    const remainingMonths_projected = Math.max(0, n_original - monthsPassed);

    let totalRepayable_current = P_current;

    if (item.isEmi === 1) {
      if (r > 0 && remainingMonths_projected > 0) {
        const emi_current = (P_current * r * Math.pow(1 + r, remainingMonths_projected)) / (Math.pow(1 + r, remainingMonths_projected) - 1);
        totalRepayable_current = emi_current * remainingMonths_projected;
      }
    } else {
      // One-time payable at end
      totalRepayable_current = P_current + (P_current * (annualRate / 100) * years_original);
    }

    // Apply Fine if Overdue
    let fineAmount = 0;
    if (monthsPassed > n_original && item.loanFinePercentage > 0) {
      fineAmount = P_current * (item.loanFinePercentage / 100) * (monthsPassed - n_original);
    }

    const closeTodayAmount = (item.isEmi === 1) 
      ? (P_current + fineAmount) 
      : (P_current + (P_current * (annualRate / 100) * (monthsPassed / 12)) + fineAmount);

    return { 
      isLoan: true, 
      remainingTotal: totalRepayable_current + fineAmount,
      closeTodayAmount: closeTodayAmount 
    };
  };

  const creditCardAccounts = accounts.filter(a => a.type === 'CREDIT_CARD').map(acc => {
    // All-time expenses on this CC
    const totalExpenses = transactions
      .filter(t => t.accountId === acc.id && (t.type === 'EXPENSE' || t.type === 'TRANSFER'))
      .reduce((sum, t) => sum + t.amount, 0);
    // All-time payments TO this CC
    const totalPayments = transactions
      .filter(t => (t.toAccountId === acc.id && (t.type === 'PAYMENT' || t.type === 'TRANSFER')) ||
                   (t.accountId === acc.id && t.type === 'INCOME'))
      .reduce((sum, t) => sum + t.amount, 0);
    // Net outstanding (non-EMI)
    const nonEmiOutstanding = Math.max(0, totalExpenses - totalPayments);
    
    // EMI outstanding on this card
    const cardEmis = emis.filter(e => e.accountId === acc.id);
    const emiOutstanding = cardEmis.reduce((sum, e) => sum + (e.amount * (e.tenure - e.paidMonths)), 0);
    
    return { 
      ...acc, 
      displayBalance: nonEmiOutstanding, 
      emiOutstanding, 
      totalOutstanding: nonEmiOutstanding + emiOutstanding 
    };
  });

  const loanAccounts = accounts.filter(a => a.type === 'LOAN');
  const borrowedAccounts = accounts.filter(a => a.type === 'BORROWED');
  const lendedAccounts = accounts.filter(a => a.type === 'LENDED');
  const sipAccounts = accounts.filter(a => a.type === 'SIP').map(acc => {
    const s = recurringStats[acc.name];
    const fromStats = s ? s.totalPaid : 0;
    const fromDb = acc.totalPaid || 0;
    // Aggressive fallback: use the highest detected value from balance or transaction history
    const portfolioValue = Math.max(acc.balance || 0, fromDb, fromStats);
    return { ...acc, displayBalance: portfolioValue };
  });

  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0) + lendedAccounts.reduce((sum, a) => sum + (getLoanStats(a).remainingTotal), 0);
  const totalInvestments = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalSips = sipAccounts.reduce((sum, a) => sum + a.displayBalance, 0);
  const totalCreditCard = creditCardAccounts.reduce((sum, a) => sum + a.totalOutstanding, 0);
  const totalNonEmiCreditCard = creditCardAccounts.reduce((sum, a) => sum + a.displayBalance, 0);

  // Sum LOAN/BORROWED accounts (including interest)
  const totalLoanAccounts = loanAccounts.reduce((sum, a) => sum + getLoanStats(a).remainingTotal, 0) + 
                            borrowedAccounts.reduce((sum, a) => sum + getLoanStats(a).remainingTotal, 0);

  const totalLoans = totalLoanAccounts;

  const totalWealth = totalSavings + totalInvestments + totalSips - totalCreditCard - totalLoans;
  const overallSavings = totalSavings + totalInvestments + totalSips;
  const savingsGroups = [
    { title: 'BANKS', color: '#3b82f6', items: [
      ...savingsAccounts.map(a => ({ ...a, currentBalance: a.balance })),
      ...lendedAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal }))
    ].sort((a, b) => b.currentBalance - a.currentBalance) },
    { title: 'INVESTMENTS', color: '#10b981', items: investmentAccounts.map(a => ({ ...a, currentBalance: a.balance })).sort((a, b) => b.currentBalance - a.currentBalance) },
    { title: 'SIPs', color: '#06b6d4', items: sipAccounts.map(a => ({ ...a, currentBalance: a.displayBalance })).sort((a, b) => b.currentBalance - a.currentBalance) }
  ].filter(g => g.items.length > 0);

  const liabilitiesGroups = [
    { title: 'LOANS', color: '#ef4444', items: loanAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal })).sort((a, b) => b.currentBalance - a.currentBalance) },
    { title: 'BORROWED', color: '#f97316', items: borrowedAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal })).sort((a, b) => b.currentBalance - a.currentBalance) },
    { title: 'CREDIT CARDS', color: '#6366f1', items: creditCardAccounts.map(a => ({ ...a, currentBalance: a.totalOutstanding })).sort((a, b) => b.currentBalance - a.currentBalance) }
  ].filter(g => g.items.length > 0);
  const totalLiabilitiesSum = totalLoans + totalCreditCard;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
      <ScrollView 
        style={[styles.container, { backgroundColor: theme.background }]} 
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} tintColor={theme.primary} />}
      >
      {/* Net Worth card removed */}

      {alerts.length > 0 && (
        <View style={styles.alertsContainer}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(18) }]}>Priority Alerts</Text>
          {alerts.map(acc => (
            <View key={acc.id} style={[styles.alertCard, { backgroundColor: theme.surface }]}>
              <AlertCircle color={acc.status.isOverdue ? theme.danger : '#f59e0b'} size={24} />
              <View style={styles.alertContent}>
                <Text style={[styles.alertText, { color: theme.text, fontSize: fs(16) }]}>{acc.name} is {acc.status.isOverdue ? 'Overdue!' : 'Due Soon'}</Text>
                <Text style={[styles.alertSub, { color: theme.textSubtle, fontSize: fs(14) }]}>Owe: ₹{acc.amountOwed.toFixed(2)} due on {acc.status.currentDueDate.toLocaleDateString()}</Text>
              </View>
            </View>
          ))}
        </View>
      )}


      {((savingsAccounts.length > 0 || investmentAccounts.length > 0 || creditCardAccounts.length > 0 || sipAccounts.length > 0) || (dashboardGraphs.monthlyTrends || dashboardGraphs.totalSavings || dashboardGraphs.totalCcOutstanding || dashboardGraphs.nonEmiCcOutstanding || dashboardGraphs.monthlyExpenseSplit || dashboardGraphs.totalLiabilities) || (customGraphs && customGraphs.length > 0)) && (
        <>
          {getOrderedGraphList().map(id => renderGraph(id))}
        </>
      )}

      {alerts.length === 0 && (savingsAccounts.length === 0 && investmentAccounts.length === 0 && creditCardAccounts.length === 0 && sipAccounts.length === 0 && customGraphs.length === 0) && (
        <View style={[styles.alertCard, { justifyContent: 'center', backgroundColor: theme.surface }]}>
          <Text style={{ color: theme.success, fontWeight: 'bold' }}>All clear! Add accounts to see outstandings.</Text>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', padding: 16 },
  card: { backgroundColor: '#3b82f6', padding: 24, borderRadius: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  title: { color: '#bfdbfe', fontSize: 16, fontWeight: '600' },
  amount: { color: 'white', fontSize: 36, fontWeight: 'bold', marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1f2937', marginBottom: 12 },
  alertsContainer: { marginBottom: 24 },
  alertCard: { backgroundColor: 'white', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  alertContent: { marginLeft: 12 },
  alertText: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  alertSub: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  groupContainer: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white' },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  groupTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937', marginLeft: 8 },
  groupTotal: { fontSize: 16, fontWeight: 'bold' },
  groupList: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  groupItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  groupItemName: { fontSize: 14, color: '#4b5563' },
  groupItemAmount: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
});
