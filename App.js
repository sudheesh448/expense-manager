import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, CreditCard, CalendarDays, Settings as SettingsIcon, AlertTriangle, CalendarClock, List, User, Plus } from 'lucide-react-native';

import Dashboard from './src/screens/Dashboard';
import Accounts from './src/screens/Accounts';
import AddTransaction from './src/screens/AddTransaction';
import TransactionsList from './src/screens/TransactionsList';
import Projections from './src/screens/Projections';
import UpcomingPayments from './src/screens/UpcomingPayments';
import SettingsScreen from './src/screens/Settings';
import Login from './src/screens/Login';
import AccountDetail from './src/screens/AccountDetail';
import EmiDetails from './src/screens/EmiDetails';
import LoanDetails from './src/screens/LoanDetails';
import { initDatabase, generateAllRecurringExpenses, performAutoBackup } from './src/services/storage';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { setupGlobalErrorHandler } from './src/utils/errorHandler';
import FloatingDbInspectorButton from './src/components/FloatingDbInspectorButton';

// Install global error handler as early as possible
setupGlobalErrorHandler();

import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AccountsStack = createNativeStackNavigator();

function AccountsNavigator() {
  const { theme } = useTheme();
  return (
    <AccountsStack.Navigator screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: theme.background },
      animation: 'none',
      detachPreviousScreen: false
    }}>
      <AccountsStack.Screen name="AccountsList" component={Accounts} />
      <AccountsStack.Screen name="AccountDetail" component={AccountDetail} />
      <AccountsStack.Screen name="EmiDetails" component={EmiDetails} />
      <AccountsStack.Screen name="LoanDetails" component={LoanDetails} />
    </AccountsStack.Navigator>
  );
}

function MainApp() {
  const { activeUser } = useAuth();
  const { theme } = useTheme();
  const [dbReady, setDbReady] = useState(false);
  const [errorString, setErrorString] = useState(null);

  useEffect(() => {
    initDatabase()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error("Database initialization failed", e);
        setErrorString(e.message || String(e));
      });
  }, []);

  useEffect(() => {
    if (dbReady && activeUser) {
      generateAllRecurringExpenses(activeUser.id).catch(console.error);
      performAutoBackup(activeUser.id).catch(console.error);
    }
  }, [dbReady, activeUser?.id]);

  if (errorString) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fee2e2', padding: 24 }}>
        <AlertTriangle color="#ef4444" size={48} />
        <Text style={{ marginTop: 16, color: '#991b1b', fontWeight: 'bold', fontSize: 18 }}>Database failed to load</Text>
        <Text style={{ marginTop: 8, color: '#7f1d1d', textAlign: 'center' }}>{errorString}</Text>
      </View>
    );
  }

  if (!dbReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f3f4f6' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 16, color: '#4b5563', fontWeight: 'bold' }}>Initializing Secure SQL Database...</Text>
      </View>
    );
  }

  // --- SECURE ROUTING LAYER --- 
  // Blocks the TabNavigator from ever rendering if not authenticated.
  if (!activeUser) {
    return <Login />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <NavigationContainer theme={{
        ...(theme.isDark ? DarkTheme : DefaultTheme),
        dark: theme.isDark,
        colors: {
          ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
          primary: theme.primary,
          background: theme.background,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          notification: theme.primary,
        }
      }}>
        <AppNavigator />
      </NavigationContainer>
      <SettingsScreen />
      {activeUser?.developerMode === 1 && <FloatingDbInspectorButton />}
    </View>
  );
}

function TabNavigator() {
  const { theme } = useTheme();
  
  return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ color, size }) => {
            if (route.name === 'Dashboard') return <Home color={color} size={size} />;
            if (route.name === 'Accounts') return <CreditCard color={color} size={size} />;
            if (route.name === 'Tx') return <List color={color} size={size} />;
            if (route.name === 'Forecast') return <CalendarDays color={color} size={size} />;
            if (route.name === 'Upcoming') return <CalendarClock color={color} size={size} />;
            if (route.name === 'Settings') return <SettingsIcon color={color} size={size} />;
          },
          tabBarActiveTintColor: theme.primary,
          tabBarInactiveTintColor: theme.textSubtle,
          tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
          tabBarStyle: {
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
          headerTintColor: theme.text,
          sceneContainerStyle: { backgroundColor: theme.background },
          tabBarHideOnKeyboard: true,
        })}
      >
        <Tab.Screen name="Dashboard" component={Dashboard}       options={{ tabBarLabel: 'Home', headerTitle: 'Dashboard' }} />
        <Tab.Screen name="Upcoming"  component={UpcomingPayments} options={{ tabBarLabel: 'Month', headerTitle: 'Month Overview' }} />
        <Tab.Screen name="Forecast"  component={Projections}      options={{ tabBarLabel: 'Forecast', headerTitle: 'Forecast' }} />
        <Tab.Screen name="Tx"        component={TransactionsList}  options={{ tabBarLabel: 'Txns' }} />
        <Tab.Screen name="Accounts"  component={AccountsNavigator} options={{ tabBarLabel: 'Accounts', headerShown: false }} />
        <Tab.Screen 
          name="Add" 
          component={AddTransaction} 
          options={{
            headerShown: false,
            tabBarLabel: 'Add',
            tabBarShowLabel: false,
            tabBarButton: (props) => (
              <TouchableOpacity
                {...props}
                style={StyleSheet.flatten([
                  props.style,
                  {
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ])}
              >
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: theme.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  elevation: 5,
                  shadowColor: theme.primary,
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 5,
                  marginBottom: 10,
                }}>
                  <Plus color="#FFF" size={28} strokeWidth={3} />
                </View>
              </TouchableOpacity>
            )
          }} 
        />
      </Tab.Navigator>
  );
}

function AppNavigator() {
  const { theme } = useTheme();
  return (
    <Stack.Navigator screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: theme.background },
      animation: 'none',
      detachPreviousScreen: false
    }}>
      <Stack.Screen name="MainTabs" component={TabNavigator} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemeProvider>
            <MainApp />
          </ThemeProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
