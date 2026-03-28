import { generateId } from './utils';

/**
 * Save SIP account specific details.
 */
export const saveSIPAccount = async (database, id, data) => {
  if (!database || !id) return;

  const sql = `INSERT INTO sip_accounts (
    id, userId, name, amount, sipDate, startDate, categoryId, linkedAccountId, isClosed, status, pausedMonths, balance, currentValue
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await database.runAsync(sql, [
    id,
    data.userId,
    data.name,
    Number(data.amount || data.sipAmount || 0),
    Number(data.billingDay || 1), // Using billingDay as sipDate
    data.startDate || new Date().toISOString(),
    data.categoryId || null,
    data.linkedAccountId || null,
    data.isClosed ? 1 : 0,
    data.status || 'ACTIVE',
    JSON.stringify(data.pausedMonths || []),
    Number(data.balance || 0),
    Number(data.currentValue || 0)
  ]);

  // Generate Expected Expenses for the forecast period
  await stabilizeSIPExpenses(database, data.userId, id);
};

/**
 * Update SIP account specific details.
 */
export const updateSIPAccount = async (database, id, data) => {
  if (!database || !id) return;

  // 1. Get existing record to know userId
  const old = await database.getFirstAsync('SELECT userId FROM sip_accounts WHERE id = ?', [id]);
  if (!old) return;

  const sql = `UPDATE sip_accounts SET 
    name = ?, amount = ?, sipDate = ?, startDate = ?, categoryId = ?, isClosed = ?, status = ?, pausedMonths = ?, balance = ?, currentValue = ?
    WHERE id = ?`;
    
  await database.runAsync(sql, [
    data.name,
    Number(data.amount || data.sipAmount || 0),
    Number(data.billingDay || 1),
    data.startDate || new Date().toISOString(),
    data.categoryId || null,
    data.isClosed ? 1 : 0,
    data.status || 'ACTIVE',
    JSON.stringify(data.pausedMonths || []),
    Number(data.balance || 0),
    Number(data.currentValue || 0),
    id
  ]);

  // 2. Clear future unpaid expected expenses for this SIP
  await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [id]);

  // 3. Regenerate Expected Expenses
  await stabilizeSIPExpenses(database, old.userId, id);
};

/**
 * Ensures that expected_expenses exist for the full forecast horizon for all or a specific SIP.
 */
export const stabilizeSIPExpenses = async (database, userId, specificSipId = null) => {
  if (!database || !userId) return;

  const user = await database.getFirstAsync('SELECT forecastMonths FROM users WHERE id = ?', [userId]);
  const months = user?.forecastMonths || 6;
  
  const today = new Date();
  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const sipQuery = specificSipId 
    ? 'SELECT * FROM sip_accounts WHERE id = ? AND (isDeleted = 0 OR isDeleted IS NULL) AND isClosed = 0'
    : 'SELECT * FROM sip_accounts WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL) AND isClosed = 0';
  const sipParams = specificSipId ? [specificSipId] : [userId];
  
  const sips = await database.getAllAsync(sipQuery, sipParams);

  for (const sip of sips) {
    const sipStart = new Date(sip.startDate || new Date().toISOString());
    const pausedMonthsArr = JSON.parse(sip.pausedMonths || '[]');
    const isStopped = sip.status === 'STOPPED';

    // Start from the later of (Current Month) or (SIP Start Month)
    const horizonStart = sipStart > currentMonthStart ? sipStart : currentMonthStart;
    
    for (let i = 0; i < months; i++) {
      const d = new Date(horizonStart.getFullYear(), horizonStart.getMonth() + i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const isPaused = pausedMonthsArr.includes(monthKey);

      const exists = await database.getFirstAsync(
        'SELECT id FROM expected_expenses WHERE linkedAccountId = ? AND monthKey = ? AND (isDeleted = 0 OR isDeleted IS NULL)',
        [sip.id, monthKey]
      );

      if (isStopped || isPaused) {
        // Remove or mark as deleted if should not exist
        if (exists) {
          await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE id = ?', [exists.id]);
        }
        continue;
      }

      if (!exists) {
        const expId = generateId();
        await database.runAsync(
          'INSERT INTO expected_expenses (id, userId, monthKey, name, amount, categoryId, type, linkedAccountId, anchorDay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [expId, userId, monthKey, `SIP: ${sip.name}`, Number(sip.amount), sip.categoryId || null, 'SIP_PAY', sip.id, Number(sip.sipDate || 1)]
        );
      }
    }
  }
};

/**
 * Pause SIP for specific months
 */
export const pauseSIPMonths = async (database, id, monthKeys) => {
  if (!database || !id || !monthKeys || monthKeys.length === 0) return;
  const sip = await database.getFirstAsync('SELECT userId, pausedMonths FROM sip_accounts WHERE id = ?', [id]);
  if (!sip) return;
  
  const paused = JSON.parse(sip.pausedMonths || '[]');
  monthKeys.forEach(m => { if (!paused.includes(m)) paused.push(m); });
  
  await database.runAsync('UPDATE sip_accounts SET pausedMonths = ? WHERE id = ?', [JSON.stringify(paused), id]);
  await stabilizeSIPExpenses(database, sip.userId, id);
};

/**
 * Resume SIP for specific months
 */
export const resumeSIPMonths = async (database, id, monthKeys) => {
  if (!database || !id || !monthKeys || monthKeys.length === 0) return;
  const sip = await database.getFirstAsync('SELECT userId, pausedMonths FROM sip_accounts WHERE id = ?', [id]);
  if (!sip) return;
  
  let paused = JSON.parse(sip.pausedMonths || '[]');
  paused = paused.filter(m => !monthKeys.includes(m));
  
  await database.runAsync('UPDATE sip_accounts SET pausedMonths = ? WHERE id = ?', [JSON.stringify(paused), id]);
  await stabilizeSIPExpenses(database, sip.userId, id);
};

/**
 * Pause SIP for a single month (Legacy/Shortcut)
 */
export const pauseSIPAccount = async (database, id, monthKey) => {
  return pauseSIPMonths(database, id, [monthKey]);
};

/**
 * Resume SIP for a single month (Legacy/Shortcut)
 */
export const resumeSIPAccount = async (database, id, monthKey) => {
  return resumeSIPMonths(database, id, [monthKey]);
};

/**
 * Updates status and handles forecast cleanup
 */
export const setSIPStatus = async (database, id, status) => {
  if (!database || !id) return;
  const sip = await database.getFirstAsync('SELECT userId FROM sip_accounts WHERE id = ?', [id]);
  if (!sip) return;
  
  await database.runAsync('UPDATE sip_accounts SET status = ? WHERE id = ?', [status, id]);
  await stabilizeSIPExpenses(database, sip.userId, id);
};
