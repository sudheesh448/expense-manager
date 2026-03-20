import React, { useState } from 'react';
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

const CustomDropdown = ({ label, options, selectedValue, onSelect, placeholder = "Select...", containerStyle, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { theme } = useTheme();

  const selectedOption = options.find(o => o.value === selectedValue);
  const groups = groupOptions(options);

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
          { borderBottomColor: theme.border },
          isSelected && { backgroundColor: theme.primarySoft },
        ]}
        onPress={() => handleSelect(opt.value)}
        activeOpacity={0.7}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text
            style={[
              styles.modalItemText,
              { color: isSelected ? theme.primary : theme.text },
              isSelected && { fontWeight: 'bold' },
            ]}
            numberOfLines={1}
          >
            {opt.label}
          </Text>
        </View>
        {isSelected && (
          <Text style={{ color: theme.primary, fontSize: 18, marginLeft: 8 }}>✓</Text>
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
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {selectedOption?.accountType && (
            <View style={[styles.typeBadge, { backgroundColor: getTypeColor(selectedOption.accountType).bg }]}>
              <Text style={[styles.typeBadgeText, { color: getTypeColor(selectedOption.accountType).text }]}>
                {getTypeColor(selectedOption.accountType).label}
              </Text>
            </View>
          )}
          <Text
            style={[styles.dropdownToggleText, { color: theme.text }, !selectedOption && { color: theme.textSubtle }]}
            numberOfLines={1}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 8 }}>▼</Text>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent={true} animationType="fade" statusBarTranslucent>
        <TouchableOpacity
          style={styles.modalOverlay}
          onPress={() => setIsOpen(false)}
          activeOpacity={1}
        >
          {/* Inner TouchableOpacity to prevent closing when tapping the modal content */}
          <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{label || 'Select Option'}</Text>
              <TouchableOpacity onPress={() => setIsOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: theme.textSubtle, fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {groups ? (
                Object.entries(groups).map(([groupKey, groupOpts], gIdx) => {
                  const tc = getTypeColor(groupKey);
                  return (
                    <View key={gIdx}>
                      <View style={[styles.groupHeader, { backgroundColor: tc.bg }]}>
                        <Text style={[styles.groupHeaderText, { color: tc.text }]}>{tc.label}</Text>
                      </View>
                      {groupOpts.map((opt, i) => renderItem(opt, `${gIdx}-${i}`))}
                    </View>
                  );
                })
              ) : (
                options.map(renderItem)
              )}
              {options.length === 0 && (
                <Text style={{ padding: 24, color: theme.textSubtle, textAlign: 'center' }}>
                  No options available.
                </Text>
              )}
            </ScrollView>
          </TouchableOpacity>
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
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownToggleText: { fontSize: 15, flex: 1 },

  // Centered modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 18,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  modalScroll: { paddingVertical: 4 },

  modalItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalItemText: { fontSize: 15, flex: 1 },

  // Group header
  groupHeader: {
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  groupHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Type badge (shown in the row and in the toggle button)
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default CustomDropdown;
