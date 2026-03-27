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

export const saveBorrowedInfo = async (activeUserId, data, currencySymbol) => {
  const database = await getDb();
  const userId = activeUserId;
  const id = generateId();

  // Ensure system categories exist
  const repayCategory = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE', 1);
  const receiveCategory = await ensureCategoryExists(userId, 'borrowed', 'INCOME', 1);

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
    `INSERT INTO borrowed (
      id, userId, name, type, loanType, disbursedPrincipal, principal, 
      interestRate, tenure, startDate, isClosed, 
      emiAmount, linkedAccountId, categoryId, paidMonths, installmentStatus,
      emiStartDate, taxPercentage, serviceCharge, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, data.name, 'BORROWED', data.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start, 0,
      finalEmi, data.bankAccountId, repayCategory, paidMonthsCount, JSON.stringify(status),
      data.emiStartDate, data.loanTaxPercentage || 0, data.loanServiceCharge || 0, data.note
    ]
  );

  if (data.bankAccountId) {
    const txId = generateId();
    const incomeCategory = await ensureCategoryExists(userId, 'borrowed', 'BORROWED', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'BORROWED', data.principal, data.loanStartDate, data.bankAccountId, `Principal Receipt: ${data.name}${data.note ? ': ' + data.note : ''}`, id, incomeCategory.id]
    );
    await updateAccountBalanceSQL(database, data.bankAccountId, data.principal, 'BORROWED', false);
  }

  // Generate future expected expenses
  await syncBorrowedExpectedExpenses(userId, id);

  return { ...data, id };
};

export const updateBorrowedInfo = async (activeUserId, accountId, data) => {
  const database = await getDb();
  const userId = activeUserId;

  // Fetch existing to handle principal delta
  const oldRecord = await database.getFirstAsync('SELECT * FROM borrowed WHERE id = ?', [accountId]);
  if (!oldRecord) throw new Error('Borrowed account not found');

  const oldDisbursed = Number(oldRecord.disbursedPrincipal || 0);
  const newDisbursed = Number(data.disbursedPrincipal || 0);
  const diff = newDisbursed - oldDisbursed;

  // Adjust current principal by the same delta
  const P_current = Number(oldRecord.principal || 0) + diff;
  const P_original = newDisbursed;

  const category = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE');

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
    `UPDATE borrowed SET 
      name = ?, type = ?, loanType = ?, disbursedPrincipal = ?, principal = ?, 
      interestRate = ?, tenure = ?, startDate = ?,
      emiAmount = ?, linkedAccountId = ?, paidMonths = ?,
      emiStartDate = ?, installmentStatus = ?, taxPercentage = ?, serviceCharge = ?, note = ?
    WHERE id = ?`,
    [
      data.name, 'BORROWED', data.loanType || 'ONE_TIME',
      P_original, P_current, rate, tenureValue, start,
      finalEmi, data.bankAccountId, data.paidMonths,
      data.emiStartDate, JSON.stringify(statusObj), data.loanTaxPercentage || 0, data.loanServiceCharge || 0, data.note,
      accountId
    ]
  );

  // If there's a delta and a bank is selected, record adjustment transaction
  if (diff !== 0 && data.bankAccountId) {
    const txId = generateId();
    const incomeCategory = await ensureCategoryExists(userId, 'borrowed', 'BORROWED', 1);
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [txId, userId, 'BORROWED', Math.abs(diff), new Date().toISOString(), data.bankAccountId, `Principal Adjustment: ${data.name}`, accountId, incomeCategory.id]
    );
    // If diff > 0, we borrowed more (Income flow). If diff < 0, it's a correction (Expense flow).
    const txTypeForBalance = diff > 0 ? 'BORROWED' : 'EXPENSE';
    await updateAccountBalanceSQL(database, data.bankAccountId, Math.abs(diff), txTypeForBalance, false);
  }

  // Regenerate starting from next installment
  await syncBorrowedExpectedExpenses(userId, accountId);

  return true;
};

export const recordBorrowedPrepayment = async (userId, accountId, bankAccountId, amount) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM borrowed WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');

  const txId = generateId();
  const category = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE');

  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'BORROWED_REPAY', amount, new Date().toISOString(), bankAccountId, `Prepayment: ${account.name}`, accountId, category]
  );

  const newPrincipal = Math.max(0, account.principal - amount);
  const prepayments = JSON.parse(account.prepayments || '[]');
  prepayments.push({ amount, date: new Date().toISOString() });
  const isClosed = newPrincipal <= 0 ? 1 : 0;
  const closedAt = isClosed ? new Date().toISOString() : null;

  await database.runAsync(
    'UPDATE borrowed SET principal = ?, isClosed = ?, prepayments = ?, closedAt = ? WHERE id = ?',
    [newPrincipal, isClosed, JSON.stringify(prepayments), closedAt, accountId]
  );

  await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);

  // 6. Sync future expected expenses to reflect new schedule/tenure
  await syncBorrowedExpectedExpenses(userId, accountId);

  return true;
};

export const syncBorrowedExpectedExpenses = async (userId, accountId) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM borrowed WHERE id = ?', [accountId]);
  if (!account) return;

  const category = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE');
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
        name: `Borrowed Repay: ${account.name}`,
        amount: row.totalOutflow,
        type: 'EXPENSE',
        monthKey: row.monthKey,
        date: row.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category
      });
    }
  } else if (account.loanType === 'ONE_TIME') {
    const finalRow = schedule[schedule.length - 1];
    if (finalRow && !finalRow.isCompleted) {
      await saveExpectedExpense(database, {
        userId,
        name: `Borrowed Settlement: ${account.name}`,
        amount: finalRow.totalOutflow,
        type: 'EXPENSE',
        monthKey: finalRow.monthKey,
        date: finalRow.monthDate.toISOString(),
        linkedAccountId: accountId,
        categoryId: category
      });
    }
  }
};

export const forecloseBorrowed = async (userId, accountId, bankAccountId, settlementAmount) => {
  const database = await getDb();
  const category = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE');
  const account = await database.getFirstAsync('SELECT * FROM borrowed WHERE id = ?', [accountId]);

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'BORROWED_REPAY', settlementAmount, new Date().toISOString(), bankAccountId, `Foreclosure: ${account.name}`, accountId, category]
  );

  await database.runAsync(
    'UPDATE borrowed SET principal = 0, isClosed = 1, loanClosureAmount = ?, closedAt = ? WHERE id = ?',
    [settlementAmount, new Date().toISOString(), accountId]
  );

  await updateAccountBalanceSQL(database, bankAccountId, settlementAmount, 'EXPENSE', false);
  await database.runAsync(
    'DELETE FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND isDone = 0 AND (isDeleted = 0 OR isDeleted IS NULL)',
    [userId, accountId]
  );

  return true;
};

export const payBorrowedInstallment = async (userId, accountId, bankAccountId, amount, monthKey) => {
  const database = await getDb();
  const account = await database.getFirstAsync('SELECT * FROM borrowed WHERE id = ?', [accountId]);
  if (!account) throw new Error('Account not found');

  const category = await ensureCategoryExists(userId, 'borrowed repay', 'EXPENSE');

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
  const closedAt = isClosed ? new Date().toISOString() : null;

  const txId = generateId();
  await database.runAsync(
    'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [txId, userId, 'BORROWED_REPAY', amount, new Date().toISOString(), bankAccountId, `Borrowed Repay: ${account.name} (${monthKey})`, accountId, category]
  );

  await database.runAsync(
    'UPDATE borrowed SET principal = ?, paidMonths = ?, installmentStatus = ?, isClosed = ?, closedAt = ? WHERE id = ?',
    [newPrincipal, newPaidMonths, JSON.stringify(status), isClosed, closedAt, accountId]
  );

  if (bankAccountId) {
    await updateAccountBalanceSQL(database, bankAccountId, amount, 'EXPENSE', false);
  }

  if (monthKey) {
    await database.runAsync(
      'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND linkedAccountId = ? AND isDone = 0',
      [userId, monthKey, accountId]
    );
  }

  return true;
};
