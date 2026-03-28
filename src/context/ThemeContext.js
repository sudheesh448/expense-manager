import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from './AuthContext';
import { getUserTheme, updateThemePreference, getUserFontScale, updateFontScale, getDashboardGraphs, updateDashboardGraphs, getCustomGraphs, saveCustomGraphs, getAccountVisibility, updateAccountVisibility, getBudgetGraphSettings, updateBudgetGraphSettings } from '../services/storage';
import { lightTheme, darkTheme } from '../theme/colors';

const ThemeContext = createContext();

const SCALE_FACTORS = { small: 0.85, medium: 1.0, large: 1.15 };

export const ThemeProvider = ({ children }) => {
  const { activeUser } = useAuth();
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(systemScheme || 'light'); 
  const [isThemeResolved, setIsThemeResolved] = useState(false);
  const [fontScale, setFontScale] = useState('medium'); 
  const [accountVisibility, setAccountVisibility] = useState({
    BANK: true,
    CREDIT_CARD: true,
    INVESTMENT: true,
    SIP: true,
    LOAN: true,
    BORROWED: true,
    LENDED: true,
    EMI: true,
    RECURRING: true
  });
  const [dashboardGraphs, setDashboardGraphs] = useState({ 
    monthlyInsight: true, 
    savingsOverview: true,
    budgetOverview: true,
    accountTypeOverview: true,
    ccDues: true,
    ccTotal: true
  });
  const [graphOrder, setGraphOrder] = useState([]);
  const [customGraphs, setCustomGraphs] = useState([]);
  const [budgetGraphSettings, setBudgetGraphSettings] = useState({ sortOrder: [], defaultItems: 3 });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setIsThemeResolved(false);
    if (activeUser) {
      loadPreferences();
    } else {
      setThemeMode(systemScheme || 'light');
      setFontScale('medium');
      setAccountVisibility({
        BANK: true,
        CREDIT_CARD: true,
        INVESTMENT: true,
        SIP: true,
        LOAN: true,
        BORROWED: true,
        LENDED: true,
        EMI: true,
        RECURRING: true
      });
      setIsThemeResolved(true); // No user, so it's "resolved" to system/light
      setDashboardGraphs({ 
        monthlyInsight: true, 
        savingsOverview: true,
        budgetOverview: true,
        accountTypeOverview: true,
        ccDues: true,
        ccTotal: true
      });
      setGraphOrder([]);
      setCustomGraphs([]);
      setBudgetGraphSettings({ sortOrder: [], defaultItems: 3 });
    }
  }, [activeUser, systemScheme]);

  const loadPreferences = async () => {
    try {
      const [savedTheme, savedScale, dashboardPref, savedCustom, savedVisibility, budgetPrefs] = await Promise.all([
        getUserTheme(activeUser.id),
        getUserFontScale(activeUser.id),
        getDashboardGraphs(activeUser.id),
        getCustomGraphs(activeUser.id),
        getAccountVisibility(activeUser.id),
        getBudgetGraphSettings(activeUser.id)
      ]);
      
      if (savedTheme) setThemeMode(savedTheme);
      if (savedScale) setFontScale(savedScale);
      if (savedVisibility) setAccountVisibility(savedVisibility);
      if (budgetPrefs) setBudgetGraphSettings(budgetPrefs);
      
      const customList = savedCustom || [];
      setCustomGraphs(customList);

      if (dashboardPref) {
        const defaultGraphs = { 
          monthlyInsight: true, 
          savingsOverview: true,
          budgetOverview: true,
          accountTypeOverview: true,
          ccDues: true,
          ccTotal: true
        };
        setDashboardGraphs({ ...defaultGraphs, ...(dashboardPref.graphs || {}) });
        
        const defaultOrder = ['savingsOverview', 'budgetOverview', 'accountTypeOverview', 'monthlyInsight', 'ccDues', 'ccTotal'];
        const savedOrder = dashboardPref.order || [];
        // Add any missing default or custom graphs to the saved order
        const mergedOrder = [...savedOrder];
        [...defaultOrder, ...customList.map(g => g.id)].forEach(id => {
          if (!mergedOrder.includes(id)) mergedOrder.push(id);
        });
        setGraphOrder(mergedOrder);
      }
      setIsThemeResolved(true);
    } catch (e) {
      console.error('Failed to load preferences', e);
      setIsThemeResolved(true);
    }
  };

  const toggleTheme = async (mode) => {
    setThemeMode(mode);
    if (activeUser) {
      await updateThemePreference(activeUser.id, mode);
    }
  };

  const setFontScalePreference = async (scale) => {
    setFontScale(scale);
    if (activeUser) {
      await updateFontScale(activeUser.id, scale);
    }
  };

  const setAccountVisibilityPreference = async (visibility) => {
    setAccountVisibility(visibility);
    if (activeUser) {
      await updateAccountVisibility(activeUser.id, visibility);
    }
  };

  const setDashboardGraphsPreference = async (graphs) => {
    setDashboardGraphs(graphs);
    if (activeUser) {
      await updateDashboardGraphs(activeUser.id, graphs, graphOrder);
    }
  };

  const setGraphOrderPreference = async (order) => {
    setGraphOrder(order);
    if (activeUser) {
      await updateDashboardGraphs(activeUser.id, dashboardGraphs, order);
    }
  };

  // Helper: scale a base font size according to user preference
  const fs = (base) => Math.round(base * SCALE_FACTORS[fontScale]);

  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const setCustomGraphsPreference = async (graphs) => {
    setCustomGraphs(graphs);
    
    // Automatically update graphOrder to include any new custom graphs
    const newOrder = [...graphOrder];
    let changed = false;
    graphs.forEach(g => {
      if (!newOrder.includes(g.id)) {
        newOrder.push(g.id);
        changed = true;
      }
    });

    if (activeUser) {
      await saveCustomGraphs(activeUser.id, graphs);
      if (changed) {
        setGraphOrder(newOrder);
        await updateDashboardGraphs(activeUser.id, dashboardGraphs, newOrder);
      }
    }
  };

  const setBudgetGraphSettingsPreference = async (sortOrder, defaultItems) => {
    setBudgetGraphSettings({ sortOrder, defaultItems });
    if (activeUser) {
      await updateBudgetGraphSettings(activeUser.id, sortOrder, defaultItems);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, themeMode, toggleTheme, 
      fontScale, setFontScalePreference,
      accountVisibility, setAccountVisibilityPreference,
      dashboardGraphs, 
        setDashboardGraphsPreference,
        graphOrder,
        setGraphOrderPreference,
        customGraphs,
        setCustomGraphsPreference,
        isSettingsOpen,
        setIsSettingsOpen,
        isThemeResolved,
        budgetGraphSettings,
        setBudgetGraphSettingsPreference,
      fs 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
