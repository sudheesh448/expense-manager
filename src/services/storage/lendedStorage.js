import { format } from 'date-fns';
import { calculateAmortizationSchedule } from '../../utils/loanUtils';
import { saveExpectedExpense } from './transactionStorage';
import { ensureCategoryExists, generateId, getDb, updateAccountBalanceSQL } from './utils';

/**
 * Local helper to calculate EMI amount based on standard formula.
 */
const calculateEmiValue = (principal, annualRate, tenure) => {
  const P = Number(principal || 0);
  const R = Number(annualRate || 0);
  const n = Number(tenure || 0);
  if (P <= 0 || n <= 0) return 0;

  const r = R / 1200;
  if (r > 0) {
    return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  }
  return P / n;
};

export const saveLendedInfo = async (activeUserId, data, currencySymbol) => {
  const database = await getDb();
  const userId = activeUserId;
  const id = generateId();

  // Ensure system category exists (for received payments, it's Income)
  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');

  let finalEmi = Number(data.emiAmount || 0);
  if (finalEmi <= 0 && data.loanType === 'EMI') {
    finalEmi = calculateEmiValue(data.principal, data.loanInterestRate, data.loanTenure);
  }

  const taxRate = Number(data.loanTaxPercentage || 0);
  if (taxRate > 0 && data.loanType === 'EMI') {
    const monthlyInterest = Number(data.principal) * (Number(data.loanInterestRate) / 1200);
    finalEmi += (monthlyInterest * (taxRate / 100));
  }

  const status = {};
  const paidMonthsCount = parseInt(data.paidMonths || 0, 10);
  const startDate = new Date(data.emiStartDate || data.loanStartDate || new Date().toISOString());

  for (let i = 1; i <= paidMonthsCount; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i - 1);
    const key = format(d, 'yyyy-MM');
    status[key] = 'paid';
  }

  const P_original = Number(data.disbursedPrincipal || data.loanPrincipal || data.principal || data.balance || 0);
  const P_current = Number(data.principal || data.balance || P_original || 0);
  const rate = Number(data.loanInterestRate || data.interestRate || 0);
  const tenureValue = Number(data.loanTenure || data.tenure || 0);
  const start = data.loanStartDate || data.startDate || new Date().toISOString();

  await database.runAsync(
    `INSERT INTO lended (
      id, userId, name, type, loanType, disbursedPrincipal, principal, 
      interestRate, tenure, startDate, isClosed, 
      emiAmount, linkedAccountId, categoryId, paidMonths, installmentStatus,
      emiStartDate, taxPercentage, serviceCharge, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, data.name, 'LENDED', data.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start, 0,
      finalEmi, data.bankAccountId, category.id, paidMonthsCount, JSON.stringify(status),
      data.emiStartDate, data.loanTaxPercentage || 0, data.loanServiceCharge || 0, data.note
    ]
  );

  if (data.bankAccountId) {
    const txId = generateId();
    const lendedCategory = await ensureCategoryExists(userId, 'lended', 'lended', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'lended', data.principal, data.loanStartDate, data.bankAccountId, `Lent to ${data.name}${data.note ? ': ' + data.note : ''}`, id, lendedCategory.id]
    );
    await updateAccountBalanceSQL(database, data.bankAccountId, data.principal, 'lended', false);
  }

  // Generate future expected expenses
  await syncLendedExpectedExpenses(userId, id);

  return { ...data, id };
};

export const updateLendedInfo = async (activeUserId, accountId, data) => {
  const database = await getDb();
  const userId = activeUserId;

  // Fetch existing to handle principal delta
  const oldRecord = await database.getFirstAsync('SELECT * FROM lended WHERE id = ?', [accountId]);
  if (!oldRecord) throw new Error('Lended account not found');

  const oldDisbursed = Number(oldRecord.disbursedPrincipal || 0);
  const newDisbursed = Number(data.disbursedPrincipal || 0);
  const diff = newDisbursed - oldDisbursed;

  // Adjust current principal by the same delta
  const P_current = Number(oldRecord.principal || 0) + diff;
  const P_original = newDisbursed;

  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');

  let finalEmi = Number(data.emiAmount || 0);
  if (finalEmi <= 0 && data.loanType === 'EMI') {
    finalEmi = calculateEmiValue(P_original, data.loanInterestRate, data.loanTenure);
  }

  const taxRate = Number(data.loanTaxPercentage || 0);
  if (taxRate > 0 && data.loanType === 'EMI') {
    const monthlyInterest = Number(P_original) * (Number(data.loanInterestRate) / 1200);
    finalEmi += (monthlyInterest * (taxRate / 100));
  }

  const rate = Number(data.loanInterestRate || data.interestRate || 0);
  const tenureValue = Number(data.loanTenure || data.tenure || 0);
  const start = data.loanStartDate || data.startDate || new Date().toISOString();

  const months = Math.round(tenureValue);
  const paidMonthsCount = parseInt(data.paidMonths || 0, 10);
  const statusObj = {};
  const forecastStart = new Date(data.emiStartDate || data.loanStartDate || new Date().toISOString());

  for (let i = 1; i <= months; i++) {
    const d = new Date(forecastStart);
    d.setMonth(d.getMonth() + i - 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    statusObj[monthKey] = i <= paidMonthsCount ? 'paid' : 'unpaid';
  }

  await database.runAsync(
    `UPDATE lended SET 
      name = ?, type = ?, loanType = ?, disbursedPrincipal = ?, principal = ?, 
      interestRate = ?, tenure = ?, startDate = ?,
      emiAmount = ?, linkedAccountId = ?, paidMonths = ?,
      emiStartDate = ?, installmentStatus = ?, taxPercentage = ?, serviceCharge = ?, note = ?
    WHERE id = ?`,
    [
      data.name, 'LENDED', data.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start,
      finalEmi, data.bankAccountId, data.paidMonths,
      data.emiStartDate, JSON.stringify(statusObj), data.loanTaxPercentage || 0, data.loanServiceCharge || 0, data.note,
      accountId
    ]
  );

  // If there's a delta and a bank is selected, record adjustment transaction
  if (diff !== 0 && data.bankAccountId) {
    const txId = generateId();
    const lendedCategory = await ensureCategoryExists(userId, 'lended', 'lended', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'lended', Math.abs(diff), new Date().toISOString(), data.bankAccountId, `Principal Adjustment: ${data.name}`, accountId, lendedCategory.id]
    );
    // If diff > 0, we lent more (Expense flow). If diff < 0, it's a correction (Income flow).
    const txTypeForBalance = diff > 0 ? 'lended' : 'INCOME';
    await updateAccountBalanceSQL(database, data.bankAccountId, Math.abs(diff), txTypeForBalance, false);
  }

  // Regenerate starting from next installment
  await syncLendedExpectedExpenses(userId, accountId);

  return true;
};

export const recordLendedPrepayment = async (userId, accountId, bankAccountId, amount) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM lended WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');

  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');

  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_PRINCIPAL_PAYMENT', amount, new Date().toISOString(), bankAccountId, `Prepayment: ${account.name}`, accountId, category.id]
  );

  const newPrincipal = Math.max(0, account.principal - amount);
  const prepayments = JSON.parse(account.prepayments || '[]');
  prepayments.push({ amount, date: new Date().toISOString() });
  const isClosed = newPrincipal <= 0 ? 1 : 0;

  await database.runAsync(
    'UPDATE lended SET principal = ?, isClosed = ?, prepayments = ? WHERE id = ?',
    [newPrincipal, isClosed, JSON.stringify(prepayments), accountId]
  );

  await updateAccountBalanceSQL(database, bankAccountId, amount, 'INCOME', false);

  // 6. Sync future expected expenses to reflect new schedule/tenure
  await syncLendedExpectedExpenses(userId, accountId);

  return true;
};

export const syncLendedExpectedExpenses = async (userId, accountId) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM lended WHERE id = ?', [accountId]);
  if (!account) return;

  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');
  const schedule = calculateAmortizationSchedule(account);
  const now = new Date();
  const currentMonthKey = format(now, 'yyyy-MM');

  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND monthKey >= ? AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId, currentMonthKey]
  );

  const futureRows = schedule.filter(r => r.monthKey >= currentMonthKey && !r.isCompleted);

  if (account.loanType === 'EMI') {
    for (const row of futureRows) {
      await saveExpectedExpense(database, {
        userId,
        name: `Lended Receipt: ${account.name}`,
        amount: row.totalOutflow,
        type: 'INCOME',
        monthKey: row.monthKey,
        date: row.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category.id
      });
    }
  } else if (account.loanType === 'ONE_TIME') {
    const finalRow = schedule[schedule.length - 1];
    if (finalRow && !finalRow.isCompleted) {
      await saveExpectedExpense(database, {
        userId,
        name: `Lended Settlement: ${account.name}`,
        amount: finalRow.totalOutflow,
        type: 'INCOME',
        monthKey: finalRow.monthKey,
        date: finalRow.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category.id
      });
    }
  }
};

export const forecloseLended = async (userId, accountId, bankAccountId, settlementAmount) => {
  const database = await getDb();
  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');
  const account = await database.getFirstAsync('SELECT * FROM lended WHERE id = ?', [accountId]);

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'LOAN_FORECLOSURE', settlementAmount, new Date().toISOString(), bankAccountId, `Foreclosure: ${account.name}`, accountId, category.id]
  );

  await database.runAsync(
    'UPDATE lended SET principal = 0, isClosed = 1, loanClosureAmount = ? WHERE id = ?',
    [settlementAmount, accountId]
  );

  await updateAccountBalanceSQL(database, bankAccountId, settlementAmount, 'INCOME', false);
  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId]
  );

  return true;
};

export const payLendedInstallment = async (userId, accountId, bankAccountId, amount, monthKey) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM lended WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');

  const category = await ensureCategoryExists(userId, 'lended_receive', 'INCOME');

  const schedule = calculateAmortizationSchedule(account);
  const row = schedule.find(r => r.monthKey === monthKey);

  const principalPortion = row ? row.principal : amount;

  const status = typeof account.installmentStatus === 'string' ? JSON.parse(account.installmentStatus || '{}') : (account.installmentStatus || {});
  status[monthKey] = 'paid';

  const newPaidMonths = Object.keys(status).filter(k => status[k] === 'paid').length;
  let newPrincipal = Math.max(0, account.principal - principalPortion);

  const isFinalMonth = row?.month === account.loanTenure;
  const isClosed = (isFinalMonth || newPrincipal < 1) ? 1 : 0;
  if (isClosed) {
    newPrincipal = 0;
  }

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'INCOME', amount, new Date().toISOString(), bankAccountId, `Lended Receipt: ${account.name} (${monthKey})`, accountId, category.id]
  );

  await database.runAsync(
    'UPDATE lended SET principal = ?, paidMonths = ?, installmentStatus = ?, isClosed = ? WHERE id = ?',
    [newPrincipal, newPaidMonths, JSON.stringify(status), isClosed, accountId]
  );

  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'INCOME', false);
  }

  if (monthKey) {
    await database.runAsync(
      'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND linkedAccountId = ? AND isDone = 0',
      [userId, monthKey, accountId]
    );
  }

  return true;
};
