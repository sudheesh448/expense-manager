import { getLoanStats } from './loanUtils';
import { getEmiStats } from './emiUtils';
import { getCreditCardStatus } from './billing';

export { getLoanStats, getEmiStats };

export const calculateCreditCardAlerts = (accounts, transactions) => {
  return accounts
    .filter(a => a.type === 'CREDIT_CARD' && a.billingDay && a.dueDay)
    .map(acc => {
      const status = getCreditCardStatus(acc.billingDay, acc.dueDay);
      const expensesUpToStatement = transactions
        .filter(t => t.accountId === acc.id && (t.type === 'EXPENSE' || t.type === 'TRANSFER') && new Date(t.date) <= status.lastStatementDate)
        .reduce((sum, t) => sum + t.amount, 0);
      const allPayments = transactions
        .filter(t => (t.toAccountId === acc.id && (t.type === 'PAYMENT' || t.type === 'TRANSFER')) ||
                     (t.accountId === acc.id && t.type === 'INCOME'))
        .reduce((sum, t) => sum + t.amount, 0);
      const amountOwed = Math.max(0, expensesUpToStatement - allPayments);
      
      return { ...acc, status, amountOwed };
    })
    .filter(a => a.status && (a.status.isDueSoon || a.status.isOverdue) && a.amountOwed > 0);
};

export const groupSavingsAccounts = (accounts, lendedAccounts, investmentAccounts, sipAccounts) => {
  const groups = [
    { 
      title: 'BANKS', 
      color: '#3b82f6', 
      items: [
        ...accounts.filter(a => a.type === 'BANK').map(a => ({ ...a, currentBalance: a.balance })),
        ...lendedAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal }))
      ].sort((a, b) => b.currentBalance - a.currentBalance) 
    },
    { 
      title: 'INVESTMENTS', 
      color: '#10b981', 
      items: investmentAccounts.map(a => ({ ...a, currentBalance: a.balance })).sort((a, b) => b.currentBalance - a.currentBalance) 
    },
    { 
      title: 'SIPs', 
      color: '#06b6d4', 
      items: sipAccounts.map(a => ({ ...a, currentBalance: a.displayBalance || 0 })).sort((a, b) => b.currentBalance - a.currentBalance) 
    }
  ].filter(g => g.items.length > 0);

  const totalSavings = (accounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + a.balance, 0) + 
                       lendedAccounts.reduce((sum, a) => sum + getLoanStats(a).remainingTotal, 0));
  const totalInvestments = investmentAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalSips = sipAccounts.reduce((sum, a) => sum + (a.displayBalance || 0), 0);
  
  return { groups, totalSavings, totalInvestments, totalSips, overallTotal: totalSavings + totalInvestments + totalSips };
};

export const groupLiabilitiesAccounts = (loanAccounts, borrowedAccounts, creditCardAccounts) => {
  const totalCreditCard = creditCardAccounts.reduce((sum, a) => sum + a.totalOutstanding, 0);
  const totalLoans = loanAccounts.reduce((sum, a) => sum + getLoanStats(a).remainingTotal, 0);
  const totalBorrowed = borrowedAccounts.reduce((sum, a) => sum + getLoanStats(a).remainingTotal, 0);

  const groups = [
    { 
      title: 'LOANS', 
      color: '#ef4444', 
      items: loanAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal })).sort((a, b) => b.currentBalance - a.currentBalance) 
    },
    { 
      title: 'BORROWED', 
      color: '#f97316', 
      items: borrowedAccounts.map(a => ({ ...a, currentBalance: getLoanStats(a).remainingTotal })).sort((a, b) => b.currentBalance - a.currentBalance) 
    },
    { 
      title: 'CREDIT CARDS', 
      color: '#6366f1', 
      items: creditCardAccounts.map(a => ({ ...a, currentBalance: a.totalOutstanding })).sort((a, b) => b.currentBalance - a.currentBalance) 
    }
  ].filter(g => g.items.length > 0);

  const overallTotal = totalLoans + totalBorrowed + totalCreditCard;
  
  return { groups, totalLoans, totalBorrowed, totalCreditCard, overallTotal };
};
