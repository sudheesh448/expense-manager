import { ChevronRight, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { saveBudget } from '../../services/storage';
import { getCurrencySymbol } from '../../utils/currencyUtils';
import CustomHeader from '../CustomHeader';
import CategorySelectionModal from './CategorySelectionModal';

export default function AddBudgetModal({ visible, activeUser, categories, onClose, onSuccess, initialData }) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [showCatModal, setShowCatModal] = useState(false);

  useEffect(() => {
    if (visible) {
      if (initialData) {
        setName(initialData.name || '');
        setAmount(initialData.amount?.toString() || '');
        setSelectedCategoryIds(initialData.categoryIds || []);
      } else {
        setName('');
        setAmount('');
        setSelectedCategoryIds([]);
      }
    }
  }, [visible, initialData]);

  const handleSave = async () => {
    if (!name.trim() || !amount || selectedCategoryIds.length === 0) return;

    await saveBudget(activeUser.id, {
      id: initialData?.id,
      name: name.trim(),
      amount: parseFloat(amount),
      categoryIds: selectedCategoryIds
    });

    onSuccess();
    onClose();
  };

  const selectedNames = (categories || [])
    .filter(c => selectedCategoryIds.includes(c.id))
    .map(c => c.name)
    .join(', ');

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <CustomHeader
            title={initialData ? "Edit Budget" : "Add Budget"}
            leftComponent={
              <TouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                <X color={theme.text} size={24} />
              </TouchableOpacity>
            }
            theme={theme}
            fs={fs}
            containerStyle={{ paddingTop: 12 }}
          />

          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
            <View style={{ padding: 16 }}>
              <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13) }]}>Budget Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                placeholder="e.g. Monthly Food & Dining"
                placeholderTextColor={theme.placeholder}
                value={name} onChangeText={setName}
              />

              <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(13), marginTop: 16 }]}>
                Monthly Limit ({getCurrencySymbol(activeUser?.currency)})
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text, fontSize: fs(15) }]}
                placeholder="0.00" placeholderTextColor={theme.textSubtle}
                keyboardType="numeric" value={amount} onChangeText={setAmount}
              />

              <Text style={[styles.sectionTitle, { color: theme.text, fontSize: fs(15), marginTop: 24 }]}>Categories</Text>
              <TouchableOpacity
                style={[styles.selector, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={() => setShowCatModal(true)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.selectorText, { color: selectedCategoryIds.length ? theme.text : theme.textSubtle, fontSize: fs(14) }]}>
                    {selectedCategoryIds.length ? selectedNames : 'Select one or more categories...'}
                  </Text>
                  {selectedCategoryIds.length > 0 && (
                    <Text style={{ color: theme.primary, fontSize: fs(11), fontWeight: '700', marginTop: 4 }}>
                      {selectedCategoryIds.length} Categories Linked
                    </Text>
                  )}
                </View>
                <ChevronRight size={20} color={theme.textSubtle} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.primary, opacity: (name && amount && selectedCategoryIds.length) ? 1 : 0.5 }
                ]}
                onPress={handleSave}
                disabled={!name || !amount || selectedCategoryIds.length === 0}
              >
                <Text style={[styles.saveBtnText, { fontSize: fs(16) }]}>
                  {initialData ? "Update Budget" : "Lock Amount"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <CategorySelectionModal
            visible={showCatModal}
            categories={categories}
            selectedIds={selectedCategoryIds}
            onClose={() => setShowCatModal(false)}
            onSelect={setSelectedCategoryIds}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  scroll: { flex: 1 },
  fieldLabel: { fontWeight: '600', marginBottom: 6 },
  input: { padding: 14, borderRadius: 10, borderWidth: 1 },
  sectionTitle: { fontWeight: '700', marginBottom: 8 },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 56
  },
  selectorText: { fontWeight: '500' },
  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: 'white', fontWeight: '700' },
});
