import { addMonths, setDate, isAfter, isBefore, startOfMonth, format, isValid } from 'date-fns';

/**
 * Generates financial projections by integrating accounts, transactions,
 * scheduled items (expectedExpenses), and category-level budgets.
 */
export const generateProjections = (accounts, transactions, expectedExpenses = [], budgets = [], monthsForward = 6, monthsBefore = 0, excludeCategoryIds = []) => {
  const today = new Date();
  const timeline = [];
  const totalMonths = monthsBefore + monthsForward;
  const todayKey = format(today, 'yyyy-MM');

  // Pre-calculate exclusion set for performance
  const excludedIds = new Set(excludeCategoryIds.map(id => String(id)));

  // Pre-calculate budget category set for deduplication
  const budgetCategoryIds = new Set();
  budgets.forEach(b => {
    if (b.categoryIds && Array.isArray(b.categoryIds)) {
      b.categoryIds.forEach(id => budgetCategoryIds.add(String(id)));
    }
  });

  // Initialize timeline array
  for (let i = 0; i < totalMonths; i++) {
    const targetMonth = addMonths(startOfMonth(today), i - monthsBefore);
    const monthKey = format(targetMonth, 'yyyy-MM');
    
    timeline.push({
      date: targetMonth,
      label: format(targetMonth, 'MMM yyyy'),
      monthKey,
      creditCardDue: 0,
      expectedDue: budgets.reduce((sum, b) => sum + (b.amount || 0), 0), // Start with budget caps
      expectedIncome: 0,
      totalOutputs: 0,
      totalInputs: 0,
      totalInvestments: 0,
      actualOutputs: 0,
      actualInputs: 0,
      ccDetails: [],
      expectedDetails: [],
      investmentDetails: [],
      budgetDetails: budgets.map(b => ({ ...b, isBudget: true })),
    });
  }

  // 1. Process Credit Cards
  const creditCards = accounts.filter(a => a.type === 'CREDIT_CARD' && a.billingDay && a.dueDay);
  
  creditCards.forEach(card => {
    const cardTxs = transactions.filter(t => t.accountId === card.id || t.toAccountId === card.id);
    
    cardTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      if (!isValid(txDate)) return;

      // Exclude internal limit adjustments (Blockage/Recovery)
      if (excludedIds.has(String(tx.categoryId))) return;

      let cycleEnd = setDate(txDate, card.billingDay);
      if (isAfter(txDate, cycleEnd)) {
         cycleEnd = addMonths(cycleEnd, 1);
      }
      
      let dueDate = setDate(cycleEnd, card.dueDay);
      if (card.dueDay <= card.billingDay || isBefore(dueDate, cycleEnd)) {
        dueDate = addMonths(dueDate, 1);
      }

      const txMonthStart = startOfMonth(dueDate);
      const slotIndex = timeline.findIndex(slot => slot.date.getTime() === txMonthStart.getTime());
      
      if (slotIndex !== -1) {
        let amount = tx.amount;
        if (tx.type === 'PAYMENT' || tx.type === 'INCOME') amount = -amount;
        if (tx.type === 'TRANSFER') {
            if (tx.accountId === card.id) amount = tx.amount;
            if (tx.toAccountId === card.id) amount = -tx.amount;
        }

        timeline[slotIndex].creditCardDue += amount;
        
        let existingDetail = timeline[slotIndex].ccDetails.find(c => c.name === card.name);
        if (!existingDetail) {
            existingDetail = { name: card.name, amount: 0 };
            timeline[slotIndex].ccDetails.push(existingDetail);
        }
        existingDetail.amount += amount;
      }
    });
  });

  // 2. Process Actual Transaction Totals (Past/Present)
  transactions.forEach(tx => {
    const txDate = new Date(tx.date);
    if (!isValid(txDate)) return;
    const mKey = format(txDate, 'yyyy-MM');
    const slot = timeline.find(s => s.monthKey === mKey);
    
    if (slot) {
      if (tx.type === 'INCOME') {
        slot.actualInputs += tx.amount;
      } else if (tx.type === 'EXPENSE' || tx.type === 'CC_PAY' || tx.type === 'EMI_PAYMENT') {
        slot.actualOutputs += tx.amount;
      }
    }
  });

  // 3. Process Expected Expenses & Incomes with Budget Deduplication
  expectedExpenses.forEach(exp => {
    const slot = timeline.find(s => s.monthKey === exp.monthKey);
    if (slot) {
      if (exp.type === 'INCOME') {
        slot.expectedDetails.push(exp);
        if (exp.isDone === 0) {
          slot.expectedIncome += exp.amount;
        }
      } else {
        // Enforce Deduplication: If category is in budget, it's already counted in expectedDue
        const isBudgeted = exp.categoryId && budgetCategoryIds.has(String(exp.categoryId));
        
        if (exp.type === 'SIP_PAY') {
          if (isBudgeted) {
             slot.expectedDetails.push({ ...exp, isCoveredByBudget: true });
          } else {
             slot.investmentDetails.push(exp);
             if (exp.isDone === 0) {
              slot.totalInvestments += exp.amount;
             }
          }
        } else {
          if (!isBudgeted) {
            slot.expectedDetails.push(exp);
            if (exp.isDone === 0) {
              slot.expectedDue += exp.amount;
            }
          } else {
            // If budgeted, we still show it in details but marked as "COVERED BY BUDGET"
            slot.expectedDetails.push({ ...exp, isCoveredByBudget: true });
          }
        }
      }
    }
  });

  // Cleanup
  timeline.forEach(slot => {
    slot.creditCardDue = Math.max(0, slot.creditCardDue); 
    slot.totalOutputs = slot.creditCardDue + slot.expectedDue;
    slot.totalInputs = slot.expectedIncome;
    
    // For past months, if we have actual data, it might be more relevant for status
    const isPast = isBefore(slot.date, startOfMonth(today));
    if (isPast) {
        slot.status = 'HISTORICAL';
    } else if (slot.monthKey === todayKey) {
        slot.status = 'CURRENT';
    } else {
        slot.status = 'PROJECTION';
    }
  });

  return timeline;
};
