import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView, Alert, Modal, TextInput } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getUserTheme, updateThemePreference, getUserFontScale, updateFontScale, getDashboardGraphs, updateDashboardGraphs, getCategories, getForecastDuration, getAutoBackupSettings, importData, updateUserBiometrics, updateForecastDuration, updateAutoBackupSettings, exportData, resetDatabase, updateDeveloperMode, updateSandboxEnabled, updateUserTimezone, updateUserCurrency } from '../services/storage';
import { User, Fingerprint, LogOut, ShieldAlert, Moon, Type, CalendarDays, Database, Upload, Download, CalendarClock, PieChart, Layout, X, Plus, Trash2, Edit2, CheckCircle2, Circle, ChevronUp, ChevronDown, ChevronRight, ArrowLeft, Wrench, Globe, Banknote, Landmark, CreditCard, TrendingUp, BarChart2, Building2, HandCoins, Users, Clock, RefreshCw } from 'lucide-react-native';
import { TIMEZONE_OPTIONS, findNearestTimezone } from '../utils/dateUtils';
import { CURRENCY_OPTIONS } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';
import CustomHeader from '../components/CustomHeader';
import DatabaseInspector from './DatabaseInspector';
import DeveloperTools from './DeveloperTools';
import { ShieldCheck } from 'lucide-react-native';

