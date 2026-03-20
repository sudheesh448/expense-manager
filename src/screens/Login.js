import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, ScrollView, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { getUsers, saveUser, importData, listSystemBackups } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { User, Fingerprint, Lock, Upload, Download, PlusCircle, Database, CalendarDays } from 'lucide-react-native';

export default function Login() {
  const { login } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    bg: isDark ? '#111827' : '#f9fafb',
    surface: isDark ? '#1f2937' : 'white',
    text: isDark ? '#f9fafb' : '#1f2937',
    textSubtle: isDark ? '#9ca3af' : '#6b7280',
    border: isDark ? '#374151' : '#d1d5db',
    inputBg: isDark ? '#1f2937' : 'white',
    inputText: isDark ? '#f9fafb' : '#1f2937',
    placeholder: isDark ? '#6b7280' : '#9ca3af',
    numKey: isDark ? '#1f2937' : 'white',
  };

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showRestoreOptions, setShowRestoreOptions] = useState(false);
  const [showSystemBackups, setShowSystemBackups] = useState(false);
  const [systemBackups, setSystemBackups] = useState([]);
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPin, setNewPin] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
    if (data.length > 0) {
      setSelectedUser(data[0]);
    }
  };

  const handleBiometrics = async (user) => {
    if (!user.biometricsEnabled) return;
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;
      
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Login to ${user.username}`,
        fallbackLabel: 'Use PIN',
      });
      
      if (result.success) {
        login(user);
      }
    } catch (e) {
      console.log('Biometric error', e);
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    setPin('');
    setError('');
    handleBiometrics(user);
  };

  const handleNumpad = (num) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        if (newPin === selectedUser.pin) {
          login(selectedUser);
        } else {
          setError('Incorrect PIN');
          setTimeout(() => {
             setPin('');
             setError('');
          }, 1000);
        }
      }
    }
  };

  const handleRegister = async () => {
    if (!newUsername || newPin.length < 4) {
      setError('Please provide a name and a 4-digit PIN');
      return;
    }
    const newUser = await saveUser(newUsername, newPin);
    login(newUser);
  };

  const handleRestoreFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri);
        await importData('RESTORE', fileContent);
        await loadUsers();
        setShowRestoreOptions(false);
      }
    } catch (err) {
      setError('Restore failed: invalid backup file');
    }
  };

  const openSystemBackups = async () => {
    const list = await listSystemBackups();
    if (list.length === 0) {
      setError('No system backups found');
      setShowRestoreOptions(false);
      return;
    }
    setSystemBackups(list);
    setShowRestoreOptions(false);
    setShowSystemBackups(true);
  };

  const handleRestoreFromSystem = async (backup) => {
    try {
      await importData('RESTORE', backup.content);
      await loadUsers();
      setShowSystemBackups(false);
    } catch (err) {
      setError('System restore failed');
    }
  };

  if (users.length === 0 && !isRegistering) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <Lock size={64} color="#3b82f6" style={{ marginBottom: 24 }} />
        <Text style={[styles.title, { color: colors.text }]}>Welcome</Text>
        <Text style={[styles.subtitle, { color: colors.textSubtle }]}>Secure your finances locally on your device.</Text>
        
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setIsRegistering(true)}>
          <PlusCircle color="white" size={20} style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Create New Account</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.primaryBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: '#3b82f6', marginTop: 12 }]} 
          onPress={() => setShowRestoreOptions(true)}
        >
          <Download color="#3b82f6" size={20} style={{ marginRight: 8 }} />
          <Text style={[styles.primaryBtnText, { color: '#3b82f6' }]}>Restore from Backup</Text>
        </TouchableOpacity>
        
        {error ? <Text style={[styles.error, { marginTop: 20 }]}>{error}</Text> : null}

        <RestoreModals 
          showOptions={showRestoreOptions} 
          setShowOptions={setShowRestoreOptions}
          showList={showSystemBackups}
          setShowList={setShowSystemBackups}
          backups={systemBackups}
          onRestoreFile={handleRestoreFromFile}
          onRestoreSystem={openSystemBackups}
          onSelectSystem={handleRestoreFromSystem}
          colors={colors}
        />
        </View>
      </SafeAreaView>
    );
  }

  if (isRegistering) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
        <User size={48} color="#3b82f6" style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.text }]}>Create Account</Text>
        <Text style={[styles.subtitle, { color: colors.textSubtle }]}>Set up your login credentials.</Text>
        
        <TextInput 
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]} 
          placeholder="Your Name" 
          placeholderTextColor={colors.placeholder}
          value={newUsername} 
          onChangeText={setNewUsername} 
        />
        <TextInput 
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]} 
          placeholder="Set 4-Digit PIN" 
          placeholderTextColor={colors.placeholder}
          keyboardType="numeric" 
          maxLength={4} 
          secureTextEntry
          value={newPin} 
          onChangeText={setNewPin} 
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        
        <View style={{ flexDirection: 'row', width: '100%', gap: 12, marginTop: 16 }}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.surface, flex: 1, borderWidth: 1, borderColor: colors.border }]} onPress={() => setIsRegistering(false)}>
            <Text style={[styles.primaryBtnText, { color: colors.textSubtle }]}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryBtn, { flex: 2 }]} onPress={handleRegister}>
            <Text style={styles.primaryBtnText}>Register</Text>
          </TouchableOpacity>
        </View>
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <View style={{ alignItems: 'center', width: '100%' }}>
        <User color={colors.textSubtle} size={64} style={{ marginBottom: 16 }} />
        <Text style={[styles.title, { color: colors.text }]}>Welcome back, {selectedUser?.username}</Text>
        <Text style={[styles.subtitle, { color: colors.textSubtle }]}>Enter your secure 4-digit PIN</Text>

        <View style={styles.pinCirclesRow}>
          {[0, 1, 2, 3].map((_, i) => (
            <View key={i} style={[styles.pinCircle, { borderColor: colors.border }, pin.length > i && styles.pinCircleFilled]} />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.numpad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <TouchableOpacity key={num} style={[styles.numKey, { backgroundColor: colors.numKey }]} onPress={() => handleNumpad(num.toString())}>
              <Text style={[styles.numText, { color: colors.text }]}>{num}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.numKey} /> 
          <TouchableOpacity style={[styles.numKey, { backgroundColor: colors.numKey }]} onPress={() => handleNumpad('0')}>
            <Text style={[styles.numText, { color: colors.text }]}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.numKey, { backgroundColor: colors.numKey, opacity: selectedUser?.biometricsEnabled ? 1 : 0.2 }]} 
            onPress={() => handleBiometrics(selectedUser)}
            disabled={!selectedUser?.biometricsEnabled}
          >
            <Fingerprint color="#3b82f6" size={32} />
          </TouchableOpacity>
        </View>
      </View>

      </View>
      <RestoreModals 
        showOptions={showRestoreOptions} 
        setShowOptions={setShowRestoreOptions}
        showList={showSystemBackups}
        setShowList={setShowSystemBackups}
        backups={systemBackups}
        onRestoreFile={handleRestoreFromFile}
        onRestoreSystem={openSystemBackups}
        onSelectSystem={handleRestoreFromSystem}
        colors={colors}
      />
    </SafeAreaView>
  );
}

function RestoreModals({ 
  showOptions, setShowOptions, 
  showList, setShowList, 
  backups, onRestoreFile, onRestoreSystem, onSelectSystem, colors
}) {
  return (
    <>
      <Modal visible={showOptions} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Restore Data</Text>
            <TouchableOpacity style={[styles.modalOption, { backgroundColor: colors.bg }]} onPress={onRestoreSystem}>
              <Database color="#3b82f6" size={24} />
              <View style={{ marginLeft: 16 }}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Internal Backups</Text>
                <Text style={[styles.optionSub, { color: colors.textSubtle }]}>Look for automated system saves</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalOption, { backgroundColor: colors.bg }]} onPress={onRestoreFile}>
              <Upload color="#10b981" size={24} />
              <View style={{ marginLeft: 16 }}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>Select Backup File</Text>
                <Text style={[styles.optionSub, { color: colors.textSubtle }]}>Pick a .json file from your device</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowOptions(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showList} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select System Backup</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {backups.map((b, idx) => (
                <TouchableOpacity key={idx} style={[styles.backupItem, { borderBottomColor: colors.border }]} onPress={() => onSelectSystem(b)}>
                  <CalendarDays color="#3b82f6" size={20} />
                  <Text style={[styles.backupName, { color: colors.textSubtle }]}>{b.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowList(false)}>
              <Text style={styles.cancelText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 8, textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db', width: '100%', marginBottom: 16, fontSize: 16 },
  error: { color: '#ef4444', fontWeight: 'bold', marginBottom: 16 },
  primaryBtn: { backgroundColor: '#3b82f6', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  userCard: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 12, width: '100%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  username: { fontSize: 18, fontWeight: 'bold', marginLeft: 16, color: '#1f2937' },
  pinCirclesRow: { flexDirection: 'row', justifyContent: 'space-between', width: 160, marginBottom: 40, marginTop: 16 },
  pinCircle: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#d1d5db' },
  pinCircleFilled: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  numpad: { flexDirection: 'row', flexWrap: 'wrap', width: 300, justifyContent: 'center' },
  numKey: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center', margin: 6, backgroundColor: 'white', borderRadius: 40, shadowColor: '#3b82f6', shadowOpacity: 0.05, shadowRadius: 8 },
  numText: { fontSize: 28, fontWeight: 'bold', color: '#1f2937' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 48 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1f2937', marginBottom: 24, textAlign: 'center' },
  modalOption: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#f9fafb', borderRadius: 16, marginBottom: 12 },
  optionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1f2937' },
  optionSub: { fontSize: 12, color: '#6b7280' },
  cancelBtn: { marginTop: 12, padding: 16, alignItems: 'center' },
  cancelText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 },
  backupItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backupName: { marginLeft: 12, fontSize: 16, color: '#4b5563', fontWeight: '500' }
});
