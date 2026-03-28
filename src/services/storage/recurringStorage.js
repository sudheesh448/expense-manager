import { generateId, getDb, updateAccountBalanceSQL, ensureCategoryExists } from './utils';
import { stabilizeEmiExpenses } from './emiStorage';
import { syncAllLoanExpectedExpenses } from './loanStorage';
import { stabilizeSIPExpenses } from './sipStorage';

export const getForecastDuration = async (userId) => {
  const database = await getDb();
  const row = await database.getFirstAsync('SELECT forecastMonths FROM users WHERE id = ?', [userId || '']);
  return row?.forecastMonths || 6;
};

export const updateForecastDuration = async (userId, duration) => {
  const database = await getDb();
  await database.runAsync('UPDATE users SET forecastMonths = ? WHERE id = ?', [duration, userId]);
  await regenerateAllProjections(userId);
};
export const regenerateAllProjections = async (userId) => {
  if (!userId) return;

  const database = await getDb();
  
  // Clear future unpaid linked expected expenses to ensure they are regenerated with correct metadata (e.g. categoryId)
  const currentMonthKey = new Date().toISOString().substring(0, 7);
  await database.runAsync(
    'UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND isDone = 0 AND monthKey >= ? AND linkedAccountId IS NOT NULL',
    [userId, currentMonthKey]
  );
  
  // 1. Recurring Payments (Monthly Schedules)
  await generateAllRecurringExpenses(userId);
  
  // 2. EMIs
  await stabilizeEmiExpenses(userId);
  
  // 3. Loans
  await syncAllLoanExpectedExpenses(userId);
  
  // 4. SIPs
  await stabilizeSIPExpenses(database, userId);
};

export const generateRecurringExpenses = async (userId, payment, durationMonths = 6) => {
  const database = await getDb();
  const today = new Date();
  const horizon = new Date(today.getFullYear(), today.getMonth() + durationMonths + 1, 0);

  const existing = await database.getAllAsync(
    `SELECT monthKey FROM expected_expenses WHERE userId = ? AND name = ? AND (isDeleted = 0 OR isDeleted IS NULL)`,
    [userId, payment.name]
  );
  const existingMonths = new Set(existing.map(e => e.monthKey));

  if (payment.scheduleType === 'FIXED') {
    for (let i = 0; i <= durationMonths; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, payment.anchorDay || 1);
      if (d > horizon) break;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!existingMonths.has(monthKey)) {
        await database.runAsync(
          `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId, type, anchorDay) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [generateId(), userId, monthKey, payment.name, payment.amount, payment.categoryId || null, payment.type || 'EXPENSE', payment.anchorDay || 1]
        );
        existingMonths.add(monthKey);
      }
    }
  } else {
    let current = new Date(payment.nextDueDate);
    while (current <= horizon) {
      const monthKey = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      if (!existingMonths.has(monthKey)) {
        await database.runAsync(
          `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId, type, anchorDay) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
          [generateId(), userId, monthKey, payment.name, payment.amount, payment.categoryId || null, payment.type || 'EXPENSE', current.getDate()]
        );
        existingMonths.add(monthKey);
      }
      current = new Date(current.getTime() + (payment.cycleDays || 30) * 24 * 60 * 60 * 1000);
    }
  }
};

export const generateAllRecurringExpenses = async (userId) => {
  const database = await getDb();
  const duration = await getForecastDuration(userId);
  const payments = await database.getAllAsync('SELECT * FROM recurring_payments WHERE userId = ?', [userId]);
  for (const p of payments) {
    await generateRecurringExpenses(userId, p, duration);
  }
};

