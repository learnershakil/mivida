/**
 * FinanceService
 *
 * Event-based financial transaction management.
 *
 * Key principles:
 * - Balance is NEVER stored - always computed from transaction logs
 * - All transactions emit events for analytics
 * - Supports scheduled future transactions
 *
 * Transaction types:
 * - INCOME (credit/revenue)
 * - EXPENSE (debit/expense)
 * - Scheduled (future transactions)
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import FinanceLog, { TransactionType } from '../database/models/FinanceLog';
import { emitEvent, EventTypes } from './eventLogger';

export interface CreateTransactionParams {
  amount: number;
  type: TransactionType;
  category?: string;
  source?: string;
  destination?: string;
  description?: string;
  transactionDate?: Date;
  isScheduled?: boolean;
  scheduledFor?: Date;
  userId: string;
}

/**
 * Add an income transaction
 */
export async function addIncome(
  params: Omit<CreateTransactionParams, 'type'>
): Promise<FinanceLog> {
  return createTransaction({ ...params, type: 'INCOME' });
}

/**
 * Add an expense transaction
 */
export async function addExpense(
  params: Omit<CreateTransactionParams, 'type'>
): Promise<FinanceLog> {
  return createTransaction({ ...params, type: 'EXPENSE' });
}

/**
 * Create a transaction (internal)
 */
async function createTransaction(params: CreateTransactionParams): Promise<FinanceLog> {
  const {
    amount,
    type,
    category,
    source,
    destination,
    description,
    transactionDate = new Date(),
    isScheduled = false,
    scheduledFor,
    userId,
  } = params;

  const transaction = await database.write(async () => {
    return await database.get<FinanceLog>('finance_logs').create((record) => {
      record.amount = Math.abs(amount); // Always store positive amounts
      record.type = type;
      record.category = category;
      record.source = source;
      record.destination = destination;
      record.description = description;
      record.transactionDate = transactionDate.getTime();
      record.isScheduled = isScheduled;
      record.scheduledFor = scheduledFor?.getTime();
      record.isTriggered = !isScheduled; // Immediate transactions are triggered
      record.isCancelled = false;
      record.userId = userId;
    });
  });

  // Emit appropriate event
  if (isScheduled) {
    await emitEvent({
      eventType: EventTypes.FINANCE_SCHEDULED,
      entityType: 'finance',
      entityId: transaction.id,
      payload: {
        amount,
        type,
        category,
        scheduledFor: scheduledFor?.toISOString(),
        description,
      },
      userId,
    });
  } else {
    const eventType =
      type === 'INCOME' ? EventTypes.FINANCE_CREDIT_ADDED : EventTypes.FINANCE_DEBIT_ADDED;

    await emitEvent({
      eventType,
      entityType: 'finance',
      entityId: transaction.id,
      payload: {
        amount,
        category,
        source,
        destination,
        description,
        transactionDate: transactionDate.toISOString(),
      },
      userId,
    });
  }

  return transaction;
}

/**
 * Schedule a future transaction
 */
export async function scheduleTransaction(
  params: Omit<CreateTransactionParams, 'isScheduled'> & { scheduledFor: Date }
): Promise<FinanceLog> {
  return createTransaction({ ...params, isScheduled: true });
}

/**
 * Trigger a scheduled transaction (when due date arrives)
 */
export async function triggerScheduledTransaction(
  transaction: FinanceLog,
  userId: string
): Promise<void> {
  if (!transaction.isScheduled || transaction.isTriggered || transaction.isCancelled) {
    return;
  }

  await database.write(async () => {
    await transaction.update((record) => {
      record.isTriggered = true;
      record.transactionDate = Date.now();
    });
  });

  await emitEvent({
    eventType: EventTypes.FINANCE_TRIGGERED,
    entityType: 'finance',
    entityId: transaction.id,
    payload: {
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      originalScheduledFor: transaction.scheduledFor,
      triggeredAt: Date.now(),
    },
    userId,
  });
}

/**
 * Cancel a scheduled transaction
 */
export async function cancelScheduledTransaction(
  transaction: FinanceLog,
  userId: string,
  reason?: string
): Promise<void> {
  if (!transaction.isScheduled || transaction.isCancelled) {
    return;
  }

  await database.write(async () => {
    await transaction.update((record) => {
      record.isCancelled = true;
    });
  });

  await emitEvent({
    eventType: EventTypes.FINANCE_CANCELLED,
    entityType: 'finance',
    entityId: transaction.id,
    payload: {
      amount: transaction.amount,
      type: transaction.type,
      reason,
      cancelledAt: Date.now(),
    },
    userId,
  });
}

