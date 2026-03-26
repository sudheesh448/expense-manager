import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Color map for account types
const ACCOUNT_TYPE_COLORS = {
  BANK:           { bg: '#dbeafe', text: '#1d4ed8', label: 'Bank Account' },
  CASH:           { bg: '#e0f2fe', text: '#0369a1', label: 'Cash' },
  CREDIT_CARD:    { bg: '#fce7f3', text: '#be185d', label: 'Credit Card' },
  INVESTMENT:     { bg: '#dcfce7', text: '#15803d', label: 'Investment' },
  SIP:            { bg: '#d1fae5', text: '#065f46', label: 'SIP / MF' },
  LOAN:           { bg: '#fee2e2', text: '#b91c1c', label: 'Loan' },
  BORROWED:       { bg: '#ffedd5', text: '#c2410c', label: 'Borrowed' },
  LENDED:         { bg: '#fef9c3', text: '#a16207', label: 'Lent' },
  OTHER:          { bg: '#f3f4f6', text: '#374151', label: 'Other' },
};

const getTypeColor = (type) => ACCOUNT_TYPE_COLORS[type] || ACCOUNT_TYPE_COLORS.OTHER;

// Group an options array by their `accountType` field (if present)
const groupOptions = (options) => {
  const hasTypes = options.some(o => o.accountType);
  if (!hasTypes) return null; // Return null → render as flat list

  const groups = {};
  for (const opt of options) {
    const key = opt.accountType || 'OTHER';
    if (!groups[key]) groups[key] = [];
    groups[key].push(opt);
  }
  return groups;
};

