import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserTheme, updateThemePreference, getUserFontScale, updateFontScale, getDashboardGraphs, updateDashboardGraphs, getCategories, getForecastDuration, getAutoBackupSettings, importData, updateUserBiometrics, updateForecastDuration, updateAutoBackupSettings, exportData, resetDatabase } from '../services/storage';
import { User, Fingerprint, LogOut, ShieldAlert, Moon, Type, CalendarDays, Database, Upload, Download, CalendarClock, PieChart, Layout, X, Plus, Trash2, Edit2, CheckCircle2, Circle, ChevronUp, ChevronDown, ChevronRight, ArrowLeft } from 'lucide-react-native';
import CustomDropdown from '../components/CustomDropdown';

export default function SettingsScreen() {
  const { activeUser, updateUser, logout } = useAuth();
  const { theme, fs, themeMode, toggleTheme, fontScale, setFontScalePreference, dashboardGraphs, setDashboardGraphsPreference, customGraphs, setCustomGraphsPreference, graphOrder, setGraphOrderPreference, isSettingsOpen, setIsSettingsOpen } = useTheme();

  const [activeCategory, setActiveCategory] = useState(null); // 'APPEARANCE' | 'FINANCIAL' | 'SECURITY' | 'BACKUP'

  const [isBioEnabled, setIsBioEnabled] = useState(activeUser?.biometricsEnabled === 1);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  
  const [showGraphsModal, setShowGraphsModal] = useState(false);
  const [showCustomGraphsModal, setShowCustomGraphsModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newGraphName, setNewGraphName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [editingGraphId, setEditingGraphId] = useState(null);
  
  const [showWipePinModal, setShowWipePinModal] = useState(false);
  const [wipePin, setWipePin] = useState('');
  const [wipePinError, setWipePinError] = useState('');
  const isDarkMode = themeMode === 'dark';

  useEffect(() => {
    if (!activeUser?.id) return;
    const loadSettings = async () => {
      const duration = await getForecastDuration(activeUser.id);
      setForecastMonths(duration);
      const backupSettings = await getAutoBackupSettings(activeUser.id);
      setAutoBackupEnabled(backupSettings.enabled);
    };
    const loadCategories = async () => {
      const cats = await getCategories(activeUser.id, 'EXPENSE');
      setCategories(cats);
    };
    loadSettings();
    loadCategories();
  }, [activeUser?.id]);

  const handleUpdateForecast = async (val) => {
    await updateForecastDuration(activeUser.id, val);
    setForecastMonths(val);
  };

  const handleToggleBiometrics = async (val) => {
    if (val) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        Alert.alert('Unsupported', 'Your device does not have fingerprint/face hardware enabled.');
        return;
      }
    }
    await updateUserBiometrics(activeUser.id, val);
    setIsBioEnabled(val);
    updateUser({ ...activeUser, biometricsEnabled: val ? 1 : 0 });
  };

  const handleToggleAutoBackup = async (val) => {
    await updateAutoBackupSettings(activeUser.id, val);
    setAutoBackupEnabled(val);
  };

  const handleWipe = () => {
    setWipePin('');
    setWipePinError('');
    setShowWipePinModal(true);
  };

  const confirmWipe = async () => {
    if (wipePin !== activeUser.pin) {
      setWipePinError('Incorrect PIN. Please try again.');
      setWipePin('');
      return;
    }
    setShowWipePinModal(false);
    Alert.alert(
      'Final Confirmation',
      'This will permanently erase all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Erase Everything', style: 'destructive', onPress: async () => {
            await resetDatabase();
            setIsSettingsOpen(false);
            logout();
        }},
      ]
    );
  };

  const handleBackup = async () => {
    try {
      const json = await exportData(activeUser.id);
      const fileUri = `${FileSystem.cacheDirectory}expense_tracker_backup_${new Date().getTime()}.json`;
      await FileSystem.writeAsStringAsync(fileUri, json);
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export your financial data',
          UTI: 'public.json'
        });
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not supported on this platform/device.');
      }
    } catch (error) {
      console.error('Backup failed:', error);
      Alert.alert('Error', 'Failed to create backup: ' + error.message);
    }
  };

  const getOrderedGraphs = () => {
    const defaultKeys = [
      { id: 'monthlyTrends', name: 'Monthly Trends', alwaysOn: true },
      { id: 'totalSavings', name: 'Total Savings Breakdown' },
      { id: 'totalCcOutstanding', name: 'Total CC Outstandings' },
      { id: 'nonEmiCcOutstanding', name: 'CC (Excl. EMIs)' },
      { id: 'monthlyExpenseSplit', name: 'Monthly Expense Split' },
      { id: 'totalLiabilities', name: 'Total Liabilities Breakdown' }
    ];
    
    const fullDefaultOrder = [
      'monthlyTrends', 'totalSavings', 'totalCcOutstanding', 
      'nonEmiCcOutstanding', 'monthlyExpenseSplit', 'totalLiabilities',
      ...(customGraphs || []).map(g => g.id)
    ];

    const currentOrder = (graphOrder && graphOrder.length > 0) ? graphOrder : fullDefaultOrder;
    
    const graphsMap = {};
    defaultKeys.forEach(k => {
      graphsMap[k.id] = { ...k, type: 'default', enabled: dashboardGraphs[k.id] };
    });
    (customGraphs || []).forEach(g => {
      graphsMap[g.id] = { ...g, type: 'custom' };
    });

    const ordered = currentOrder
      .filter(id => graphsMap[id])
      .map(id => graphsMap[id]);
      
    Object.keys(graphsMap).forEach(id => {
      if (!currentOrder.includes(id)) {
        ordered.push(graphsMap[id]);
      }
    });

    return ordered;
  };

  const moveGraph = (index, direction) => {
    const list = getOrderedGraphs();
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= list.length) return;
    
    const newList = [...list];
    const item = newList.splice(index, 1)[0];
    newList.splice(newIndex, 0, item);
    
    setGraphOrderPreference(newList.map(g => g.id));
  };
  
  const handleRestore = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        
        Alert.alert(
          'Confirm Restore',
          'This will OVERWRITE all your current data with the selected backup. Proceed?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore Now', style: 'destructive', onPress: async () => {
                try {
                  await importData(activeUser.id, fileContent);
                  Alert.alert('Success', 'Data restored successfully. Please restart the app.', [
                    { text: 'OK', onPress: () => { setIsSettingsOpen(false); logout(); } }
                  ]);
                } catch (err) {
                  Alert.alert('Restore Failed', err.message);
                }
            }},
          ]
        );
      }
    } catch (error) {
      console.error('Restore failed:', error);
      Alert.alert('Error', 'Failed to restore: ' + error.message);
    }
  };

  const handleSaveCustomGraph = async () => {
    if (!newGraphName.trim() || selectedCategories.length === 0) {
      Alert.alert('Error', 'Please provide a name and select at least one category.');
      return;
    }
    let updatedGraphs;
    if (editingGraphId) {
      updatedGraphs = customGraphs.map(g => 
        g.id === editingGraphId ? { ...g, name: newGraphName, categoryIds: selectedCategories } : g
      );
    } else {
      updatedGraphs = [...customGraphs, {
        id: Math.random().toString(36).substr(2, 9),
        name: newGraphName,
        categoryIds: selectedCategories,
        enabled: true
      }];
    }
    await setCustomGraphsPreference(updatedGraphs);
    resetCustomForm();
  };

  const resetCustomForm = () => {
    setNewGraphName('');
    setSelectedCategories([]);
    setEditingGraphId(null);
    setShowAddCustomModal(false);
  };

  const handleDeleteCustomGraph = (id) => {
    Alert.alert('Delete Graph', 'Are you sure you want to delete this custom graph?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const updated = customGraphs.filter(g => g.id !== id);
        await setCustomGraphsPreference(updated);
      }}
    ]);
  };

  const handleEditCustomGraph = (graph) => {
    setNewGraphName(graph.name);
    setSelectedCategories(graph.categoryIds);
    setEditingGraphId(graph.id);
    setShowAddCustomModal(true);
  };

  const renderAppearance = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Moon color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Dark Mode</Text>
        </View>
        <Switch value={isDarkMode} onValueChange={(val) => toggleTheme(val ? 'dark' : 'light')} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Type color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Text Size</Text>
        </View>
        <CustomDropdown
          containerStyle={{ marginBottom: 0, minWidth: 120 }}
          selectedValue={fontScale}
          onSelect={setFontScalePreference}
          options={[
            { label: 'Small', value: 'small' },
            { label: 'Medium', value: 'medium' },
            { label: 'Large', value: 'large' },
          ]}
        />
      </View>
    </View>
  );

  const renderFinancial = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CalendarDays color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Forecast Horizon</Text>
        </View>
        <CustomDropdown
          containerStyle={{ marginBottom: 0, minWidth: 120 }}
          selectedValue={forecastMonths}
          onSelect={handleUpdateForecast}
          options={[
            { label: '3 Months', value: 3 },
            { label: '6 Months', value: 6 },
            { label: '9 Months', value: 9 },
            { label: '12 Months', value: 12 },
          ]}
        />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={() => setShowGraphsModal(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PieChart color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Dashboard Graphs</Text>
        </View>
        <Layout color={theme.textSubtle} size={20} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={() => setShowCustomGraphsModal(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Layout color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Custom Graphs</Text>
        </View>
        <Plus color={theme.textSubtle} size={20} />
      </TouchableOpacity>
    </View>
  );

  const renderSecurity = () => (
    <>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Fingerprint color={theme.primary} size={22} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Enable Fingerprint / FaceID Login</Text>
          </View>
          <Switch value={isBioEnabled} onValueChange={handleToggleBiometrics} />
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>DANGER ZONE</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={styles.row} onPress={handleWipe}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ShieldAlert color={theme.danger} size={22} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: theme.danger, fontWeight: 'bold', fontSize: fs(16) }]}>Erase All App Data</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderBackup = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <CalendarClock color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Automatic 24-Hour Backup</Text>
        </View>
        <Switch value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={handleBackup}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Upload color={theme.success} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Manual Backup to File</Text>
        </View>
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={handleRestore}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Download color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]}>Restore from File</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const CategoryMenuItem = ({ title, icon: Icon, value }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 12 }]} onPress={() => setActiveCategory(value)}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ backgroundColor: theme.primarySoft, padding: 8, borderRadius: 10, marginRight: 16 }}>
          <Icon color={theme.primary} size={24} />
        </View>
        <Text style={[styles.rowText, { color: theme.text, fontSize: fs(17), fontWeight: '600' }]}>{title}</Text>
      </View>
      <ChevronRight color={theme.textSubtle} size={22} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={isSettingsOpen} animationType="slide" onRequestClose={() => setIsSettingsOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        
        {/* Header Setup based on Active Category */}
        <View style={[styles.headerContainer, { borderBottomColor: theme.border }]}>
          {!activeCategory ? (
            <>
              <Text style={[styles.headerTitle, { color: theme.text, fontSize: fs(24) }]}>Profile & Settings</Text>
              <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.iconButton}>
                <X color={theme.textSubtle} size={28} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setActiveCategory(null)} style={styles.iconButton}>
                  <ArrowLeft color={theme.text} size={28} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.text, fontSize: fs(20), marginLeft: 8 }]}>
                  {activeCategory === 'APPEARANCE' ? 'Appearance' : 
                   activeCategory === 'FINANCIAL' ? 'Financial Planning' :
                   activeCategory === 'SECURITY' ? 'Security' : 'Backup & Recovery'}
                </Text>
              </View>
            </>
          )}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
          {!activeCategory ? (
            <>
              <View style={styles.profileHeader}>
                <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                  <User color={theme.primary} size={48} />
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[styles.name, { color: theme.text, fontSize: fs(26) }]}>{activeUser?.username}</Text>
                  <Text style={[styles.badge, { backgroundColor: theme.primary }]}>Local Device Profile</Text>
                </View>
              </View>
              
              <View style={{ marginTop: 24 }}>
                <CategoryMenuItem title="Appearance" icon={Moon} value="APPEARANCE" />
                <CategoryMenuItem title="Financial Planning" icon={PieChart} value="FINANCIAL" />
                <CategoryMenuItem title="Security" icon={Fingerprint} value="SECURITY" />
                <CategoryMenuItem title="Backup & Recovery" icon={Database} value="BACKUP" />
              </View>

              <TouchableOpacity style={[styles.logoutBtn, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]} onPress={() => { setIsSettingsOpen(false); logout(); }}>
                <LogOut color={theme.danger} size={22} style={{ marginRight: 10 }} />
                <Text style={{ color: theme.danger, fontWeight: 'bold', fontSize: fs(16) }}>Lock App</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {activeCategory === 'APPEARANCE' && renderAppearance()}
              {activeCategory === 'FINANCIAL' && renderFinancial()}
              {activeCategory === 'SECURITY' && renderSecurity()}
              {activeCategory === 'BACKUP' && renderBackup()}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* DASHBOARD GRAPHS MODAL (FLOATING) */}
      <Modal visible={showGraphsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGraphsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: fs(18) }}>Dashboard Graphs</Text>
            <TouchableOpacity onPress={() => setShowGraphsModal(false)}><X color={theme.textSubtle} size={24} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginVertical: 12, fontStyle: 'italic' }}>Use arrows to reorder. Monthly Trends is always at selected position.</Text>
            {getOrderedGraphs().map((graph, index, all) => (
              <View key={graph.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'column', marginRight: 12 }}>
                    <TouchableOpacity onPress={() => moveGraph(index, -1)} disabled={index === 0}><ChevronUp color={index === 0 ? theme.border : theme.primary} size={20} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => moveGraph(index, 1)} disabled={index === all.length - 1}><ChevronDown color={index === all.length - 1 ? theme.border : theme.primary} size={20} /></TouchableOpacity>
                  </View>
                  <Text style={{ fontWeight: '500', color: theme.text, fontSize: fs(16), flex: 1 }}>{graph.name}</Text>
                </View>
                {graph.alwaysOn ? <CheckCircle2 color={theme.success} size={24} /> : (
                  <Switch value={graph.enabled} onValueChange={(val) => {
                    if (graph.type === 'default') setDashboardGraphsPreference({ ...dashboardGraphs, [graph.id]: val });
                    else setCustomGraphsPreference(customGraphs.map(g => g.id === graph.id ? { ...g, enabled: val } : g));
                  }} />
                )}
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary, marginBottom: 20, marginHorizontal: 20 }]} onPress={() => setShowGraphsModal(false)}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(16) }}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* CUSTOM GRAPHS MANAGEMENT MODAL */}
      <Modal visible={showCustomGraphsModal} transparent animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={[{ width: '100%', borderRadius: 16, padding: 20, backgroundColor: theme.surface, maxHeight: '80%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: fs(20) }}>Manage Custom Graphs</Text>
              <TouchableOpacity onPress={() => setShowCustomGraphsModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {customGraphs.length === 0 ? (
                <View style={{ paddingVertical: 32, alignItems: 'center' }}><Text style={{ color: theme.textSubtle, fontStyle: 'italic' }}>No custom graphs yet.</Text></View>
              ) : customGraphs.map(graph => (
                <View key={graph.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '500', color: theme.text, fontSize: fs(16) }}>{graph.name}</Text>
                    <Text style={{ color: theme.textSubtle, fontSize: fs(12) }}>{graph.categoryIds.length} categories</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity onPress={() => handleEditCustomGraph(graph)}><Edit2 color={theme.primary} size={20} /></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteCustomGraph(graph.id)}><Trash2 color={theme.danger} size={20} /></TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary, flexDirection: 'row', gap: 8, justifyContent: 'center' }]} onPress={() => setShowAddCustomModal(true)}>
              <Plus color="white" size={20} />
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(16) }}>Add New Graph</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ADD/EDIT CUSTOM GRAPH MODAL */}
      <Modal visible={showAddCustomModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[{ width: '100%', borderRadius: 16, padding: 20, maxWidth: 400, backgroundColor: theme.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: fs(20) }}>{editingGraphId ? 'Edit' : 'New'} Custom Graph</Text>
              <TouchableOpacity onPress={resetCustomForm}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginBottom: 8 }}>Graph Name</Text>
            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, borderColor: theme.border, backgroundColor: theme.background }}>
                <Layout color={theme.textSubtle} size={20} style={{ marginRight: 10 }} />
                <TextInput style={{ flex: 1, color: theme.text, height: 50 }} placeholder="e.g. My Savings" placeholderTextColor={theme.textMuted} value={newGraphName} onChangeText={setNewGraphName} />
              </View>
            </View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginBottom: 8 }}>Select Categories</Text>
            <View style={{ maxHeight: 250 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }} onPress={() => setSelectedCategories(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}>
                    <Text style={{ color: theme.text, fontSize: fs(14) }}>{cat.name}</Text>
                    {selectedCategories.includes(cat.id) ? <CheckCircle2 color={theme.success} size={20} /> : <Circle color={theme.textSubtle} size={20} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary, marginTop: 24 }]} onPress={handleSaveCustomGraph}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(16) }}>Save Graph</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PIN WIPE MODAL */}
      <Modal visible={showWipePinModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 28, width: '100%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ShieldAlert color={theme.danger} size={24} />
              <Text style={{ color: theme.danger, fontSize: fs(18), fontWeight: 'bold' }}>Verify PIN</Text>
            </View>
            <Text style={{ color: theme.textSubtle, fontSize: fs(14), marginBottom: 20 }}>Enter your 4-digit PIN to confirm erasing all app data.</Text>
            <TextInput style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: wipePinError ? theme.danger : theme.border, borderRadius: 10, padding: 14, fontSize: fs(18), color: theme.text, letterSpacing: 8, textAlign: 'center', marginBottom: 8 }} keyboardType="numeric" maxLength={4} secureTextEntry value={wipePin} onChangeText={(v) => { setWipePin(v); setWipePinError(''); }} placeholder="••••" placeholderTextColor={theme.textSubtle} autoFocus />
            {wipePinError ? <Text style={{ color: theme.danger, fontSize: fs(12), marginBottom: 12, textAlign: 'center' }}>{wipePinError}</Text> : <View style={{ height: 20 }} />}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: theme.border, alignItems: 'center' }} onPress={() => setShowWipePinModal(false)}>
                <Text style={{ color: theme.textSubtle, fontWeight: '600', fontSize: fs(15) }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 10, backgroundColor: theme.danger, alignItems: 'center' }} onPress={confirmWipe}>
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(15) }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </Modal>
  );
}

const styles = StyleSheet.create({
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  headerTitle: { fontWeight: '800' },
  iconButton: { padding: 4 },
  profileHeader: { alignItems: 'center', marginVertical: 32 },
  avatar: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  name: { fontWeight: 'bold' },
  badge: { color: 'white', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', marginTop: 8, fontSize: 13, fontWeight: 'bold' },
  sectionTitle: { fontWeight: 'bold', marginBottom: 8, marginLeft: 8, marginTop: 16 },
  card: { borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  rowText: { fontWeight: '500' },
  divider: { height: 1, marginVertical: 4 },
  logoutBtn: { padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 24 },
  closeBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
});
