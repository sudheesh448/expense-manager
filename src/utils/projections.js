import { addMonths, setDate, isAfter, isBefore, startOfMonth, format, isValid } from 'date-fns';

export const generateProjections = (accounts, transactions, expectedExpenses = [], emis = [], monthsForward = 6, monthsBefore = 0) => {
  const today = new Date();
  const timeline = [];
  const totalMonths = monthsBefore + monthsForward;

  // Initialize timeline array
  for (let i = 0; i < totalMonths; i++) {
    const targetMonth = addMonths(startOfMonth(today), i - monthsBefore);
    timeline.push({
      date: targetMonth,
      label: format(targetMonth, 'MMM yyyy'),
      monthKey: format(targetMonth, 'yyyy-MM'),
      creditCardDue: 0,
      emiDue: 0,
      expectedDue: 0,
      expectedIncome: 0,
      totalOutputs: 0,
      totalInputs: 0,
      ccDetails: [],
      loanDetails: [],
      expectedDetails: [],
    });
  }

  // 1. Process EMIs
  emis.forEach(emi => {
    const remainingTenure = emi.tenure - emi.paidMonths;
    if (remainingTenure <= 0) return;
    
    let appliedCount = 0;
    for (let i = 0; i < timeline.length; i++) {
        if (appliedCount >= remainingTenure) break;
        
        timeline[i].emiDue += emi.amount;
        timeline[i].loanDetails.push({ 
             name: emi.note || 'EMI', 
             amount: emi.amount 
        });
        appliedCount++;
    }
  });

  // 2. Process Credit Cards
  const creditCards = accounts.filter(a => a.type === 'CREDIT_CARD' && a.billingDay && a.dueDay);
  
  creditCards.forEach(card => {
    const cardTxs = transactions.filter(t => t.accountId === card.id || t.toAccountId === card.id);
    
    cardTxs.forEach(tx => {
      const txDate = new Date(tx.date);
      if (!isValid(txDate)) return;

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

  // 3. Process Expected Expenses & Incomes
  expectedExpenses.forEach(exp => {
    const slot = timeline.find(s => s.monthKey === exp.monthKey);
    if (slot) {
      slot.expectedDetails.push(exp);
      if (exp.type === 'INCOME') {
        if (exp.isDone === 0) {
          slot.expectedIncome += exp.amount;
        }
      } else {
        if (exp.isDone === 0) {
          slot.expectedDue += exp.amount;
        }
      }
    }
  });

  // Cleanup
  timeline.forEach(slot => {
    slot.creditCardDue = Math.max(0, slot.creditCardDue); 
    slot.totalOutputs = slot.creditCardDue + slot.emiDue + slot.expectedDue;
    slot.totalInputs = slot.expectedIncome;
  });

  return timeline;
};