const CustomDropdown = ({ 
  label, options, selectedValue, onSelect, placeholder = "Select...", 
  containerStyle, disabled = false, icon: Icon, showTabs = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, fs, themeMode } = useTheme();
  const isDark = themeMode === 'dark';
  
  const groups = groupOptions(options);
  const [activeTab, setActiveTab] = useState(null);

  // Initialize activeTab when groups are available
  useEffect(() => {
    if (groups) {
      const groupKeys = Object.keys(groups);
      if (groupKeys.includes('BANK')) {
        setActiveTab('BANK');
      } else {
        setActiveTab(groupKeys[0]);
      }
    }
  }, [groups]);

  const selectedOption = options.find(o => o.value === selectedValue);

  const handleSelect = (value) => {
    onSelect(value);
    setIsOpen(false); // Auto-close on selection
  };

  const renderItem = (opt, index) => {
    const isSelected = selectedValue === opt.value;
    const typeColor = opt.accountType ? getTypeColor(opt.accountType) : null;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.modalItem,
          { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
          isSelected && { backgroundColor: theme.primary + '11', borderColor: theme.primary + '40' },
        ]}
        onPress={() => handleSelect(opt.value)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View style={[styles.itemIconBox, { backgroundColor: isSelected ? theme.primary + '22' : theme.border + '33' }]}>
             {Icon ? (
               <Icon size={14} color={isSelected ? theme.primary : theme.textSubtle} />
             ) : (
               <View style={[styles.dot, { backgroundColor: isSelected ? theme.primary : theme.textSubtle }]} />
             )}
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={[
                styles.modalItemText,
                { color: theme.text, fontSize: fs(14), fontWeight: '700' },
                isSelected ? { color: theme.primary, fontWeight: '800' } : { color: theme.textMuted },
              ]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
            {opt.accountType && (
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(opt.accountType).bg, marginBottom: 0, paddingVertical: 2, paddingHorizontal: 6 }]}>
                <Text style={[styles.typeBadgeText, { color: getTypeColor(opt.accountType).text, fontSize: fs(8) }]}>
                  {getTypeColor(opt.accountType).label}
                </Text>
              </View>
            )}
          </View>
        </View>
        {isSelected && (
          <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
            <Text style={{ color: '#FFF', fontSize: 8 }}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.dropdownContainer, containerStyle]}>
      {label && (
        <View style={styles.dropdownLabelRow}>
          <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
        </View>
      )}
      <TouchableOpacity
        style={[
          styles.dropdownToggle, 
          { backgroundColor: theme.surface, borderColor: theme.borderDark },
          disabled && { opacity: 0.5, borderColor: theme.border }
        ]}
        disabled={disabled}
        onPress={() => setIsOpen(true)}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {Icon && <Icon size={18} color={selectedOption ? theme.primary : theme.textSubtle} />}
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text
              style={[
                styles.dropdownToggleText, 
                { color: selectedOption ? theme.primary : theme.text, fontSize: fs(14), fontWeight: '700' }, 
                !selectedOption && { color: theme.textSubtle, fontWeight: '400' }
              ]}
              numberOfLines={1}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
            {selectedOption?.accountType && (
              <View style={[styles.typeBadge, { backgroundColor: getTypeColor(selectedOption.accountType).bg, marginBottom: 0, marginRight: 0 }]}>
                <Text style={[styles.typeBadgeText, { color: getTypeColor(selectedOption.accountType).text }]}>
                  {getTypeColor(selectedOption.accountType).label}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text style={{ color: theme.textSubtle, fontSize: 10, marginLeft: 8 }}>▼</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent={true} animationType="slide" statusBarTranslucent>
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', width: '100%' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: theme.surface }]}>
               <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <View style={styles.headerIndicator} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 12 }}>
                  <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(15) }]}>{label || 'Select'}</Text>
                  <TouchableOpacity onPress={() => setIsOpen(false)} style={[styles.closeBtn, { backgroundColor: theme.border + '50' }]}>
                    <Text style={{ color: theme.text, fontSize: fs(10), fontWeight: '900' }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {showTabs && groups && (
                  <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
                    {Object.keys(groups).map((groupKey) => {
                      const tc = getTypeColor(groupKey);
                      const isActive = activeTab === groupKey;
                      return (
                        <TouchableOpacity 
                          key={groupKey}
                          style={[styles.tabItem, isActive && { borderBottomColor: theme.primary }]}
                          onPress={() => setActiveTab(groupKey)}
                        >
                          <Text style={[styles.tabText, { color: isActive ? theme.primary : theme.textMuted }]}>
                            {tc.label.split(' ')[0]} {/* Use just 'Bank', 'Credit', etc. */}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
              <ScrollView 
                style={styles.modalScroll} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
              >
                {groups ? (
                  showTabs ? (
                    <View style={{ gap: 8, marginTop: 12 }}>
                      {groups[activeTab]?.map((opt, i) => renderItem(opt, i))}
                    </View>
                  ) : (
                    Object.entries(groups).map(([groupKey, groupOpts], gIdx) => {
                      const tc = getTypeColor(groupKey);
                      const showHeader = Object.keys(groups).length > 1;
                      return (
                        <View key={gIdx} style={{ marginBottom: 12 }}>
                          {showHeader && (
                            <View style={[styles.groupHeader, { backgroundColor: isDark ? theme.border + '40' : tc.bg + '50', borderRadius: 8 }]}>
                              <Text style={[styles.groupHeaderText, { color: isDark ? '#FFF' : '#333' }]}>{tc.label}</Text>
                            </View>
                          )}
                          {groupOpts.map((opt, i) => renderItem(opt, `${gIdx}-${i}`))}
                        </View>
                      );
                    })
                  )
                ) : (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {options.map(renderItem)}
                  </View>
                )}
                {options.length === 0 && (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(14), fontWeight: '600' }}>No options available</Text>
                  </View>
                )}
              </ScrollView>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  dropdownContainer: { marginBottom: 12 },
  dropdownLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dropdownToggle: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dropdownToggleText: { flex: 1, textAlignVertical: 'center', includeFontPadding: false },

  // Bottom Sheet modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '50%',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 20,
    paddingTop: 10,
  },
  headerIndicator: {
    width: 40,
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 8,
  },
  modalHeader: {
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: { fontWeight: '800', letterSpacing: 0.5 },
  modalScroll: { marginTop: 12 },

  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalItemText: { fontSize: 15, flex: 1, textAlignVertical: 'center', includeFontPadding: false },
  itemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
  checkCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Group header
  groupHeader: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  groupHeaderText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Type badge (shown in the row and in the toggle button)
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  tabItem: {
    paddingVertical: 12,
    marginRight: 24,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default CustomDropdown;
