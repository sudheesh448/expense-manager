import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal, TextInput,
} from 'react-native';
import { X, Check, Plus } from 'lucide-react-native';
import { saveCategory } from '../../services/storage';
import CustomHeader from '../CustomHeader';
import { useTheme } from '../../context/ThemeContext';

export default function CategorySelectionModal({ visible, categories, selectedIds, onClose, onSelect }) {
  const { theme, fs } = useTheme();
  const [tempIds, setTempIds] = useState([]);
  
  // New Category States
  const [localCategories, setLocalCategories] = useState(categories || []);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    setLocalCategories(categories || []);
  }, [categories]);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
        // We implicitly assume EXPENSE for budgets, though categorized budgets can be both.
        // For simplicity, we create as EXPENSE.
        const cat = await saveCategory(null, newCategoryName.trim(), 'EXPENSE');
        setLocalCategories(prev => [...prev, cat]);
        setTempIds(prev => [...prev, cat.id]);
        setNewCategoryName('');
        setShowAddCategory(false);
    } catch (e) {
        console.error("Error creating category:", e);
    }
  };

  useEffect(() => {
    if (visible) {
      setTempIds(selectedIds || []);
    }
  }, [visible, selectedIds]);

  const toggleCategory = (id) => {
    setTempIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleDone = () => {
    onSelect(tempIds);
    onClose();
  };

  const systemCats = (localCategories || []).filter(c => c.isSystem === 1);
  const manualCats = (localCategories || []).filter(c => c.isSystem !== 1);

  const renderCategoryItem = (cat) => {
    const isSelected = tempIds.includes(cat.id);
    return (
      <TouchableOpacity 
        key={cat.id} 
        style={[
            styles.catItem, 
            { backgroundColor: theme.surface, borderColor: isSelected ? theme.primary : theme.border }
        ]}
        onPress={() => toggleCategory(cat.id)}
      >
        <View style={styles.catLeft}>
            <View style={[
                styles.checkbox, 
                { 
                    backgroundColor: isSelected ? theme.primary : 'transparent',
                    borderColor: isSelected ? theme.primary : theme.textSubtle
                }
            ]}>
                {isSelected && <Check size={12} color="white" />}
            </View>
            <Text style={[styles.catName, { color: theme.text, fontSize: fs(14) }]}>{cat.name}</Text>
        </View>
        <Text style={[styles.catType, { color: theme.textSubtle, fontSize: fs(10) }]}>{cat.type}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalWrap, { backgroundColor: theme.background }]}>
        <CustomHeader
          title="Select Categories"
          leftComponent={
            <TouchableOpacity onPress={onClose}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
          }
          rightComponent={
              <TouchableOpacity onPress={handleDone}>
                  <Text style={{ color: theme.primary, fontWeight: '700', fontSize: fs(15) }}>Done</Text>
              </TouchableOpacity>
          }
          theme={theme}
          fs={fs}
        />

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
          <View style={{ padding: 16 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 20 }}>
                Select one or more categories to include in this budget.
            </Text>

            {manualCats.length > 0 || true ? (
                <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.groupLabel, { color: theme.primary, fontSize: fs(12), marginBottom: 0 }]}>MANUAL CATEGORIES</Text>
                        <TouchableOpacity 
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                            onPress={() => setShowAddCategory(!showAddCategory)}
                        >
                            <Plus size={14} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontWeight: '800', fontSize: fs(12) }}>
                                {showAddCategory ? 'CANCEL' : 'NEW'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {showAddCategory && (
                        <View style={[styles.addForm, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
                            <TextInput 
                                style={[styles.addInput, { color: theme.text, fontSize: fs(14) }]}
                                placeholder="Category Name"
                                placeholderTextColor={theme.placeholder}
                                value={newCategoryName}
                                onChangeText={setNewCategoryName}
                                autoFocus
                            />
                            <TouchableOpacity style={[styles.addBtn, { backgroundColor: theme.primary }]} onPress={handleCreateCategory}>
                                <Check size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.catGrid}>
                        {manualCats.map(renderCategoryItem)}
                    </View>
                </>
            ) : null}

            {systemCats.length > 0 && (
                <>
                    <Text style={[styles.groupLabel, { color: theme.textMuted, fontSize: fs(12), marginTop: 24 }]}>SYSTEM CATEGORIES</Text>
                    <View style={styles.catGrid}>
                        {systemCats.map(renderCategoryItem)}
                    </View>
                </>
            )}
          </View>
        </ScrollView>
        
        <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
            <Text style={[styles.footerText, { color: theme.text, fontSize: fs(14) }]}>
                {tempIds.length} Categories Selected
            </Text>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: theme.primary }]} onPress={handleDone}>
                <Text style={styles.doneBtnText}>Confirm Selection</Text>
            </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  scroll: { flex: 1 },
  groupLabel: { fontWeight: '800', marginBottom: 12, letterSpacing: 1 },
  catGrid: { gap: 8 },
  catItem: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      paddingHorizontal: 12, 
      paddingVertical: 14, 
      borderRadius: 12, 
      borderWidth: 1,
      width: '100%',
      // Adding a subtle shadow/elevation for better separation
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2
  },
  catLeft: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { 
      width: 20, 
      height: 20, 
      borderRadius: 6, 
      borderWidth: 1.5, 
      marginRight: 12, 
      justifyContent: 'center', 
      alignItems: 'center' 
  },
  catName: { fontWeight: '600' },
  catType: { fontWeight: '700', opacity: 0.6 },
  footer: { 
      padding: 20, 
      paddingBottom: 34, 
      borderTopWidth: 1, 
      flexDirection: 'row', 
      alignItems: 'center', 
      justifyContent: 'space-between' 
  },
  footerText: { fontWeight: '600' },
  doneBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  doneBtnText: { color: 'white', fontWeight: '700' },
  addForm: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      gap: 10, 
      marginBottom: 16, 
      paddingHorizontal: 12, 
      paddingVertical: 8, 
      borderRadius: 14, 
      borderWidth: 1.5,
  },
  addInput: { flex: 1, paddingVertical: 8, fontWeight: '600' },
  addBtn: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }
});