export const saveRecurringPayment = async (userId, data, currencySymbol = '₹') => {
  if (!userId) throw new Error('Missing user ID');
  const database = await getDb();
  
  const isUpdate = !!data.id;
  const id = data.id || generateId();
  const scheduleType = data.scheduleType || 'DYNAMIC';
  const anchorDay = data.anchorDay || null;
  const categoryId = data.categoryId || null;
  const type = data.type || 'EXPENSE';
  
  let oldName = '';
  if (isUpdate) {
    const old = await database.getFirstAsync('SELECT name FROM recurring_payments WHERE id = ?', [id]);
    oldName = old?.name || '';
  }

  if (isUpdate) {
    await database.runAsync(
      `UPDATE recurring_payments SET 
        name = ?, amount = ?, accountId = ?, cycleDays = ?, nextDueDate = ?, 
        note = ?, scheduleType = ?, anchorDay = ?, categoryId = ?, type = ?, linkedAccountId = ?
       WHERE id = ?`,
      [data.name, Number(data.amount), data.accountId, Number(data.cycleDays) || 0, 
       data.nextDueDate || new Date().toISOString(), data.note || '', scheduleType, 
       anchorDay, categoryId, type, data.linkedAccountId || null, id]
    );
  } else {
    await database.runAsync(
      `INSERT INTO recurring_payments (id, userId, name, amount, accountId, cycleDays, nextDueDate, note, isActive, scheduleType, anchorDay, categoryId, type, linkedAccountId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
      [id, userId, data.name, Number(data.amount), data.accountId,
        Number(data.cycleDays) || 0, data.nextDueDate || new Date().toISOString(),
        data.note || '', scheduleType, anchorDay, categoryId, type, data.linkedAccountId || null]
    );
  }
  
  const saved = { id, userId, ...data, isActive: 1, scheduleType, anchorDay, categoryId, type, linkedAccountId: data.linkedAccountId || null };

  // Logging
  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, userId, id, isUpdate ? 'UPDATED' : 'CREATED', 
     `Recurring item "${data.name}" (${currencySymbol}${data.amount}) ${isUpdate ? 'updated' : 'created'}.`, 
     new Date().toISOString()]
  );

  // Cascading update to expected_expenses (future items)
  if (isUpdate && oldName) {
    await database.runAsync(
      `UPDATE expected_expenses SET 
        name = ?, amount = ?, categoryId = ?, type = ?, anchorDay = ?
       WHERE userId = ? AND name = ? AND isDone = 0`,
      [data.name, Number(data.amount), categoryId, type, anchorDay || (new Date(data.nextDueDate).getDate()),
       userId, oldName]
    );
  } else if (!isUpdate) {
    await generateRecurringExpenses(userId, saved);
  }
  
  return saved;
};

export const getRecurringPayments = async (userId) => {
  if (!userId) return [];
  const database = await getDb();
  return await database.getAllAsync(
    `SELECT * FROM recurring_payments WHERE userId = ? AND isActive = 1 AND (isDeleted = 0 OR isDeleted IS NULL) ORDER BY nextDueDate ASC`,
    [userId]
  );
};

export const deleteRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (r) {
    const logId = generateId();
    await database.runAsync(
      'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [logId, r.userId, recurringId, 'DELETED', `Recurring item "${r.name}" deleted.`, new Date().toISOString()]
    );
    await database.runAsync(
      `UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND name = ? AND isDone = 0`,
      [r.userId, r.name]
    );
  }
  await database.runAsync('UPDATE recurring_payments SET isActive = 0 WHERE id = ?', [recurringId]);
};

export const deleteRecurringByAccountId = async (accountId) => {
  if (!accountId) return;
  const database = await getDb();
  const recs = await database.getAllAsync(
    'SELECT id FROM recurring_payments WHERE accountId = ? OR linkedAccountId = ?',
    [accountId, accountId]
  );
  for (const r of recs) {
    await deleteRecurringPayment(r.id);
  }
};

export const stopRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" marks as STOPPED.`, new Date().toISOString()]
  );
  await database.runAsync(
    `UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND name = ? AND isDone = 0`,
    [r.userId, r.name]
  );
  await database.runAsync(
    `UPDATE recurring_payments SET status = 'STOPPED', pausedMonths = '[]' WHERE id = ?`,
    [recurringId]
  );
};

export const restartRecurringPayment = async (recurringId) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" marks as RESTARTED.`, new Date().toISOString()]
  );

  await database.runAsync(
    `UPDATE recurring_payments SET status = 'ACTIVE', pausedMonths = '[]' WHERE id = ?`,
    [recurringId]
  );
  await generateRecurringExpenses(r.userId, { ...r, status: 'ACTIVE', pausedMonths: '[]' });
};

export const pauseRecurringMonths = async (recurringId, monthKeys) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId]);
  if (!r) return;

  const logId = generateId();
  await database.runAsync(
    'INSERT INTO account_logs (id, userId, accountId, action, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
    [logId, r.userId, recurringId, 'UPDATED', `Recurring item "${r.name}" paused for months: ${monthKeys.join(', ')}.`, new Date().toISOString()]
  );

  const existing = JSON.parse(r.pausedMonths || '[]');
  const allPaused = [...new Set([...existing, ...monthKeys])];
  for (const mk of monthKeys) {
    await database.runAsync(
      `UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND name = ? AND monthKey = ? AND isDone = 0`,
      [r.userId, r.name, mk]
    );
  }
  const newStatus = allPaused.length > 0 ? 'PAUSED' : 'ACTIVE';
  await database.runAsync(
    `UPDATE recurring_payments SET status = ?, pausedMonths = ? WHERE id = ?`,
    [newStatus, JSON.stringify(allPaused), recurringId]
  );
};

