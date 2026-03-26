import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, History } from 'lucide-react-native';

export default function HistoryModal({ visible, logs, theme, fs, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.modalWrap, { backgroundColor: theme.background, flex: 1 }]} edges={['bottom']}>
        <View style={[styles.modalHeader, { backgroundColor: theme.surface, borderBottomColor: theme.border, paddingTop: insets.top }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X color={theme.text} size={22} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text, fontSize: fs(18) }]}>Account Sessions History</Text>
          <View style={{ width: 22 }} />
        </View>
        
        <FlatList
          data={logs}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[
              styles.logItem, 
              { 
                borderLeftColor: item.action === 'CREATED' ? '#10b981' : item.action === 'DELETED' ? '#ef4444' : '#3b82f6', 
                backgroundColor: theme.surface 
              }
            ]}>
              <View style={styles.logHeader}>
                <Text style={[
                  styles.logAction, 
                  { 
                    fontSize: fs(12), 
                    color: item.action === 'CREATED' ? '#10b981' : item.action === 'DELETED' ? '#ef4444' : '#3b82f6' 
                  }
                ]}>
                  {item.action}
                </Text>
                <Text style={[styles.logTime, { fontSize: fs(10), color: theme.textSubtle }]}>
                  {new Date(item.timestamp).toLocaleString()}
                </Text>
              </View>
              <Text style={[styles.logDetails, { color: theme.text, fontSize: fs(13) }]}>{item.details}</Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <History color={theme.textSubtle} size={40} opacity={0.3} />
              <Text style={[styles.emptyText, { color: theme.textSubtle, fontSize: fs(14) }]}>No account history found.</Text>
            </View>
          }
        />
      </SafeAreaView>
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
  modalTitle: { fontWeight: '800', letterSpacing: -0.5 },
  closeBtn: { padding: 4 },
  logItem: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  logAction: { fontWeight: '700' },
  logTime: {},
  logDetails: {},
  emptyContainer: { padding: 40, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 12, textAlign: 'center' },
});
