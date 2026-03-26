export const validateTransaction = (type, data) => {
  const { amount, accountId, categoryId, toAccountId, tenure, selectedUpcomingId } = data;

  if (type === 'PAY_UPCOMING') {
    if (!selectedUpcomingId) return 'Please select an item to pay';
    if (!accountId) return 'Please select a payment account';
    return null;
  }

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return 'Please enter a valid amount';
  }
  if (!accountId) {
    return 'Please select an account';
  }

  const needsTargetAccount = [
    'TRANSFER', 'PAYMENT', 'REPAY_LOAN', 'PAY_BORROWED', 'LEND_MONEY', 'COLLECT_REPAYMENT'
  ].includes(type);

  if (needsTargetAccount && !toAccountId) {
    return 'Please select a target account';
  }

  if (type === 'EMI' && !tenure) {
    return 'Please enter the EMI tenure';
  }

  if (type === 'EXPENSE' && !categoryId) {
    return 'Please select a category';
  }

  return null;
};
