import { getDb } from './core';
import { getTransactionsByMonth } from './transactionStorage';

/**
 * Get all active budgets for a user
 */
export const getBudgets = async (userId) => {
  const db = await getDb();
  const budgets = await db.getAllAsync(
    'SELECT * FROM category_budgets WHERE userId = ? AND isDeleted = 0 ORDER BY createdAt DESC',
    [userId]
  );
  
  // Parse categoryIds from JSON string
  return budgets.map(b => ({
    ...b,
    categoryIds: JSON.parse(b.categoryIds || '[]')
  }));
};

/**
 * Save or update a budget
 */
export const saveBudget = async (userId, budgetData) => {
  const db = await getDb();
  const { id, name, amount, categoryIds } = budgetData;
  const budgetId = id || Date.now().toString();
  const categoriesJson = JSON.stringify(categoryIds || []);

  await db.runAsync(
    `INSERT OR REPLACE INTO category_budgets (id, userId, name, amount, categoryIds, isDeleted) 
     VALUES (?, ?, ?, ?, ?, 0)`,
    [budgetId, userId, name, amount, categoriesJson]
  );

  return { ...budgetData, id: budgetId, categoryIds };
};

/**
 * Soft delete a budget
 */
export const deleteBudget = async (id) => {
  const db = await getDb();
  await db.runAsync(
    'UPDATE category_budgets SET isDeleted = 1 WHERE id = ?',
    [id]
  );
  return true;
};

/**
 * Get budget utilization for a specific month
 */
export const getBudgetUtilization = async (userId, monthKey) => {
  const budgets = await getBudgets(userId);
  const transactions = await getTransactionsByMonth(userId, monthKey);

  return budgets.map(budget => {
    const utilized = transactions
      .filter(t => budget.categoryIds.includes(t.categoryId))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    return {
      ...budget,
      utilized
    };
  });
};
