import { ensureCategoryExists, generateId, getDb, updateAccountBalanceSQL } from './utils';

export const getEmis = async (arg1, arg2) => {
  let database = arg1;
  let userId = arg2;
  if (typeof arg1 === 'string' || !arg1) {
    if (arg2 === undefined) {
      userId = arg1;
      database = await getDb();
    }
  }
  if (!userId) return [];
  try {
    return await database.getAllAsync('SELECT * FROM emis WHERE userId = ? AND (isDeleted = 0 OR isDeleted IS NULL)', [userId]);
  } catch (error) {
    console.error('Error fetching EMIs', error);
    return [];
  }
};

export const saveEmi = async (userId, emiData) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    const id = emiData.id || generateId();
    const P = Number(emiData.amount || 0);
    const n = Number(emiData.tenure || 1);
    const annualRate = Number(emiData.interestRate || 0);
    const r = annualRate / 1200;
    const sc = Number(emiData.serviceCharge || 0);
    const taxRate = (Number(emiData.taxPercentage || 0)) / 100;

    let emi = Number(emiData.emiAmount || 0);

    // Fallback only if not provided
    if (emi <= 0) {
      emi = P / n;
      if (r > 0) {
        emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      }
    }

    if (emi <= 0) throw new Error("EMI Amount is required.");

    const serviceChargeTotal = sc * (1 + taxRate);
    const totalInterest = (emi * n) - P;
    const totalLiability = P + totalInterest;

    await database.execAsync('BEGIN TRANSACTION;');

    // Get default categories
    const limitBlockCatId = await ensureCategoryExists(userId, 'CC Limit Blockage', 'EMI Limit Blockage', 1);
    const emiPayCatId = await ensureCategoryExists(userId, 'EMI Payment', 'EMI Payment', 1);

    const emiAccountId = id;
    const ccUsageVal = Number(emiData.ccUsage || P);
    const start = new Date(emiData.emiStartDate || emiData.loanStartDate || new Date().toISOString());
    const emiStartDate = start.toISOString();

    // Initialize installment status dictionary
    const installmentStatusObj = {};
    for (let i = 0; i < n; i++) {
      const forecastDate = new Date(start);
      forecastDate.setMonth(start.getMonth() + i);
      const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
      installmentStatusObj[monthKey] = 'unpaid';
    }
    const installmentStatus = JSON.stringify(installmentStatusObj);

    // 2. Insert into specialized emis table
    const sql = `INSERT INTO emis (id, userId, type, name, balance, amount, emiDate, tenure, paidMonths, note, linkedAccountId, ccUsage, productPrice, processingFee, ccRemaining, emiStartDate, installmentStatus) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sql, [
      emiAccountId, userId, 'EMI', emiData.note || 'Purchase', Number(emiData.ccRemaining || ccUsageVal), emi, emiData.emiDate, n, 0, emiData.note || '', emiData.accountId, ccUsageVal, P, serviceChargeTotal, Number(emiData.ccRemaining || ccUsageVal), emiStartDate, installmentStatus
    ]);

    // 6. Debit usage from Credit Card (Full CC Usage)
    const ccUsageTxId = generateId();
    await database.runAsync(
      'INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, categoryId, linkedItemId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [ccUsageTxId, userId, 'EMI_LIMIT_BLOCK', ccUsageVal, new Date().toISOString(), emiData.accountId, emiAccountId, `EMI Activation (Limit Block): ${emiData.note || 'Purchase'}`, limitBlockCatId, emiAccountId]
    );
    await updateAccountBalanceSQL(database, emiData.accountId, ccUsageVal, 'EXPENSE', false);

    // 7. Processing fee is now merged into the first expected expense instead of a separate transaction
    // (Manual transaction logic removed as requested)

    // 7. Create Expected Expenses for the entire tenure
    // Normalize "now" to the first of the current month for stable comparison
    const now = new Date();
    for (let i = 0; i < n; i++) {
      const forecastDate = new Date(start);
      forecastDate.setMonth(start.getMonth() + i);
      const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;

      // First installment (i=0) includes the processing fee
      let itemAmount = emi;
      let itemName = `EMI: ${emiData.note || 'Purchase'} (${i + 1}/${n})`;

      if (i === 0 && serviceChargeTotal > 0) {
        itemAmount += serviceChargeTotal;
        itemName += ` + Fee`;
      }

      const expectedId = generateId();
      await database.runAsync(
        'INSERT INTO expected_expenses (id, userId, monthKey, name, amount, categoryId, type, linkedAccountId, anchorDay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [expectedId, userId, monthKey, itemName, itemAmount, emiPayCatId, 'EXPENSE', emiAccountId, emiData.emiDate]
      );
    }

    await database.execAsync('COMMIT;');
    return { id, emiAccountId };
  } catch (error) {
    console.error('Error saving EMI', error);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw error;
  }
};

export const updateEmiInfo = async (database, accountId, data) => {
  await database.execAsync('BEGIN TRANSACTION;');
  try {
    // 1. Get existing data to know paid count and userId
    const old = await database.getFirstAsync('SELECT paidMonths, userId, name, installmentStatus FROM emis WHERE id = ?', [accountId]);
    if (!old) throw new Error("EMI account not found for update");

    // Check if any installments are already paid or foreclosed
    const oldStatus = JSON.parse(old.installmentStatus || '{}');
    const hasPaidOrForeclosed = Object.values(oldStatus).some(s => s === 'paid' || s === 'foreclosed');
    if (hasPaidOrForeclosed || (old.paidMonths || 0) > 0) {
      throw new Error("Cannot edit EMI account: Some installments are already paid or foreclosed.");
    }

    const paidMonths = data.paidMonths !== undefined ? Number(data.paidMonths) : Number(old.paidMonths || 0);

    // 2. Clear future expected expenses (those not yet marked as done)
    await database.runAsync('UPDATE expected_expenses SET isDeleted = 1 WHERE linkedAccountId = ? AND isDone = 0', [accountId]);

    // 3. Re-calculate installment status and regenerate expected expenses
    const n = Number(data.tenure || data.loanTenure || 0);
    const start = new Date(data.emiStartDate || data.loanStartDate || new Date().toISOString());
    const statusObj = {};
    const emi = Number(data.emiAmount || data.amount || 0);
    const processingFee = Number(data.processingFee || data.loanServiceCharge || 0);
    const taxRate = (Number(data.taxPercentage || data.loanTaxPercentage || 0)) / 100;
    const serviceChargeTotal = processingFee * (1 + taxRate);

    for (let i = 0; i < n; i++) {
      const d = new Date(start);
      d.setMonth(start.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const isPaid = i < paidMonths;
      statusObj[key] = isPaid ? 'paid' : 'unpaid';

      // Regenerate future (unpaid) expected expenses
      if (!isPaid) {
        let itemAmount = emi;
        let itemName = `EMI: ${data.name || old.name} (${i + 1}/${n})`;

        // Re-add processing fee if this is the very first installment being generated as unpaid
        if (i === 0 && serviceChargeTotal > 0) {
          itemAmount += serviceChargeTotal;
          itemName += ` + Fee`;
        }

        const expectedId = generateId();
        await database.runAsync(
          'INSERT INTO expected_expenses (id, userId, monthKey, name, amount, categoryId, type, linkedAccountId, anchorDay) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [expectedId, old.userId, key, itemName, itemAmount, data.categoryId || null, 'EXPENSE', accountId, data.billingDay]
        );
      }
    }

    // 4. Update the main EMI record
    const sql = `UPDATE emis SET 
      name = ?, balance = ?, amount = ?, emiDate = ?, tenure = ?, paidMonths = ?, 
      note = ?, isClosed = ?, closureAmount = ?, linkedAccountId = ?,
      ccUsage = ?, productPrice = ?, processingFee = ?, ccRemaining = ?,
      emiStartDate = ?, installmentStatus = ?
      WHERE id = ?`;

    await database.runAsync(sql, [
      data.name,
      Number(data.balance || 0),
      emi,
      data.billingDay,
      n,
      paidMonths,
      data.name,
      data.isClosed ? 1 : 0,
      data.closureAmount || null,
      data.linkedAccountId,
      Number(data.ccUsage || 0),
      Number(data.productPrice || 0),
      processingFee,
      Number(data.ccRemaining || 0),
      data.emiStartDate || null,
      JSON.stringify(statusObj),
      accountId
    ]);

    await database.execAsync('COMMIT;');
  } catch (e) {
    console.error('Error in updateEmiInfo:', e);
    await database.execAsync('ROLLBACK;');
    throw e;
  }
};

export const payEmi = async (userId, emiAccountId, fromAccountId, amount, monthKey, expectedExpenseId = null, categoryId = null) => {
  const database = await getDb();
  try {
    await database.execAsync('BEGIN TRANSACTION;');

    // Get EMI Pay category
    const emiPayCatId = await ensureCategoryExists(userId, 'EMI Payment', 'EMI Payment', 1);

    // 1. Get EMI Account details
    const emiAccSql = `
      SELECT * FROM emis WHERE id = ?
    `;
    const emiAcc = await database.getFirstAsync(emiAccSql, [emiAccountId]);
    if (!emiAcc) {
      throw new Error("EMI Account not found");
    }

    // 2. Determine amount to pay
    const payAmount = Number(amount || emiAcc.amount || 0);
    if (payAmount <= 0) {
      throw new Error("Invalid payment amount");
    }

    // 3. Update EMI Record (paidMonths & installmentStatus)
    const status = JSON.parse(emiAcc.installmentStatus || '{}');
    if (monthKey) {
      status[monthKey] = 'paid';
    } else if (expectedExpenseId) {
      const exp = await database.getFirstAsync('SELECT monthKey FROM expected_expenses WHERE id = ?', [expectedExpenseId]);
      if (exp) status[exp.monthKey] = 'paid';
    }
    const totalPaidMonths = (emiAcc.paidMonths || 0) + 1;
    const ccUsage = Number(emiAcc.ccUsage || 0);
    const tenure = Number(emiAcc.tenure || 1);

    // Monthly release amount = ccUsage / tenure
    // Except for the very last month where we release everything that's left
    const releaseAmount = (totalPaidMonths >= tenure)
      ? (emiAcc.ccRemaining || 0)
      : (ccUsage / tenure);

    const newCcRemaining = Math.max(0, (emiAcc.ccRemaining || 0) - releaseAmount);

    console.log(`[EMI Settlement] "${emiAcc.name}" (${totalPaidMonths}/${tenure})`);
    console.log(` - Paid (Bank Outflow): ${payAmount.toFixed(2)}`);
    console.log(` - Original CC Usage (Principal): ${ccUsage.toFixed(2)}`);
    console.log(` - Current Block (Before): ${(emiAcc.ccRemaining || 0).toFixed(2)}`);
    console.log(` - Released Principal (To restore CC Limit): ${releaseAmount.toFixed(2)}`);
    console.log(` - Remaining Block (After): ${newCcRemaining.toFixed(2)}`);

    await database.runAsync(
      'UPDATE emis SET paidMonths = ?, ccRemaining = ?, installmentStatus = ? WHERE id = ?',
      [totalPaidMonths, newCcRemaining, JSON.stringify(status), emiAccountId]
    );

    // 4. Record Transaction (from Bank to EMI Account)
    const txId = generateId();
    const date = new Date().toISOString();
    const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, linkedItemId, categoryId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sqlTx, [
      txId, userId, 'EMI_PAYMENT', payAmount, date,
      fromAccountId, emiAcc.linkedAccountId || emiAccountId, `Paid EMI Installment: ${emiAcc.name}`, emiAccountId, categoryId || emiPayCatId
    ]);

    // 5. Update Bank Balance (Debit)
    await updateAccountBalanceSQL(database, fromAccountId, payAmount, 'TRANSFER', false);

    // 6. Update EMI Account Balance (Principal reduction)
    await updateAccountBalanceSQL(database, emiAccountId, payAmount, 'TRANSFER', true);

    // 7. Update linked account balance (e.g. Credit Card usage reduction)
    if (emiAcc.linkedAccountId) {
      await updateAccountBalanceSQL(database, emiAcc.linkedAccountId, releaseAmount, 'TRANSFER', true);
    }

    // 8. Mark corresponding expected expense as done
    if (expectedExpenseId) {
      await database.runAsync(
        'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE id = ?',
        [expectedExpenseId]
      );
    } else if (monthKey) {
      // Fallback: Mark by monthKey and account ID
      await database.runAsync(
        'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND linkedAccountId = ? AND isDone = 0',
        [userId, monthKey, emiAccountId]
      );
      // Ultra-fallback: Also mark by name pattern if the above didn't catch it
      await database.runAsync(
        'UPDATE expected_expenses SET isDone = 1, isDeleted = 0 WHERE userId = ? AND monthKey = ? AND name LIKE ? AND isDone = 0',
        [userId, monthKey, `EMI: %`]
      );
    }

    // 8. Auto-close if fully settled (balance <= 1 due to rounding)
    const finalEmiAcc = await database.getFirstAsync('SELECT balance FROM emis WHERE id = ?', [emiAccountId]);
    if (finalEmiAcc && finalEmiAcc.balance <= 1) {
      const closeDate = new Date().toISOString();
      // 8. Auto-close if fully settled
      await database.runAsync(
        'UPDATE emis SET balance = 0, isClosed = 1, closureAmount = 0, note = ? WHERE id = ?',
        ['Auto-closed on full settlement', emiAccountId]
      );
      await database.runAsync(
        'UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND linkedAccountId = ? AND isDone = 0',
        [userId, emiAccountId]
      );
    }

    await database.execAsync('COMMIT;');
  } catch (err) {
    console.error('Error paying EMI', err);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw err;
  }
};

export const forecloseEmi = async (userId, emiAccountId, fromAccountId, foreclosureAmount) => {
  if (!userId) throw new Error("Missing Auth User ID");
  try {
    const database = await getDb();
    await database.execAsync('BEGIN TRANSACTION;');

    // 1. Get EMI Account details
    const emiAccSql = `
      SELECT * FROM emis WHERE id = ?
    `;
    const emiAcc = await database.getFirstAsync(emiAccSql, [emiAccountId]);
    if (!emiAcc) {
      await database.execAsync('ROLLBACK;');
      throw new Error("EMI Account not found");
    }

    // 2. Record Transaction (from Bank to Credit Card)
    const txId = generateId();
    const date = new Date().toISOString();
    const sqlTx = `INSERT INTO transactions (id, userId, type, amount, date, accountId, toAccountId, note, linkedItemId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    await database.runAsync(sqlTx, [
      txId, userId, 'EMI_PAYMENT', foreclosureAmount, date,
      fromAccountId, emiAcc.linkedAccountId || emiAccountId, `EMI Foreclosure: ${emiAcc.name}`, emiAccountId
    ]);

    // 3. Update Bank Balance (Debit)
    await updateAccountBalanceSQL(database, fromAccountId, foreclosureAmount, 'TRANSFER', false);

    // 4. Update Credit Card Balance (Credit - Limit Release)
    if (emiAcc.linkedAccountId) {
      await updateAccountBalanceSQL(database, emiAcc.linkedAccountId, emiAcc.ccRemaining || 0, 'TRANSFER', true);
    }

    // 5. Update EMI Record (balance, status, closureAmount, installmentStatus)
    const status = JSON.parse(emiAcc.installmentStatus || '{}');
    Object.keys(status).forEach(key => {
      if (status[key] === 'unpaid') {
        status[key] = 'foreclosed';
      }
    });

    await database.runAsync(
      'UPDATE emis SET balance = 0, ccRemaining = 0, isClosed = 1, closureAmount = ?, note = ?, installmentStatus = ? WHERE id = ?',
      [foreclosureAmount, `Foreclosed on ${date.slice(0, 10)}`, JSON.stringify(status), emiAccountId]
    );

    // 6. Delete all future expected expenses for this EMI to clean up forecast
    await database.runAsync(
      'UPDATE expected_expenses SET isDeleted = 1 WHERE userId = ? AND linkedAccountId = ? AND isDone = 0',
      [userId, emiAccountId]
    );

    await database.execAsync('COMMIT;');
  } catch (err) {
    console.error('Error foreclosing EMI', err);
    const database = await getDb();
    await database.execAsync('ROLLBACK;');
    throw err;
  }
};
