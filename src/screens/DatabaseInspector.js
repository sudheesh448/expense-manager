import { ChevronLeft, Info, List, Save, Table as TableIcon, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomHeader from '../components/CustomHeader';
import { deleteTableRecord, deleteTableRecords, getTableData, getTables, getTableSchema, updateTableRecord } from '../services/storage/core';

export default function DatabaseInspector({ visible, onClose, theme, fs }) {
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [viewMode, setViewMode] = useState('data'); // 'data' | 'fields'
  const [columns, setColumns] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [schemaData, setSchemaData] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Editing state
  const [editingRecord, setEditingRecord] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      loadTables();
    }
  }, [visible]);

  const loadTables = async () => {
    setLoading(true);
    setError(null);
    try {
      const allTables = await getTables();
      setTables(allTables);
    } catch (err) {
      setError("Failed to load tables: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = async (tableName, mode = 'data') => {
    setSelectedTable(tableName);
    setViewMode(mode);
    setSelectedIds(new Set()); // Reset selection
    try {
      if (mode === 'data') {
        const { columns: cols, rows } = await getTableData(tableName);
        setColumns(cols);
        setTableData(rows);
      } else {
        const schema = await getTableSchema(tableName);
        setSchemaData(schema);
      }
    } catch (err) {
      setError("Failed to load table content: " + err.message);
      setColumns([]);
      setTableData([]);
      setSchemaData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === tableData.length) {
      setSelectedIds(new Set());
    } else {
      const allIds = tableData.map(r => r.id).filter(id => id !== undefined);
      setSelectedIds(new Set(allIds));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      "Bulk Delete",
      `Are you sure you want to delete ${selectedIds.size} selected records?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            setLoading(true);
            try {
              await deleteTableRecords(selectedTable, Array.from(selectedIds));
              setSelectedIds(new Set());
              handleSelectTable(selectedTable, 'data');
            } catch (err) {
              Alert.alert("Bulk Delete Failed", err.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const renderTableItem = ({ item }) => (
    <View style={[styles.tableItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TouchableOpacity
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
        onPress={() => handleSelectTable(item, 'data')}
      >
        <TableIcon color={theme.primary} size={20} style={{ marginRight: 12 }} />
        <Text style={[styles.tableName, { color: theme.text, fontSize: fs(16) }]}>{item}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.fieldsBtn, { backgroundColor: theme.primarySoft }]}
        onPress={() => handleSelectTable(item, 'fields')}
      >
        <Info color={theme.primary} size={18} />
        <Text style={{ color: theme.primary, marginLeft: 4, fontWeight: 'bold', fontSize: fs(12) }}>FIELDS</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDataHeader = () => {
    if (columns.length === 0) return null;
    const headerBg = theme.isDark ? '#334155' : '#f1f5f9';
    const hasIds = tableData.some(r => r.id !== undefined);

    return (
      <View style={[styles.dataHeader, { backgroundColor: theme.surfaceMuted || headerBg, borderBottomColor: theme.border }]}>
        {hasIds && (
          <View style={[styles.headerCell, { width: 40, justifyContent: 'center', alignItems: 'center' }]}>
            <TouchableOpacity onPress={handleToggleSelectAll} style={styles.checkboxTouch}>
              <View style={[
                styles.checkbox, 
                { borderColor: theme.primary },
                selectedIds.size > 0 && selectedIds.size === tableData.length && { backgroundColor: theme.primary }
              ]}>
                {selectedIds.size > 0 && selectedIds.size === tableData.length && <Text style={{ color: 'white', fontSize: 8, textAlign: 'center' }}>✓</Text>}
                {selectedIds.size > 0 && selectedIds.size < tableData.length && <View style={{ height: 2, width: 8, backgroundColor: theme.primary, alignSelf: 'center', marginTop: 4 }} />}
              </View>
            </TouchableOpacity>
          </View>
        )}
        {columns.map((col, idx) => (
          <View key={idx} style={[styles.headerCell, { width: 120 }]}>
            <Text style={[styles.headerText, { color: theme.text, fontSize: fs(11) }]} numberOfLines={1}>{col.toUpperCase()}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderDataRow = ({ item }) => {
    const values = Object.entries(item);
    const isSelected = selectedIds.has(item.id);
    const hasId = item.id !== undefined;

    return (
      <TouchableOpacity
        style={[styles.dataRow, { borderBottomColor: theme.border }, isSelected && { backgroundColor: theme.primary + '10' }]}
        onLongPress={() => handleStartEdit(item)}
        onPress={() => hasId ? toggleSelect(item.id) : handleStartEdit(item)}
      >
        {hasId && (
          <View style={[styles.dataCell, { width: 40, justifyContent: 'center', alignItems: 'center' }]}>
            <View style={[
              styles.checkbox, 
              { borderColor: theme.primary },
              isSelected && { backgroundColor: theme.primary }
            ]}>
              {isSelected && <Text style={{ color: 'white', fontSize: 8, textAlign: 'center' }}>✓</Text>}
            </View>
          </View>
        )}
        {values.map(([key, val], idx) => (
          <View key={idx} style={[styles.dataCell, { width: 120 }]}>
            <Text style={[styles.cellText, { color: theme.text, fontSize: fs(12) }]} numberOfLines={2}>
              {val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
            </Text>
          </View>
        ))}
      </TouchableOpacity>
    );
  };

  const handleStartEdit = (record) => {
    setEditingRecord(record);
    setEditValues({ ...record });
    setEditModalVisible(true);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord || !selectedTable) return;
    setSaving(true);
    try {
      const id = editingRecord.id;
      if (!id) throw new Error("Target record must have an 'id' field for updating.");

      // Remove id from update payload
      const { id: _, ...dataToUpdate } = editValues;
      await updateTableRecord(selectedTable, id, dataToUpdate);
      setEditModalVisible(false);
      handleSelectTable(selectedTable, 'data'); // Refresh
    } catch (err) {
      Alert.alert("Update Failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this record directly from the database?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await deleteTableRecord(selectedTable, editingRecord.id);
              setEditModalVisible(false);
              handleSelectTable(selectedTable, 'data'); // Refresh
            } catch (err) {
              Alert.alert("Delete Failed", err.message);
            } finally {
              setSaving(false);
            }
          }
        }
      ]
    );
  };

  const renderSchemaHeader = () => {
    const headerBg = theme.isDark ? '#334155' : '#f1f5f9';
    const fields = ['NAME', 'TYPE', 'NULL', 'PK', 'DEFAULT'];
    const widths = [140, 100, 60, 40, 100];
    return (
      <View style={[styles.dataHeader, { backgroundColor: theme.surfaceMuted || headerBg, borderBottomColor: theme.border }]}>
        {fields.map((f, i) => (
          <View key={i} style={[styles.headerCell, { width: widths[i] }]}>
            <Text style={[styles.headerText, { color: theme.text, fontSize: fs(11) }]}>{f}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSchemaRow = ({ item }) => (
    <View style={[styles.dataRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.dataCell, { width: 140 }]}>
        <Text style={[styles.cellText, { color: theme.text, fontSize: fs(12), fontWeight: 'bold' }]}>{item.name}</Text>
      </View>
      <View style={[styles.dataCell, { width: 100 }]}>
        <Text style={[styles.cellText, { color: theme.primary, fontSize: fs(11), fontWeight: '600' }]}>{item.type}</Text>
      </View>
      <View style={[styles.dataCell, { width: 60 }]}>
        <Text style={[styles.cellText, { color: theme.text, fontSize: fs(12) }]}>{item.notnull ? 'NO' : 'YES'}</Text>
      </View>
      <View style={[styles.dataCell, { width: 40 }]}>
        <Text style={[styles.cellText, { color: item.pk ? theme.success : theme.textSubtle, fontSize: fs(11), fontWeight: item.pk ? 'bold' : 'normal' }]}>{item.pk ? 'PK' : '-'}</Text>
      </View>
      <View style={[styles.dataCell, { width: 100 }]}>
        <Text style={[styles.cellText, { color: theme.textSubtle, fontSize: fs(11) }]} numberOfLines={1}>{item.dflt_value || '-'}</Text>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
        <CustomHeader
          title={selectedTable ? `${selectedTable}` : "Database Inspector"}
          leftComponent={
            selectedTable ? (
              <TouchableOpacity onPress={() => setSelectedTable(null)} style={styles.iconButton}>
                <ChevronLeft color={theme.text} size={28} />
              </TouchableOpacity>
            ) : null
          }
          rightComponent={
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <X color={theme.textSubtle} size={28} />
            </TouchableOpacity>
          }
          theme={theme}
          fs={fs}
        />

        <View style={{ flex: 1 }}>
          {loading && !selectedTable ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={{ color: theme.danger, textAlign: 'center', padding: 20 }}>{error}</Text>
              <TouchableOpacity onPress={loadTables} style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !selectedTable ? (
            <FlatList
              data={tables}
              renderItem={renderTableItem}
              keyExtractor={item => item}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={{ color: theme.textSubtle, textAlign: 'center', marginTop: 32 }}>No tables found.</Text>}
            />
          ) : (
            <View style={{ flex: 1 }}>
              <View style={[styles.toggleBar, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === 'data' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => handleSelectTable(selectedTable, 'data')}
                >
                  <List size={16} color={viewMode === 'data' ? 'white' : theme.textSubtle} />
                  <Text style={[styles.toggleText, { color: viewMode === 'data' ? 'white' : theme.textSubtle, fontSize: fs(13) }]}>View Data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, viewMode === 'fields' && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                  onPress={() => handleSelectTable(selectedTable, 'fields')}
                >
                  <Info size={16} color={viewMode === 'fields' ? 'white' : theme.textSubtle} />
                  <Text style={[styles.toggleText, { color: viewMode === 'fields' ? 'white' : theme.textSubtle, fontSize: fs(13) }]}>View Fields</Text>
                </TouchableOpacity>
              </View>
              
              {selectedIds.size > 0 && (
                <View style={[styles.selectionActions, { backgroundColor: theme.surfaceMuted || (theme.isDark ? '#1e293b' : '#f8fafc'), borderBottomColor: theme.border }]}>
                  <Text style={[styles.selectionText, { color: theme.text, fontSize: fs(14) }]}>
                    <Text style={{ fontWeight: 'bold', color: theme.primary }}>{selectedIds.size}</Text> records selected
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity 
                      style={[styles.bulkCancelBtn, { borderColor: theme.border }]}
                      onPress={() => setSelectedIds(new Set())}
                    >
                      <Text style={{ color: theme.textSubtle, fontWeight: '600', fontSize: fs(12) }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.bulkDeleteBtn, { backgroundColor: theme.danger }]}
                      onPress={handleBulkDelete}
                    >
                      <Trash2 color="white" size={16} />
                      <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 6, fontSize: fs(12) }}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                <View>
                  {viewMode === 'data' ? renderDataHeader() : renderSchemaHeader()}
                  <FlatList
                    data={viewMode === 'data' ? tableData : schemaData}
                    renderItem={viewMode === 'data' ? renderDataRow : renderSchemaRow}
                    keyExtractor={(item, index) => index.toString()}
                    ListEmptyComponent={<Text style={{ color: theme.textSubtle, textAlign: 'center', marginTop: 32, paddingHorizontal: 20 }}>No information available.</Text>}
                  />
                </View>
              </ScrollView>
              {loading && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              )}
            </View>
          )}
        </View>

        {!selectedTable && (
          <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(10), textAlign: 'center' }}>
              SQLite Browser v1.1 • Viewing expenses_secure.db
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* Edit Record Modal */}
      <Modal visible={editModalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.editModalContainer}>
            <View style={[styles.editModalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.editHeader}>
                <Text style={[styles.editTitle, { color: theme.text, fontSize: fs(18) }]}>Edit {selectedTable} Entry</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                  <X color={theme.textSubtle} size={24} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.editForm}>
                {Object.keys(editValues).map((key) => (
                  <View key={key} style={styles.editField}>
                    <Text style={[styles.fieldLabel, { color: theme.textMuted, fontSize: fs(10) }]}>{key.toUpperCase()}</Text>
                    <TextInput
                      style={[
                        styles.editInput,
                        {
                          backgroundColor: theme.background,
                          borderColor: theme.border,
                          color: theme.text,
                          opacity: key === 'id' ? 0.5 : 1
                        }
                      ]}
                      value={String(editValues[key] === null ? '' : editValues[key])}
                      onChangeText={(text) => setEditValues({ ...editValues, [key]: text })}
                      editable={key !== 'id'}
                      placeholder="Value"
                      placeholderTextColor={theme.textSubtle}
                    />
                  </View>
                ))}
              </ScrollView>

              <View style={styles.editFooter}>
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: theme.danger }]}
                  onPress={handleDeleteRecord}
                >
                  <Trash2 color={theme.danger} size={20} />
                  <Text style={[styles.deleteText, { color: theme.danger, fontSize: fs(13) }]}>DELETE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                  onPress={handleUpdateRecord}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator size="small" color="white" /> : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Save color="white" size={20} />
                      <Text style={[styles.saveText, { fontSize: fs(13) }]}>SAVE CHANGES</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconButton: { padding: 4 },
  tableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1
  },
  tableName: { fontWeight: '600' },
  fieldsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 12 },
  toggleBar: { flexDirection: 'row', padding: 12, gap: 10, borderBottomWidth: 1 },
  toggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  toggleText: { fontWeight: '600' },
  dataHeader: { flexDirection: 'row', borderBottomWidth: 1 },
  headerCell: { padding: 12, borderRightWidth: 0.5, borderRightColor: '#ccc' },
  headerText: { fontWeight: '900', letterSpacing: 0.5 },
  dataRow: { flexDirection: 'row', borderBottomWidth: 0.5 },
  dataCell: { padding: 10, borderRightWidth: 0.5, borderRightColor: '#eee', justifyContent: 'center' },
  cellText: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  editModalContainer: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%'
  },
  editModalContent: {
    borderRadius: 20,
    borderWidth: 1.2,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 }
  },
  editHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc'
  },
  editTitle: { fontWeight: 'bold' },
  editForm: { padding: 20 },
  editField: { marginBottom: 16 },
  fieldLabel: { fontWeight: '900', marginBottom: 6, opacity: 0.8 },
  editInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.2,
    fontSize: 14,
    fontWeight: '500'
  },
  editFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#ccc'
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8
  },
  saveText: { color: 'white', fontWeight: 'bold' },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.2,
    gap: 6
  },
  deleteText: { fontWeight: 'bold' },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center'
  },
  checkboxSelected: {
    backgroundColor: '#06b6d4'
  },
  selectionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  selectionText: { fontWeight: '500' },
  bulkDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    elevation: 2
  },
  bulkCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center'
  }
});
