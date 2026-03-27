import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Dimensions, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isSameMonth, startOfMonth } from 'date-fns';
import { Calendar, X, ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getCurrencySymbol } from '../utils/currencyUtils';
import { getAccounts, payEmi, payExpectedExpense } from '../services/storage';
import CustomHeader from '../components/CustomHeader';
import CustomDropdown from '../components/CustomDropdown';
import EmiSettlementModal from '../components/emis/EmiSettlementModal';
import MonthOverviewContent from '../components/dashboard/MonthOverviewContent';

const { width } = Dimensions.get('window');

export default function UpcomingPayments({ navigation, route }) {
  const { activeUser } = useAuth() || {};
  const { theme, fs, setIsSettingsOpen } = useTheme();
  
  if (!activeUser) return null;

  // Carousel Range (2024, 2025, 2026)
  const years = [2024, 2025, 2026];
  const monthsList = [];
  const now = startOfMonth(new Date());
  for (const y of years) {
    for (let m = 0; m < 12; m++) {
      const d = new Date(y, m, 1);
      monthsList.push({
        monthKey: format(d, 'yyyy-MM'),
        label: format(d, 'MMMM yyyy'),
        monthIdx: m,
        year: y,
        dateObj: d,
        id: format(d, 'yyyy-MM'),
        isCurrent: isSameMonth(now, d)
      });
    }
  }

  const currentMonthIndex = monthsList.findIndex(m => m.isCurrent);
  const [activeIndex, setActiveIndex] = useState(currentMonthIndex !== -1 ? currentMonthIndex : 0);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const flatListRef = useRef(null);

  // Focus-based Refresh Logic
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
    }, [])
  );

  // Settlement States
  const [accounts, setAccounts] = useState([]);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [settleAccountId, setSettleAccountId] = useState(null);

  useEffect(() => {
    const loadBasics = async () => {
      const accs = await getAccounts(activeUser.id);
      setAccounts(accs);
    };
    loadBasics();
  }, [activeUser.id]);

  const onScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
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

  const openSettle = (item) => {
    setSelectedItem(item);
    const bank = accounts.find(a => a.type === 'BANK');
    setSettleAccountId(bank?.id || null);
    setShowSettleModal(true);
  };

  const handleSettle = async () => {
    if (!settleAccountId) { Alert.alert('Error', 'Please select an account'); return; }
    try {
      if (selectedItem.itemType === 'EMI') {
        const targetEmiAccountId = selectedItem.linkedAccountId || selectedItem.id;
        await payEmi(activeUser.id, targetEmiAccountId, settleAccountId, selectedItem.amount, selectedItem.monthKey, selectedItem.id);
      } else {
        await payExpectedExpense(activeUser.id, selectedItem.id, settleAccountId);
      }
      setShowSettleModal(false);
      setRefreshKey(prev => prev + 1);
      Alert.alert('Success', 'Item settled successfully!');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <CustomHeader
        title="Month Overview"
        showProfile={true}
        onProfilePress={() => setIsSettingsOpen(true)}
        theme={theme}
        fs={fs}
        rightIcon={<Calendar size={20} color={theme.primary} />}
        onRightIconPress={() => setShowMonthSelector(true)}
      />

      <FlatList
        ref={flatListRef}
        data={monthsList}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialScrollIndex={currentMonthIndex !== -1 ? currentMonthIndex : 0}
        getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <View style={{ width: width }}>
             <MonthOverviewContent 
                userId={activeUser.id}
                monthKey={item.monthKey}
                dateObj={item.dateObj}
                isActive={activeIndex === index}
                theme={theme}
                fs={fs}
                currency={getCurrencySymbol(activeUser?.currency)}
                onOpenSettle={openSettle}
                onPressSelector={() => setShowMonthSelector(true)}
                refreshKey={refreshKey}
             />
          </View>
        )}
      />

      {/* Year/Month Selection Modal */}
      <Modal visible={showMonthSelector} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
              <View style={{ backgroundColor: theme.surface, borderRadius: 24, padding: 24, maxHeight: '80%' }}>
                  <Text style={{ color: theme.text, fontSize: fs(18), fontWeight: 'bold', marginBottom: 20 }}>Navigate to Month</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                      {years.map(y => (
                          <TouchableOpacity key={y} onPress={() => setPickerYear(y)} style={{ paddingVertical: 10, paddingHorizontal: 20, backgroundColor: pickerYear === y ? theme.primary : theme.border, borderRadius: 12, opacity: pickerYear === y ? 1 : 0.5 }}>
                              <Text style={{ color: pickerYear === y ? '#fff' : theme.text, fontWeight: 'bold' }}>{y}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
                      {Array.from({ length: 12 }).map((_, mIdx) => {
                          const date = new Date(pickerYear, mIdx, 1);
                          const mLabel = format(date, 'MMM');
                          const targetIdx = monthsList.findIndex(m => m.year === pickerYear && m.monthIdx === mIdx);
                          const isCurrent = isSameMonth(new Date(), date);
                          const isSelected = activeIndex === targetIdx;
                          return (
                              <TouchableOpacity key={mIdx} onPress={() => jumpToMonth(targetIdx)} style={{ width: '30%', height: 54, justifyContent: 'center', alignItems: 'center', backgroundColor: isSelected ? theme.primarySubtle : (isCurrent ? 'rgba(0,0,0,0.03)' : 'transparent'), borderWidth: 1, borderColor: isCurrent ? theme.primary : theme.border, borderRadius: 16 }}>
                                  <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? 'bold' : 'normal' }}>{mLabel}</Text>
                                  {isCurrent && <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.primary, marginTop: 4 }} />}
                              </TouchableOpacity>
                          );
                      })}
                  </View>
                  <TouchableOpacity onPress={() => setShowMonthSelector(false)} style={{ marginTop: 24, padding: 12, alignItems: 'center' }}>
                       <Text style={{ color: theme.textSubtle }}>Dismiss</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {/* Shared Settlement Modal */}
      {selectedItem?.itemType === 'EMI' ? (
        <EmiSettlementModal
          visible={showSettleModal}
          selectedEmi={{ month: selectedItem.monthKey, totalOutflow: selectedItem.amount }}
          accounts={accounts}
          settleAccountId={settleAccountId}
          onSelectAccount={setSettleAccountId}
          onConfirm={handleSettle}
          onClose={() => setShowSettleModal(false)}
          theme={theme}
          fs={fs}
        />
      ) : (
        <Modal visible={showSettleModal} transparent animationType="slide">
          <SafeAreaView style={styles.modalOverlay}>
            <View style={[styles.pickerSheet, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
               <View style={styles.modalHeader}>
                 <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Settle Item</Text>
                 <TouchableOpacity onPress={() => setShowSettleModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
               </View>
               <View style={{ padding: 20 }}>
                 <Text style={[styles.modalSubtitle, { color: theme.textMuted, fontSize: fs(10), marginTop: 16 }]}>SELECT ACCOUNT</Text>
                 <CustomDropdown
                    options={accounts.filter(acc => selectedItem?.type === 'INCOME' ? acc.type === 'BANK' : (acc.type === 'BANK' || acc.type === 'CREDIT_CARD')).map(acc => ({ label: acc.name, value: acc.id, accountType: acc.type }))}
                    selectedValue={settleAccountId} onSelect={setSettleAccountId} placeholder="Select Account" showTabs={true} theme={theme} fs={fs}
                 />
                 <TouchableOpacity style={[styles.settleActionBtn, { backgroundColor: theme.primary, marginTop: 24 }]} onPress={handleSettle}>
                   <Text style={{ color: '#fff', fontWeight: 'bold', textAlign: 'center' }}>{selectedItem?.type === 'INCOME' ? 'Receive Income' : 'Mark as Paid'}</Text>
                 </TouchableOpacity>
               </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pickerSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, borderTopWidth: 1, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontWeight: 'bold' },
  modalSubtitle: { fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  settleActionBtn: { padding: 16, borderRadius: 16, elevation: 2 }
});
