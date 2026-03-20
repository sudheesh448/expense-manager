import { addMonths, setDate, isAfter, isBefore, addDays, differenceInDays, startOfDay } from 'date-fns';

/**
 * Calculates the current billing cycle and due date based on the account's settings.
 * @param {number} billingDay - The day of the month the statement is generated
 * @param {number} dueDay - The day of the month the bill is due
 */
export const getCreditCardStatus = (billingDay, dueDay) => {
  if (!billingDay || !dueDay) return null;

  const today = startOfDay(new Date());
  
  // Calculate the most recent statement date
  let lastStatementDate = setDate(today, billingDay);
  if (isAfter(lastStatementDate, today)) {
    lastStatementDate = addMonths(lastStatementDate, -1);
  }

  // Calculate the next statement date
  const nextStatementDate = addMonths(lastStatementDate, 1);

  // Calculate the due date based on the LAST statement date. 
  let currentDueDate = setDate(lastStatementDate, dueDay);
  
  // If the due day is numerically smaller than the billing day (e.g. billing on 15th, due on 5th)
  // then the due date for the statement generated on the 15th happens in the NEXT month.
  if (dueDay <= billingDay || isBefore(currentDueDate, lastStatementDate)) {
    currentDueDate = addMonths(currentDueDate, 1);
  }

  const daysUntilDue = differenceInDays(currentDueDate, today);
  const isOverdue = daysUntilDue < 0 && daysUntilDue > -20; // approximate buffer to clear overdue status after a month
  const isDueSoon = daysUntilDue >= 0 && daysUntilDue <= 5;

  return {
    lastStatementDate,
    nextStatementDate,
    currentDueDate,
    daysUntilDue,
    isOverdue,
    isDueSoon
  };
};
