import { generateId, getDb, updateAccountBalanceSQL } from './utils';
import { ensureCategoryExists, saveExpectedExpense } from './transactionStorage';
import { addMonths, format } from 'date-fns';

/**
 * Save loan-specific details.
 * Handles displacement transaction and expected expense generation.
 */
export const saveLoanInfo = async (database, id, data) => {
  if (!database || !id) return;

  const sql = `INSERT INTO loans (
    id, userId, type, loanType, name, balance, principal, interestRate, tenure, 
    startDate, emiStartDate, emiAmount,
    finePercentage, serviceCharge, processingFee, taxPercentage, loanFinePaid, 
    installmentStatus, isClosed, closureAmount
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  await database.runAsync(sql, [
    id,
    data.userId,
    data.type,
    data.loanType || 'ONE_TIME',
    data.name,
    Number(data.balance || 0),
    Number(data.loanPrincipal || 0),
    Number(data.loanInterestRate || 0),
    Number(data.loanTenure || 0),
    data.loanStartDate || new Date().toISOString(),
    data.emiStartDate || null,
    data.emiAmount || null,
    Number(data.loanFinePercentage || 0),
    Number(data.loanServiceCharge || 0),
    Number(data.loanProcessingFee || 0),
    Number(data.loanTaxPercentage || 0),
    Number(data.loanFinePaid || 0),
    JSON.stringify(data.installmentStatus || {}),
    data.isClosed ? 1 : 0,
    data.loanClosureAmount || null
  ]);

  // Disbursement logic: if targetAccountId is provided, credit the bank
  if (data.targetAccountId) {
    const P = Number(data.loanPrincipal || 0);
    const fee = Number(data.loanProcessingFee || 0);
    const creditedAmount = P - fee;

    if (creditedAmount > 0) {
      const txId = generateId();
      await database.runAsync(
        'INSERT INTO transactions (id, userId, type, amount, date, accountId, note, linkedItemId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, data.userId, 'INCOME', creditedAmount, data.loanStartDate || new Date().toISOString(), data.targetAccountId, `Loan Disbursement: ${data.name} (Less Processing Fee: ${fee})`, id]
      );
      await updateAccountBalanceSQL(database, data.targetAccountId, creditedAmount, 'INCOME', true);
    }
  }

  if (data.loanType === 'EMI' && (data.emiAmount || data.loanEmi)) {
    await generateLoanExpectedExpenses(database, id, data);
  }
};

/**
 * Update loan-specific details.
 */
export const updateLoanInfo = async (database, id, data) => {
  if (!database || !id) return;

  const sql = `UPDATE loans SET 
    name = ?, balance = ?, principal = ?, interestRate = ?, tenure = ?, 
    startDate = ?, emiStartDate = ?, emiAmount = ?, loanType = ?,
    finePercentage = ?, serviceCharge = ?, processingFee = ?, taxPercentage = ?, 
    loanFinePaid = ?, isClosed = ?, closureAmount = ?, installmentStatus = ?
    WHERE id = ?`;
    
  await database.runAsync(sql, [
    data.name,
    Number(data.balance || 0),
    Number(data.loanPrincipal || 0),
    Number(data.loanInterestRate || 0),
    Number(data.loanTenure || 0),
    data.loanStartDate,
    data.emiStartDate || null,
    data.emiAmount || data.loanEmi || null,
    data.loanType || 'ONE_TIME',
    Number(data.loanFinePercentage || 0),
    Number(data.loanServiceCharge || 0),
    Number(data.loanProcessingFee || 0),
    Number(data.loanTaxPercentage || 0),
    Number(data.loanFinePaid || 0),
    data.isClosed ? 1 : 0,
    data.loanClosureAmount || null,
    JSON.stringify(data.installmentStatus || {}),
    id
  ]);

  // Regenerate expected expenses if it's an EMI loan
  if (data.loanType === 'EMI' && (data.emiAmount || data.loanEmi)) {
    await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [id]);
    await generateLoanExpectedExpenses(database, id, data);
  }
};

/**
 * Generate future installments in expected_expenses table.
 */
export const generateLoanExpectedExpenses = async (database, id, data) => {
  const n = parseInt(data.loanTenure || 0, 10);
  if (n <= 0) return;

  const emiAmount = Number(data.emiAmount || data.loanEmi || 0);
  if (emiAmount <= 0) return;

  const start = new Date(data.emiStartDate || data.loanStartDate || new Date().toISOString());
  const category = await ensureCategoryExists(data.userId, 'Loan Payment', 'loan_pay', 1);

  for (let i = 0; i < n; i++) {
    const forecastDate = addMonths(start, i);
    const monthKey = format(forecastDate, 'yyyy-MM');
    
    // Check if it already exists for this months to avoid duplicates (though we deletes unpaid above)
    const exists = await database.getFirstAsync(
      'SELECT id FROM expected_expenses WHERE userId = ? AND linkedAccountId = ? AND monthKey = ? AND isDeleted = 0',
      [data.userId, id, monthKey]
    );

    if (!exists) {
      await saveExpectedExpense(data.userId, {
        monthKey,
        name: `Loan: ${data.name} (${i + 1}/${n})`,
        amount: emiAmount,
        isDone: 0,
        categoryId: category.id,
        type: 'EXPENSE',
        linkedAccountId: id,
        anchorDay: start.getDate()
      });
    }
  }
};
