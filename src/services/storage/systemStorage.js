import { getDb } from './utils';
import { initDatabase, resetInitPromise } from './core';
import * as FileSystem from 'expo-file-system/legacy';

export { getForecastDuration, updateForecastDuration } from './recurringStorage';

export const resetDatabase = async () => {
  const database = await getDb();
  
  // Dynamically get all user-defined table names
  const tables = await database.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
  );
  
  // Drop each table
  for (const table of tables) {
    await database.execAsync(`DROP TABLE IF EXISTS ${table.name};`);
  }
  
  resetInitPromise();
  await initDatabase();
};

export const exportData = async (userId) => {
  if (!userId) return null;
  await initDatabase();
  const database = await getDb();
  const tables = [
    'users', 'bank_accounts', 'credit_cards', 'loans', 'borrowed', 'lended', 'investments', 
    'emis', 'sip_accounts', 'transactions', 'expected_expenses', 'categories', 
    'recurring_payments', 'account_logs', 'category_budgets'
  ];
  const backup = { version: 2, timestamp: new Date().toISOString(), userId, data: {} };
  
  try {
    for (const table of tables) {
      const idColumn = table === 'users' ? 'id' : 'userId';
      const rows = await database.getAllAsync(`SELECT * FROM ${table} WHERE ${idColumn} = ?`, [userId || '']);
      backup.data[table] = rows;
    }
    return JSON.stringify(backup, null, 2);
  } catch (error) { throw error; }
};

export const importData = async (userId, jsonString) => {
  if (!userId || !jsonString) return;
  await initDatabase();
  const database = await getDb();
  const backup = JSON.parse(jsonString);
  if (!backup.data) throw new Error('Invalid backup format');
  const restoreUserId = backup.userId;
  if (!restoreUserId) throw new Error('Backup has no userId — cannot restore safely.');
  if (userId !== 'RESTORE' && backup.userId !== userId) throw new Error('This backup belongs to a different user and cannot be restored here.');
  
  try {
    await database.withTransactionAsync(async () => {
      const userScopedTables = [
        'bank_accounts', 'credit_cards', 'loans', 'borrowed', 'lended', 'investments', 'emis',
        'sip_accounts', 'transactions', 'expected_expenses', 'categories', 
        'recurring_payments', 'account_logs', 'category_budgets'
      ];
      for (const table of userScopedTables) await database.runAsync(`DELETE FROM ${table} WHERE userId = ?`, [restoreUserId]);
      await database.runAsync(`DELETE FROM users WHERE id = ?`, [restoreUserId]);
      
      for (const [table, rows] of Object.entries(backup.data)) {
        if (!rows || rows.length === 0) continue;
        const columns = Object.keys(rows[0]);
        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
        for (const row of rows) {
          if (table === 'users') row.biometricsEnabled = 0;
          const values = columns.map(c => row[c] === undefined ? null : row[c]);
          await database.runAsync(sql, values);
        }
      }
    });
  } catch (error) { throw error; }
};

export const getAutoBackupSettings = async (userId) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT autoBackupEnabled, lastBackupTimestamp FROM users WHERE id = ?', [userId || '']);
  return { enabled: row?.autoBackupEnabled === 1, lastTimestamp: row?.lastBackupTimestamp || null };
};

export const updateAutoBackupSettings = async (userId, enabled) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET autoBackupEnabled = ? WHERE id = ?', [enabled ? 1 : 0, userId]);
};

const BACKUP_DIR = `${FileSystem.documentDirectory}backups/`;

export const performAutoBackup = async (userId) => {
  if (!userId) return;
  const settings = await getAutoBackupSettings(userId);
  if (!settings.enabled) return;
  const now = new Date();
  if (settings.lastTimestamp) {
    const last = new Date(settings.lastTimestamp);
    if (now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) return;
  }

  try {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(BACKUP_DIR, { intermediates: true });
    const json = await exportData(userId);
    const fileName = `auto_backup_${now.getTime()}.json`;
    const fileUri = BACKUP_DIR + fileName;
    await FileSystem.writeAsStringAsync(fileUri, json);
    const database = await getDb();
    await database.runAsync('UPDATE users SET lastBackupTimestamp = ? WHERE id = ?', [now.toISOString(), userId]);
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('auto_backup_')).sort((a, b) => parseInt(b.split('_')[2]) - parseInt(a.split('_')[2]));
    if (backupFiles.length > 2) {
      for (let i = 2; i < backupFiles.length; i++) await FileSystem.deleteAsync(BACKUP_DIR + backupFiles[i], { idempotent: true });
    }
  } catch (error) {}
};

export const listSystemBackups = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(BACKUP_DIR);
    if (!dirInfo.exists) return [];
    const files = await FileSystem.readDirectoryAsync(BACKUP_DIR);
    const backupFiles = files.filter(f => f.startsWith('auto_backup_')).sort((a, b) => parseInt(b.split('_')[2]) - parseInt(a.split('_')[2]));
    const results = [];
    for (const f of backupFiles) {
      const fileUri = BACKUP_DIR + f;
      const content = await FileSystem.readAsStringAsync(fileUri);
      const timestamp = parseInt(f.replace('auto_backup_', '').replace('.json', ''), 10);
      results.push({ name: new Date(timestamp).toLocaleString(), uri: fileUri, timestamp, content });
    }
    return results;
  } catch (error) { return []; }
};
