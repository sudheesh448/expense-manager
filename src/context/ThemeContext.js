import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from './AuthContext';
import { getUserTheme, updateThemePreference, getUserFontScale, updateFontScale, getDashboardGraphs, updateDashboardGraphs, getCustomGraphs, saveCustomGraphs } from '../services/storage';
import { lightTheme, darkTheme } from '../theme/colors';

const ThemeContext = createContext();

const SCALE_FACTORS = { small: 0.85, medium: 1.0, large: 1.15 };

export const ThemeProvider = ({ children }) => {
  const { activeUser } = useAuth();
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(systemScheme || 'light'); 
  const [isThemeResolved, setIsThemeResolved] = useState(false);
  const [fontScale, setFontScale] = useState('medium'); 
  const [dashboardGraphs, setDashboardGraphs] = useState({ 
    monthlyTrends: true, 
    totalSavings: true, 
    totalCcOutstanding: true, 
    nonEmiCcOutstanding: true,
    monthlyExpenseSplit: true,
    totalLiabilities: true 
  });
  const [graphOrder, setGraphOrder] = useState([]);
  const [customGraphs, setCustomGraphs] = useState([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setIsThemeResolved(false);
    if (activeUser) {
      loadPreferences();
    } else {
      setThemeMode(systemScheme || 'light');
      setFontScale('medium');
      setIsThemeResolved(true); // No user, so it's "resolved" to system/light
      setDashboardGraphs({ 
        monthlyTrends: true, 
        totalSavings: true, 
        totalCcOutstanding: true, 
        nonEmiCcOutstanding: true,
        monthlyExpenseSplit: true,
        totalLiabilities: true
      });
      setGraphOrder([]);
      setCustomGraphs([]);
    }
  }, [activeUser, systemScheme]);

  const loadPreferences = async () => {
    try {
      const [savedTheme, savedScale, dashboardPref, savedCustom] = await Promise.all([
        getUserTheme(activeUser.id),
        getUserFontScale(activeUser.id),
        getDashboardGraphs(activeUser.id),
        getCustomGraphs(activeUser.id),
      ]);
      
      if (savedTheme) setThemeMode(savedTheme);
      if (savedScale) setFontScale(savedScale);
      
      if (dashboardPref) {
        setDashboardGraphs(dashboardPref.graphs);
        if (dashboardPref.order) setGraphOrder(dashboardPref.order);
      }
      
      if (savedCustom) setCustomGraphs(savedCustom || []);
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
    if (activeUser) {
      await saveCustomGraphs(activeUser.id, graphs);
    }
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, themeMode, toggleTheme, 
      fontScale, setFontScalePreference,        dashboardGraphs, 
        setDashboardGraphsPreference,
        graphOrder,
        setGraphOrderPreference,
        customGraphs,
        setCustomGraphsPreference,
        isSettingsOpen,
        setIsSettingsOpen,
        isThemeResolved,
      fs 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