/**
 * Calculate current balance from all transactions
 * Balance is NEVER stored - always computed
 */
export async function calculateBalance(userId: string): Promise<number> {
  const transactions = await database
    .get<FinanceLog>('finance_logs')
    .query(Q.where('user_id', userId))
    .fetch();

  return transactions.reduce((balance, tx) => {
    // Skip cancelled or non-triggered scheduled transactions
    if (tx.deletedAt || tx.isCancelled) return balance;
    if (tx.isScheduled && !tx.isTriggered) return balance;

    return tx.type === 'INCOME' ? balance + tx.amount : balance - tx.amount;
  }, 0);
}

/**
 * Get daily financial snapshot
 */
export async function getDailySnapshot(
  userId: string,
  date: Date = new Date()
): Promise<{
  totalIncome: number;
  totalExpenses: number;
  netChange: number;
  transactionCount: number;
}> {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const endOfDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  ).getTime();

  const transactions = await database
    .get<FinanceLog>('finance_logs')
    .query(Q.where('user_id', userId))
    .fetch();

  const todayTransactions = transactions.filter((tx) => {
    if (tx.deletedAt || tx.isCancelled) return false;
    if (tx.isScheduled && !tx.isTriggered) return false;
    return tx.transactionDate >= startOfDay && tx.transactionDate <= endOfDay;
  });

  const totalIncome = todayTransactions
    .filter((tx) => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpenses = todayTransactions
    .filter((tx) => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + tx.amount, 0);

  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    transactionCount: todayTransactions.length,
  };
}

/**
 * Get pending scheduled transactions
 */
export async function getPendingScheduled(userId: string): Promise<FinanceLog[]> {
  const transactions = await database
    .get<FinanceLog>('finance_logs')
    .query(
      Q.where('user_id', userId),
      Q.where('is_scheduled', true),
      Q.where('is_triggered', false),
      Q.where('is_cancelled', false)
    )
    .fetch();

  // Filter out deleted and sort by scheduled date
  return transactions
    .filter((tx) => !tx.deletedAt)
    .sort((a, b) => (a.scheduledFor || 0) - (b.scheduledFor || 0));
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(
  userId: string,
  limit: number = 10
): Promise<FinanceLog[]> {
  const transactions = await database
    .get<FinanceLog>('finance_logs')
    .query(Q.where('user_id', userId))
    .fetch();

  return transactions
    .filter((tx) => !tx.deletedAt && !tx.isCancelled)
    .filter((tx) => !tx.isScheduled || tx.isTriggered)
    .sort((a, b) => b.transactionDate - a.transactionDate)
    .slice(0, limit);
}

/**
 * Get transactions by category
 */
export async function getTransactionsByCategory(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Record<string, { income: number; expenses: number }>> {
  const transactions = await database
    .get<FinanceLog>('finance_logs')
    .query(Q.where('user_id', userId))
    .fetch();

  const filtered = transactions.filter((tx) => {
    if (tx.deletedAt || tx.isCancelled) return false;
    if (tx.isScheduled && !tx.isTriggered) return false;
    if (startDate && tx.transactionDate < startDate.getTime()) return false;
    if (endDate && tx.transactionDate > endDate.getTime()) return false;
    return true;
  });

  const categories: Record<string, { income: number; expenses: number }> = {};

  for (const tx of filtered) {
    const category = tx.category || 'Uncategorized';
    if (!categories[category]) {
      categories[category] = { income: 0, expenses: 0 };
    }
    if (tx.type === 'INCOME') {
      categories[category].income += tx.amount;
    } else {
      categories[category].expenses += tx.amount;
    }
  }

  return categories;
}

/**
 * Check and trigger due scheduled transactions
 */
export async function checkScheduledTransactions(userId: string): Promise<void> {
  const pending = await getPendingScheduled(userId);
  const now = Date.now();

  for (const tx of pending) {
    if (tx.scheduledFor && tx.scheduledFor <= now) {
      await triggerScheduledTransaction(tx, userId);
    }
  }
}

export default {
  addIncome,
  addExpense,
  schedule: scheduleTransaction,
  trigger: triggerScheduledTransaction,
  cancel: cancelScheduledTransaction,
  getBalance: calculateBalance,
  getDailySnapshot,
  getPendingScheduled,
  getRecent: getRecentTransactions,
  getByCategory: getTransactionsByCategory,
  checkScheduled: checkScheduledTransactions,
};