export const resumeRecurringMonths = async (recurringId, monthKeysToResume) => {
  const database = await getDb();
  const r = await database.getFirstAsync('SELECT * FROM recurring_payments WHERE id = ?', [recurringId || '']);
  if (!r) return;
  for (const mk of monthKeysToResume) {
    const has = await database.getFirstAsync(
      `SELECT id FROM expected_expenses WHERE userId = ? AND name = ? AND monthKey = ?`,
      [r.userId || '', r.name || '', mk || '']
    );
    if (!has) {
      await database.runAsync(
        `INSERT INTO expected_expenses (id, userId, monthKey, name, amount, isDone, categoryId) VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [generateId(), r.userId || '', mk || '', r.name || '', r.amount || 0, r.categoryId || null]
      );
    }
  }
  const existing = JSON.parse(r.pausedMonths || '[]');
  const remaining = existing.filter(m => !monthKeysToResume.includes(m));
  const newStatus = remaining.length > 0 ? 'PAUSED' : 'ACTIVE';
  await database.runAsync(
    `UPDATE recurring_payments SET status = ?, pausedMonths = ? WHERE id = ?`,
    [newStatus, JSON.stringify(remaining), recurringId]
  );
};

export const completeRecurringPayment = async (userId, payment) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');
    const now = new Date().toISOString();
    const txId = generateId();
    const isTransfer = !!payment.linkedAccountId;
    let finalCategoryId = payment.categoryId || null;
    let type = isTransfer ? 'TRANSFER' : 'EXPENSE';

    if (isTransfer) {
      const isCC = await database.getFirstAsync('SELECT 1 FROM credit_cards WHERE id = ?', [payment.linkedAccountId]);
      if (isCC) {
        type = 'CC_PAY';
        if (!finalCategoryId) {
          finalCategoryId = await ensureCategoryExists(userId, 'CC Pay', 'PAYMENT', 1);
        }
      }
    }

    const note = isTransfer ? `EMI Payment: ${payment.name}` : `🔁 ${payment.name}`;

    await database.runAsync(
      `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [txId, userId, type, payment.amount, now, payment.accountId,
        payment.linkedAccountId || null, note, finalCategoryId]
    );

    await updateAccountBalanceSQL(database, payment.accountId, payment.amount, type, false);
    if (payment.linkedAccountId) {
      await updateAccountBalanceSQL(database, payment.linkedAccountId, payment.amount, type, true);

      const loan = await database.getFirstAsync('SELECT * FROM accounts WHERE id = ?', [payment.linkedAccountId]);
      if (loan && loan.isEmi === 1 && loan.balance > 0) {
        const P = loan.balance;
        const r = (loan.loanInterestRate || 0) / 1200;
        const start = new Date(loan.loanStartDate);
        const nowD = new Date();
        let monthsPassed = (nowD.getFullYear() - start.getFullYear()) * 12 + (nowD.getMonth() - start.getMonth());
        if (monthsPassed < 0) monthsPassed = 0;
        const remainingMonths = Math.max(1, (loan.loanTenure * 12) - monthsPassed);

        let newEmi = P / remainingMonths;
        if (r > 0) {
          newEmi = (P * r * Math.pow(1 + r, remainingMonths)) / (Math.pow(1 + r, remainingMonths) - 1);
        }

        await database.runAsync('UPDATE accounts SET loanStartDate = ? WHERE id = ?', [now, payment.linkedAccountId]);
        await database.runAsync('UPDATE recurring_payments SET amount = ? WHERE id = ?', [newEmi, payment.id]);
        await database.runAsync('UPDATE expected_expenses SET amount = ? WHERE name = ? AND userId = ? AND isDone = 0', [newEmi, payment.name, userId]);
      }
    }

    if (isTransfer) {
      const targetAcc = await database.getFirstAsync('SELECT type FROM accounts WHERE id = ?', [payment.linkedAccountId]);
      if (targetAcc && targetAcc.type === 'EMI') {
        await updateAccountBalanceSQL(database, payment.accountId, payment.amount, 'TRANSFER', false);
      }
    }

    const cycleDays = payment.cycleDays || 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + cycleDays);
    await database.runAsync('UPDATE recurring_payments SET nextDueDate = ? WHERE id = ?', [nextDate.toISOString(), payment.id]);

    await database.execAsync('COMMIT;');
    return { txId, nextDueDate: nextDate.toISOString() };
  } catch (e) {
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

export const getRecurringStats = async (arg1, arg2, arg3) => {
  let database = arg1;
  let userId = arg2;
  let recurringNames = arg3;

  if (typeof arg1 === 'string' || !arg1) {
    userId = arg1;
    recurringNames = arg2;
    database = await getDb();
  }

  if (!userId || !recurringNames || recurringNames.length === 0) return {};
  const currentYear = new Date().getFullYear().toString();
  const map = {};

  for (const name of recurringNames) {
    const namePattern = `%${name}%`;
    const row = await database.getFirstAsync(
      `SELECT
         SUM(amount)  AS totalPaid,
         SUM(CASE WHEN strftime('%Y', date) = ? THEN amount ELSE 0 END) AS yearPaid,
         COUNT(*)     AS timesTotal
       FROM transactions
       WHERE userId = ? AND note LIKE ? AND (isDeleted = 0 OR isDeleted IS NULL)`,
      [currentYear, userId, namePattern]
    );
    map[name] = {
      totalPaid: row?.totalPaid || 0,
      yearPaid: row?.yearPaid || 0,
      timesTotal: row?.timesTotal || 0,
    };
  }
  return map;
};