export default function SettingsScreen() {
  const { activeUser, updateUser, logout } = useAuth();
  const { theme, fs, themeMode, toggleTheme, fontScale, setFontScalePreference, accountVisibility, setAccountVisibilityPreference, dashboardGraphs, setDashboardGraphsPreference, customGraphs, setCustomGraphsPreference, graphOrder, setGraphOrderPreference, isSettingsOpen, setIsSettingsOpen } = useTheme();
  const insets = useSafeAreaInsets();

  const [activeCategory, setActiveCategory] = useState(null); // 'APPEARANCE' | 'FINANCIAL' | 'SECURITY' | 'BACKUP'

  const [isBioEnabled, setIsBioEnabled] = useState(activeUser?.biometricsEnabled === 1);
  const [developerMode, setDeveloperMode] = useState(activeUser?.developerMode === 1);
  const [forecastMonths, setForecastMonths] = useState(6);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState(findNearestTimezone(activeUser?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone));
  const [selectedCurrency, setSelectedCurrency] = useState(activeUser?.currency || Intl.NumberFormat?.().resolvedOptions?.().currency || 'INR');
  
  const [showGraphsModal, setShowGraphsModal] = useState(false);
  const [showAccountVisibilityModal, setShowAccountVisibilityModal] = useState(false);
  const [showCustomGraphsModal, setShowCustomGraphsModal] = useState(false);
  const [showAddCustomModal, setShowAddCustomModal] = useState(false);
  const [categories, setCategories] = useState([]);
  const [newGraphName, setNewGraphName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [editingGraphId, setEditingGraphId] = useState(null);
  const [newGraphIsScrollable, setNewGraphIsScrollable] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  
  const [showWipePinModal, setShowWipePinModal] = useState(false);
  const [showDatabaseInspector, setShowDatabaseInspector] = useState(false);
  const [showDeveloperTools, setShowDeveloperTools] = useState(false);
  const [wipePin, setWipePin] = useState('');
  const [wipePinError, setWipePinError] = useState('');
  const [isNuclearWipe, setIsNuclearWipe] = useState(false);
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
      const cats = await getCategories(activeUser.id, 'ALL');
      setCategories(cats.sort((a, b) => (a.isSystem || 0) - (b.isSystem || 0)));
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

  const handleToggleDeveloperMode = async (val) => {
    await updateDeveloperMode(activeUser.id, val);
    setDeveloperMode(val);
    updateUser({ ...activeUser, developerMode: val ? 1 : 0 });
  };
  
  const handleUpdateTimezone = async (val) => {
    await updateUserTimezone(activeUser.id, val);
    setSelectedTimezone(val);
    updateUser({ ...activeUser, timezone: val });
  };

  const handleUpdateCurrency = async (val) => {
    await updateUserCurrency(activeUser.id, val);
    setSelectedCurrency(val);
    updateUser({ ...activeUser, currency: val });
  };

  const handleWipe = () => {
    setIsNuclearWipe(false);
    setWipePin('');
    setWipePinError('');
    setShowWipePinModal(true);
  };

  const handleDevWipe = () => {
    setIsNuclearWipe(true);
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
    
    const title = isNuclearWipe ? 'NUCLEAR DESTRUCTION' : 'Final Confirmation';
    const message = isNuclearWipe 
      ? 'This will DROP ALL TABLES and recreate the database from scratch. ALL user profiles and data will be lost. Continue?'
      : 'This will permanently erase all data. This cannot be undone.';
      
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: isNuclearWipe ? 'DROP DATABASE' : 'Erase Everything', style: 'destructive', onPress: async () => {
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
      { id: 'monthlyInsight', name: 'Monthly Insight', alwaysOn: true },
      { id: 'savingsOverview', name: 'Savings Overview' },
      { id: 'ccDues', name: 'Credit Card Dues' },
      { id: 'ccTotal', name: 'Credit Card Total' }
    ];
    
    const fullDefaultOrder = [
      'monthlyInsight', 'savingsOverview', 'ccDues', 'ccTotal',
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

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const { saveCategory } = await import('../services/storage/transactionStorage');
      await saveCategory(activeUser.id, newCatName.trim(), 'EXPENSE');
      setNewCatName('');
      setShowAddCategoryModal(false);
      // Reload categories
      const cats = await getCategories(activeUser.id, 'ALL');
      setCategories(cats.sort((a, b) => (a.isSystem || 0) - (b.isSystem || 0)));
    } catch (e) {
      Alert.alert('Error', 'Category already exists or failed to save.');
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
        g.id === editingGraphId ? { ...g, name: newGraphName, categoryIds: selectedCategories, isScrollable: newGraphIsScrollable } : g
      );
    } else {
      updatedGraphs = [...customGraphs, {
        id: Math.random().toString(36).substr(2, 9),
        name: newGraphName,
        categoryIds: selectedCategories,
        isScrollable: newGraphIsScrollable,
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
    setNewGraphIsScrollable(true);
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
    setNewGraphIsScrollable(graph.isScrollable !== false); // Default to true if undefined
    setShowAddCustomModal(true);
  };

  const renderAppearance = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Moon color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Dark Mode</Text>
        </View>
        <Switch value={isDarkMode} onValueChange={(val) => toggleTheme(val ? 'dark' : 'light')} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Type color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Text Size</Text>
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
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Globe color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Time Zone</Text>
        </View>
        <CustomDropdown
          containerStyle={{ marginBottom: 0, minWidth: 160 }}
          selectedValue={selectedTimezone}
          onSelect={handleUpdateTimezone}
          options={TIMEZONE_OPTIONS}
        />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Banknote color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Currency</Text>
        </View>
        <CustomDropdown
          containerStyle={{ marginBottom: 0, minWidth: 160 }}
          selectedValue={selectedCurrency}
          onSelect={handleUpdateCurrency}
          options={CURRENCY_OPTIONS}
        />
      </View>
    </View>
  );

  const renderFinancial = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <CalendarDays color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Forecast Horizon</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <PieChart color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Dashboard Graphs</Text>
        </View>
        <Layout color={theme.textSubtle} size={20} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={() => setShowCustomGraphsModal(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Layout color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Custom Graphs</Text>
        </View>
        <Plus color={theme.textSubtle} size={20} />
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={() => setShowAccountVisibilityModal(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Layout color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Account Visibility</Text>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} />
      </TouchableOpacity>
    </View>
  );

  const renderSecurity = () => (
    <>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.row}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
            <Fingerprint color={theme.primary} size={22} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Enable Fingerprint / FaceID Login</Text>
          </View>
          <Switch value={isBioEnabled} onValueChange={handleToggleBiometrics} />
        </View>
      </View>
      <Text style={[styles.sectionTitle, { color: theme.textSubtle, fontSize: fs(12) }]}>DANGER ZONE</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TouchableOpacity style={styles.row} onPress={handleWipe}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
            <ShieldAlert color={theme.danger} size={22} style={{ marginRight: 12 }} />
            <Text style={[styles.rowText, { color: theme.danger, fontWeight: 'bold', fontSize: fs(16) }]} numberOfLines={2}>Erase All App Data</Text>
          </View>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderBackup = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <CalendarClock color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Automatic 24-Hour Backup</Text>
        </View>
        <Switch value={autoBackupEnabled} onValueChange={handleToggleAutoBackup} />
      </View>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={handleBackup}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Upload color={theme.success} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Manual Backup to File</Text>
        </View>
      </TouchableOpacity>
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      <TouchableOpacity style={styles.row} onPress={handleRestore}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Download color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Restore from File</Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderDeveloper = () => (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Wrench color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Floating DB Inspector</Text>
        </View>
        <Switch value={developerMode} onValueChange={handleToggleDeveloperMode} />
      </View>
      
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Plus color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Developer Sandbox Button</Text>
        </View>
        <Switch 
          value={activeUser?.sandboxEnabled === 1} 
          onValueChange={async (val) => {
            await updateSandboxEnabled(activeUser.id, val);
            updateUser({ ...activeUser, sandboxEnabled: val ? 1 : 0 });
          }} 
        />
      </View>
      
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <TouchableOpacity style={styles.row} onPress={() => setShowDatabaseInspector(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <Database color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Database Table Inspector</Text>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} />
      </TouchableOpacity>
      
      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <TouchableOpacity style={styles.row} onPress={() => setShowDeveloperTools(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <ShieldCheck color={theme.primary} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.text, fontSize: fs(16) }]} numberOfLines={2}>Financial Engine Test Suite</Text>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} />
      </TouchableOpacity>
      
      <View style={[styles.divider, { backgroundColor: theme.border }]} />
      
      <TouchableOpacity style={styles.row} onPress={handleDevWipe}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 }}>
          <ShieldAlert color={theme.danger} size={22} style={{ marginRight: 12 }} />
          <Text style={[styles.rowText, { color: theme.danger, fontWeight: 'bold', fontSize: fs(16) }]} numberOfLines={2}>Destroy & Rebuild Database</Text>
        </View>
        <ChevronRight color={theme.textSubtle} size={20} />
      </TouchableOpacity>
    </View>
  );

  const CategoryMenuItem = ({ title, icon: Icon, value }) => (
    <TouchableOpacity style={[styles.card, { backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, marginBottom: 12 }]} onPress={() => setActiveCategory(value)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={{ backgroundColor: theme.primarySoft, padding: 8, borderRadius: 10, marginRight: 16 }}>
          <Icon color={theme.primary} size={24} />
        </View>
        <Text style={[styles.rowText, { color: theme.text, fontSize: fs(17), fontWeight: '600' }]} numberOfLines={2}>{title}</Text>
      </View>
      <ChevronRight color={theme.textSubtle} size={22} />
    </TouchableOpacity>
  );

  return (
    <Modal visible={isSettingsOpen} animationType="slide" onRequestClose={() => setIsSettingsOpen(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['top']}>
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          {/* Header Setup based on Active Category */}
          {!activeCategory ? (
            <CustomHeader 
              title="Profile & Settings"
              rightComponent={
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)} style={styles.iconButton}>
                  <X color={theme.textSubtle} size={28} />
                </TouchableOpacity>
              }
              theme={theme}
              fs={fs}
              containerStyle={{ paddingTop: 12 }}
            />
          ) : (
            <CustomHeader
              title={activeCategory === 'APPEARANCE' ? 'Appearance' : 
                   activeCategory === 'FINANCIAL' ? 'Financial Planning' :
                   activeCategory === 'SECURITY' ? 'Security' : 
                   activeCategory === 'DEVELOPER' ? 'Developer Options' : 'Backup & Recovery'}
              leftComponent={
                <TouchableOpacity onPress={() => setActiveCategory(null)} style={styles.iconButton}>
                  <ArrowLeft color={theme.text} size={28} />
                </TouchableOpacity>
              }
              theme={theme}
              fs={fs}
              containerStyle={{ paddingTop: 12 }}
            />
          )}

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}>
            {!activeCategory ? (
              <>
                <View style={styles.profileHeader}>
                  <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                    <User color={theme.primary} size={48} />
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.name, { color: theme.text, fontSize: fs(26) }]}>{activeUser?.username}</Text>
                  </View>
                </View>
                
                <View style={{ marginTop: 24 }}>
                  <CategoryMenuItem title="Appearance" icon={Moon} value="APPEARANCE" />
                  <CategoryMenuItem title="Financial Planning" icon={PieChart} value="FINANCIAL" />
                  <CategoryMenuItem title="Security" icon={Fingerprint} value="SECURITY" />
                  <CategoryMenuItem title="Backup & Recovery" icon={Database} value="BACKUP" />
                  {process.env.EXPO_PUBLIC_ENABLE_DEV_OPTIONS === 'true' && (
                    <CategoryMenuItem title="Developer Options" icon={Wrench} value="DEVELOPER" />
                  )}
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
                {activeCategory === 'DEVELOPER' && process.env.EXPO_PUBLIC_ENABLE_DEV_OPTIONS === 'true' && renderDeveloper()}
              </>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* ACCOUNT VISIBILITY MODAL */}
      <Modal visible={showAccountVisibilityModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAccountVisibilityModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: insets.top, paddingBottom: 16 }}>
            <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: fs(18) }}>Account Visibility</Text>
            <TouchableOpacity onPress={() => setShowAccountVisibilityModal(false)}><X color={theme.textSubtle} size={24} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, backgroundColor: theme.background, paddingHorizontal: 20 }}>
            <Text style={{ color: theme.textSubtle, fontSize: fs(12), marginVertical: 12, fontStyle: 'italic' }}>Control which account types are visible in the Accounts tab. Bank accounts are always visible.</Text>
            {[
              { key: 'BANK', label: 'Bank Accounts', Icon: Landmark, color: '#3b82f6', canHide: false },
              { key: 'CREDIT_CARD', label: 'Credit Cards', Icon: CreditCard, color: '#8b5cf6', canHide: true },
              { key: 'INVESTMENT', label: 'Investments', Icon: TrendingUp, color: '#10b981', canHide: true },
              { key: 'SIP', label: 'SIPs', Icon: BarChart2, color: '#06b6d4', canHide: true },
              { key: 'LOAN', label: 'Loans', Icon: Building2, color: '#f59e0b', canHide: true },
              { key: 'BORROWED', label: 'Borrowed (Liability)', Icon: HandCoins, color: '#ef4444', canHide: true },
              { key: 'LENDED', label: 'Lended (Asset)', Icon: Users, color: '#10b981', canHide: true },
              { key: 'EMI', label: 'Credit Card EMIs', Icon: Clock, color: '#ec4899', canHide: true },
              { key: 'RECURRING', label: 'Monthly Schedules', Icon: RefreshCw, color: '#ef4444', canHide: true },
            ].map((section) => (
              <View key={section.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ backgroundColor: section.color + '15', padding: 8, borderRadius: 10, marginRight: 16 }}>
                    <section.Icon color={section.color} size={22} />
                  </View>
                  <Text style={{ fontWeight: '500', color: theme.text, fontSize: fs(16) }}>{section.label}</Text>
                </View>
                <Switch 
                  value={accountVisibility[section.key]} 
                  disabled={!section.canHide}
                  onValueChange={(val) => {
                    setAccountVisibilityPreference({ ...accountVisibility, [section.key]: val });
                  }} 
                />
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: theme.primary, marginBottom: 20, marginHorizontal: 20 }]} onPress={() => setShowAccountVisibilityModal(false)}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(16) }}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* DASHBOARD GRAPHS MODAL (FLOATING) */}
      <Modal visible={showGraphsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowGraphsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={['bottom']}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.surface, borderBottomColor: theme.border, borderBottomWidth: 1, paddingHorizontal: 20, paddingTop: insets.top, paddingBottom: 16 }}>
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
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginBottom: 4 }}>Select Categories</Text>
              <Text style={{ fontSize: fs(10), color: theme.textSubtle, fontStyle: 'italic' }}>Interactive pie chart {newGraphIsScrollable ? 'with monthly selector' : 'fixed to current month'} on dashboard</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.background, padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <View>
                <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: '600' }}>Scrollable Graph</Text>
                <Text style={{ color: theme.textSubtle, fontSize: fs(10) }}>Enable historical month selection</Text>
              </View>
              <Switch value={newGraphIsScrollable} onValueChange={setNewGraphIsScrollable} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginBottom: 4 }}>Select Categories</Text>
                <Text style={{ fontSize: fs(10), color: theme.textSubtle, fontStyle: 'italic' }}>Interactive pie chart {newGraphIsScrollable ? 'with monthly selector' : 'fixed to current month'} on dashboard</Text>
              </View>
              <TouchableOpacity 
                style={{ backgroundColor: theme.primary + '15', padding: 8, borderRadius: 10 }}
                onPress={() => setShowAddCategoryModal(true)}
              >
                <Plus color={theme.primary} size={20} />
              </TouchableOpacity>
            </View>

            <View style={{ maxHeight: 250 }}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }} onPress={() => setSelectedCategories(prev => prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id])}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ color: theme.text, fontSize: fs(14), fontWeight: cat.isSystem ? '700' : '400' }}>{cat.name}</Text>
                    {cat.isSystem === 1 && (
                      <View style={{ backgroundColor: theme.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: theme.primary, fontSize: fs(8), fontWeight: 'bold' }}>SYSTEM</Text>
                      </View>
                    )}
                  </View>
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

      {/* ADD CATEGORY MODAL */}
      <Modal visible={showAddCategoryModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={[{ width: '100%', borderRadius: 16, padding: 20, maxWidth: 350, backgroundColor: theme.surface }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: fs(18) }}>Create New Category</Text>
              <TouchableOpacity onPress={() => setShowAddCategoryModal(false)}><X color={theme.text} size={24} /></TouchableOpacity>
            </View>
            <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.textMuted, marginBottom: 8 }}>Category Name</Text>
            <View style={{ marginBottom: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, borderColor: theme.border, backgroundColor: theme.background }}>
                <TextInput 
                  style={{ flex: 1, color: theme.text, height: 50 }} 
                  placeholder="e.g. Subscriptions" 
                  placeholderTextColor={theme.textMuted} 
                  autoFocus
                  value={newCatName} 
                  onChangeText={setNewCatName} 
                />
              </View>
            </View>
            <TouchableOpacity 
              style={[styles.closeBtn, { backgroundColor: theme.primary }]} 
              onPress={handleAddCategory}
            >
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: fs(16) }}>Create Category</Text>
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

      <DatabaseInspector 
        visible={showDatabaseInspector} 
        onClose={() => setShowDatabaseInspector(false)}
        theme={theme}
        fs={fs}
      />

      <DeveloperTools
        visible={showDeveloperTools}
        onClose={() => setShowDeveloperTools(false)}
        theme={theme}
        fs={fs}
      />

    </Modal>
  );
}

const styles = StyleSheet.create({
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
