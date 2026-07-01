import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * Transaction type - INCOME adds to balance, EXPENSE subtracts
 */
export type TransactionType = 'INCOME' | 'EXPENSE';

/**
 * FinanceLog - Financial transaction records
 *
 * Balance is NEVER stored - always computed from logs.
 * Supports immediate and scheduled transactions.
 */
export default class FinanceLog extends Model {
  static table = 'finance_logs';

  @field('amount') amount!: number;
  @field('type') type!: TransactionType;
  @field('category') category?: string;
  @field('source') source?: string; // For income
  @field('destination') destination?: string; // For expenses
  @field('description') description?: string;
  @date('transaction_date') transactionDate!: number;

  // Scheduled transaction support
  @field('is_scheduled') isScheduled!: boolean;
  @date('scheduled_for') scheduledFor?: number;
  @field('is_triggered') isTriggered!: boolean;
  @field('is_cancelled') isCancelled!: boolean;

  @field('user_id') userId!: string;

  @readonly @date('created_at') createdAt!: number;
  @date('updated_at') updatedAt!: number;
  @date('deleted_at') deletedAt?: number;

  /**
   * Helper to check if this is an income transaction
   */
  get isIncome(): boolean {
    return this.type === 'INCOME';
  }

  /**
   * Get the signed amount (positive for income, negative for expense)
   */
  get signedAmount(): number {
    return this.type === 'INCOME' ? this.amount : -this.amount;
  }
}
