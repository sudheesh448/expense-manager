import { getDb, generateId } from './utils';

export const getUsers = async () => {
  const database = await getDb();
  return await database.getAllAsync('SELECT * FROM users');
};

export const saveUser = async (username, pin) => {
  const database = await getDb();
  const id = generateId();
  const systemTZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const systemCurrency = Intl.NumberFormat?.().resolvedOptions?.().currency || 'INR';
  await database.runAsync('INSERT INTO users (id, username, pin, biometricsEnabled, timezone, currency) VALUES (?, ?, ?, 0, ?, ?)', [id, username, pin, systemTZ, systemCurrency]);
  return { id, username, pin, biometricsEnabled: 0, timezone: systemTZ, currency: systemCurrency };
};

export const updateUserBiometrics = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET biometricsEnabled = ? WHERE id = ?', [enabled ? 1 : 0, userId]);
};

export const updateThemePreference = async (userId, theme) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET themePreference = ? WHERE id = ?', [theme, userId]);
};

export const getUserTheme = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT themePreference FROM users WHERE id = ?', [userId || '']);
  return user ? user.themePreference || 'light' : 'light';
};

export const getUserFontScale = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT fontScale FROM users WHERE id = ?', [userId || '']);
  return user ? user.fontScale || 'medium' : 'medium';
};

export const updateFontScale = async (userId, scale) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET fontScale = ? WHERE id = ?', [scale, userId]);
};

export const getDashboardGraphs = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT dashboardGraphs, graphOrder FROM users WHERE id = ?', [userId || '']);
  const defaultGraphs = { 
    monthlyTrends: true, 
    totalSavings: true, 
    totalCcOutstanding: true, 
    nonEmiCcOutstanding: true,
    monthlyExpenseSplit: true,
    totalLiabilities: true
  };
  
  let graphs = defaultGraphs;
  let order = [];
  
  if (user) {
    if (user.dashboardGraphs) {
      try {
        graphs = { ...defaultGraphs, ...JSON.parse(user.dashboardGraphs) };
      } catch (e) {}
    }
    if (user.graphOrder) {
      try {
        order = JSON.parse(user.graphOrder) || [];
      } catch (e) {}
    }
  }

  return { graphs, order };
};

export const updateDashboardGraphs = async (userId, graphs, order) => {
  const database = await getDb();
  await database.runAsync(
    'UPDATE users SET dashboardGraphs = ?, graphOrder = ? WHERE id = ?', 
    [JSON.stringify(graphs), JSON.stringify(order), userId || '']
  );
};

export const updateDeveloperMode = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET developerMode = ? WHERE id = ?', [enabled ? 1 : 0, userId || '']);
};

export const updateUserTimezone = async (userId, timezone) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET timezone = ? WHERE id = ?', [timezone, userId || '']);
};

export const updateUserCurrency = async (userId, currency) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET currency = ? WHERE id = ?', [currency, userId || '']);
};

export const updateSandboxEnabled = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET sandboxEnabled = ? WHERE id = ?', [enabled ? 1 : 0, userId || '']);
};

export const getAccountVisibility = async (userId) => {
  const database = await getDb();
  const user = await database.getFirstAsync('SELECT accountVisibility FROM users WHERE id = ?', [userId || '']);
  const defaultVisibility = {
    BANK: true,
    CREDIT_CARD: true,
    INVESTMENT: true,
    SIP: true,
    LOAN: true,
    BORROWED: true,
    LENDED: true,
    EMI: true,
    RECURRING: true
  };
  
  if (user && user.accountVisibility) {
    try {
      return { ...defaultVisibility, ...JSON.parse(user.accountVisibility) };
    } catch (e) {}
  }
  return defaultVisibility;
};

export const updateAccountVisibility = async (userId, visibility) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET accountVisibility = ? WHERE id = ?', [JSON.stringify(visibility), userId || '']);
};
