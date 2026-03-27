import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, PanResponder, Dimensions } from 'react-native';
import { Plus, X, Landmark, CreditCard, Banknote, CalendarClock, TrendingUp, Briefcase } from 'lucide-react-native';
import AddEditAccountModal from './accounts/AddEditAccountModal';

const { width, height } = Dimensions.get('window');

/**
 * Developer Sandbox FAB & Menu
 * Allows rapid creation of accounts with pre-filled mock data.
 */
export default function DeveloperSandbox({ activeUser, theme, fs, accounts }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [accountData, setAccountData] = useState(null);

  // DRAG LOGIC
  const pan = useRef(new Animated.ValueXY({ 
    x: width - 80, 
    y: height - 160 
  })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  if (!activeUser?.sandboxEnabled) return null;

  const triggerMock = (type, mockData) => {
    setOpenSection({ key: type, label: type });
    setAccountData(mockData);
    setModalVisible(true);
    setMenuVisible(false);
  };

  const MOCK_PRESETS = [
    {
      title: 'Mock HDFC Bank',
      icon: Landmark,
      color: '#1e3a8a',
      type: 'BANK',
      data: { name: 'HDFC Savings', balance: 50000, ifsc: 'HDFC0001234', accountNumber: '50100456789' }
    },
    {
      title: 'Mock ICICI Credit Card',
      icon: CreditCard,
      color: '#f59e0b',
      type: 'CREDIT_CARD',
      data: { name: 'ICICI Sapphiro', creditLimit: 200000, currentUsage: 5000, billingCycle: 15 }
    },
    {
      title: 'Mock Personal Loan',
      icon: Banknote,
      color: '#10b981',
      type: 'LOAN',
      data: { 
        name: 'HDFC Personal Loan', 
        loanPrincipal: 500000, 
        loanInterestRate: 10.5, 
        loanTenure: 36, 
        loanType: 'EMI',
        loanStartDate: new Date().toISOString(),
        emiStartDate: new Date().toISOString()
      }
    },
    {
      title: 'Mock CC EMI (Jewelry)',
      icon: CalendarClock,
      color: '#8b5cf6',
      type: 'EMI',
      data: { 
        name: 'Tanishq EMI', 
        productPrice: 60000, 
        interestRate: 14, 
        tenure: 6, 
        startDate: new Date().toISOString(),
        emiStartDate: new Date().toISOString()
      }
    },
    {
      title: 'Mock SIP (Nifty 50)',
      icon: TrendingUp,
      color: '#ef4444',
      type: 'SIP',
      data: { name: 'UTI Nifty 50 Index', amount: 5000, dayInstallment: 5 }
    },
    {
      title: 'Mock Investment (Stocks)',
      icon: Briefcase,
      color: '#6366f1',
      type: 'INVESTMENT',
      data: { name: 'Groww Portfolio', balance: 125000 }
    }
  ];

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.fabContainer,
          {
            transform: pan.getTranslateTransform(),
            zIndex: 9999,
          }
        ]}
      >
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: theme.primary }]}
          onPress={() => setMenuVisible(true)}
          activeOpacity={0.8}
        >
          <Plus color="white" size={28} />
        </TouchableOpacity>
      </Animated.View>

      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
            <View style={styles.menuHeader}>
              <Text style={[styles.menuTitle, { color: theme.text, fontSize: fs(18) }]}>Developer Sandbox</Text>
              <TouchableOpacity onPress={() => setMenuVisible(false)}>
                <X color={theme.textSubtle} size={24} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.grid}>
                {MOCK_PRESETS.map((preset, idx) => (
                  <TouchableOpacity 
                    key={idx}
                    style={[styles.gridItem, { backgroundColor: theme.background, borderColor: theme.border }]}
                    onPress={() => triggerMock(preset.type, preset.data)}
                  >
                    <View style={[styles.iconBox, { backgroundColor: preset.color + '20' }]}>
                      <preset.icon color={preset.color} size={24} />
                    </View>
                    <Text style={[styles.gridLabel, { color: theme.text, fontSize: fs(12) }]}>{preset.title}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <AddEditAccountModal
        visible={modalVisible}
        editingId={null}
        accountData={accountData}
        openSection={openSection}
        accounts={accounts}
        activeUser={activeUser}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          // Optional: refresh data or show success
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    width: 56,
    height: 56,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  menuContainer: {
    width: '100%',
    maxHeight: '80%',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuTitle: {
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridItem: {
    width: '48%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 4,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  gridLabel: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
