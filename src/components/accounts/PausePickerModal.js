import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { pauseRecurringMonths, resumeRecurringMonths, pauseSIPMonths, resumeSIPMonths, getDb } from '../../services/storage';
import { getUpcomingMonths } from '../../utils/accountUtils';
import CustomHeader from '../CustomHeader';
import { useTheme } from '../../context/ThemeContext';

export default function PausePickerModal({ visible, item, onClose, onSuccess }) {
  const { theme, fs } = useTheme();
  const insets = useSafeAreaInsets();
  const [pausedSelection, setPausedSelection] = useState(new Set());

  useEffect(() => {
    if (visible && item) {
      const alreadyPaused = new Set(JSON.parse(item.pausedMonths || '[]'));
      setPausedSelection(alreadyPaused);
    }
  }, [visible, item]);

  const toggleMonth = (mk) => {
    setPausedSelection(prev => {
      const next = new Set(prev);
      if (next.has(mk)) next.delete(mk); else next.add(mk);
      return next;
    });
  };

  const confirmAction = async () => {
    if (!item) return;
    const currentlyPaused  = new Set(JSON.parse(item.pausedMonths || '[]'));
    const toResume = [...currentlyPaused].filter(m => !pausedSelection.has(m));
    const toPause  = [...pausedSelection].filter(m => !currentlyPaused.has(m));
    const db = await getDb();
    if (item.type === 'SIP') {
      if (toPause.length > 0)  await pauseSIPMonths(db, item.id, toPause);
      if (toResume.length > 0) await resumeSIPMonths(db, item.id, toResume);
    } else {
      if (toPause.length > 0)  await pauseRecurringMonths(item.id, toPause);
      if (toResume.length > 0) await resumeRecurringMonths(item.id, toResume);
    }
    
    onSuccess();
    onClose();
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
          title="Pause Months"
          leftComponent={
            <TouchableOpacity onPress={onClose}>
              <X color={theme.text} size={22} />
            </TouchableOpacity>
          }
          rightComponent={
            <TouchableOpacity onPress={confirmAction}>
              <Text style={{ color: theme.primary, fontWeight: '800', fontSize: fs(15) }}>Done</Text>
            </TouchableOpacity>
          }
          theme={theme}
          fs={fs}
        />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={{ color: theme.textSubtle, fontSize: fs(13), marginBottom: 16 }}>
            Tap months to pause (grey out). Tap again to resume. Selected months will have no scheduled payment.
          </Text>
          <View style={styles.chipRow}>
            {getUpcomingMonths(24).map(({ monthKey, label }) => {
              const isPaused = pausedSelection.has(monthKey);
              return (
                <TouchableOpacity
                  key={monthKey}
                  style={[
                    styles.chip, 
                    {
                      backgroundColor: isPaused ? '#f59e0b' : theme.surface,
                      borderColor:     isPaused ? '#f59e0b' : theme.border,
                    }
                  ]}
                  onPress={() => toggleMonth(monthKey)}
                >
                  <Text style={[styles.chipText, { color: isPaused ? 'white' : theme.text, fontSize: fs(13) }]}>
                    {isPaused ? '⏸ ' : ''}{label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrap: { flex: 1 },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  modalTitle: { fontWeight: '800', letterSpacing: -0.5, flex: 1, textAlign: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontWeight: '600' },
});
