import { db } from '../db';
import { 
  transactionsTable, 
  accountsTable, 
  loansTable, 
  loanInstallmentsTable 
} from '../db/schema';
import { type FinancialReportInput, type FinancialReport } from '../schema';
import { gte, lte, and, eq, sum, count, sql } from 'drizzle-orm';

export async function generateFinancialReport(input: FinancialReportInput): Promise<FinancialReport> {
  try {
    const { start_date, end_date } = input;

    // Calculate savings statistics
    const savingsStats = await calculateSavingsStatistics(start_date, end_date);
    
    // Calculate loan portfolio statistics
    const loanStats = await calculateLoanStatistics(start_date, end_date);
    
    // Calculate installment collection statistics
    const installmentStats = await calculateInstallmentStatistics(start_date, end_date);

    return {
      period: {
        start_date,
        end_date
      },
      savings: savingsStats,
      loans: loanStats,
      installments: installmentStats
    };
  } catch (error) {
    console.error('Financial report generation failed:', error);
    throw error;
  }
}

async function calculateSavingsStatistics(start_date: Date, end_date: Date) {
  // Get deposits and withdrawals within date range
  const transactionStats = await db
    .select({
      type: transactionsTable.type,
      total: sum(transactionsTable.amount)
    })
    .from(transactionsTable)
    .where(and(
      gte(transactionsTable.created_at, start_date),
      lte(transactionsTable.created_at, end_date)
    ))
    .groupBy(transactionsTable.type)
    .execute();

  // Process results
  let total_deposits = 0;
  let total_withdrawals = 0;

  transactionStats.forEach(stat => {
    const amount = parseFloat(stat.total || '0');
    if (stat.type === 'deposit') {
      total_deposits = amount;
    } else if (stat.type === 'withdrawal') {
      total_withdrawals = amount;
    }
  });

  // Calculate current total balance across all accounts
  const balanceResult = await db
    .select({
      total_balance: sum(accountsTable.balance)
    })
    .from(accountsTable)
    .execute();

  const total_balance = parseFloat(balanceResult[0]?.total_balance || '0');
  const net_savings = total_deposits - total_withdrawals;

  return {
    total_deposits,
    total_withdrawals,
    net_savings,
    total_balance
  };
}

async function calculateLoanStatistics(start_date: Date, end_date: Date) {
  // Get loans disbursed within date range
  const disbursedLoansResult = await db
    .select({
      total_disbursed: sum(loansTable.amount),
      count: count(loansTable.id)
    })
    .from(loansTable)
    .where(and(
      eq(loansTable.status, 'active'),
      gte(loansTable.disbursed_at, start_date),
      lte(loansTable.disbursed_at, end_date)
    ))
    .execute();

  const total_disbursed = parseFloat(disbursedLoansResult[0]?.total_disbursed || '0');

  // Get repayments (paid installments) within date range
  const repaymentResult = await db
    .select({
      total_repaid: sum(loanInstallmentsTable.paid_amount)
    })
    .from(loanInstallmentsTable)
    .where(and(
      eq(loanInstallmentsTable.is_paid, true),
      gte(loanInstallmentsTable.paid_at, start_date),
      lte(loanInstallmentsTable.paid_at, end_date)
    ))
    .execute();

  const total_repaid = parseFloat(repaymentResult[0]?.total_repaid || '0');

  // Get current outstanding principal (all active loans)
  const outstandingResult = await db
    .select({
      outstanding_principal: sum(loansTable.remaining_balance)
    })
    .from(loansTable)
    .where(eq(loansTable.status, 'active'))
    .execute();

  const outstanding_principal = parseFloat(outstandingResult[0]?.outstanding_principal || '0');

  // Calculate interest earned from paid installments in date range
  const interestEarnedResult = await db
    .select({
      interest_earned: sum(loanInstallmentsTable.interest_amount)
    })
    .from(loanInstallmentsTable)
    .where(and(
      eq(loanInstallmentsTable.is_paid, true),
      gte(loanInstallmentsTable.paid_at, start_date),
      lte(loanInstallmentsTable.paid_at, end_date)
    ))
    .execute();

  const interest_earned = parseFloat(interestEarnedResult[0]?.interest_earned || '0');

  // Count active and completed loans
  const loanCounts = await db
    .select({
      status: loansTable.status,
      count: count(loansTable.id)
    })
    .from(loansTable)
    .where(sql`${loansTable.status} IN ('active', 'completed')`)
    .groupBy(loansTable.status)
    .execute();

  let active_loans = 0;
  let completed_loans = 0;

  loanCounts.forEach(stat => {
    if (stat.status === 'active') {
      active_loans = stat.count;
    } else if (stat.status === 'completed') {
      completed_loans = stat.count;
    }
  });

  return {
    total_disbursed,
    total_repaid,
    outstanding_principal,
    interest_earned,
    active_loans,
    completed_loans
  };
}

async function calculateInstallmentStatistics(start_date: Date, end_date: Date) {
  // Get installments due within date range
  const expectedResult = await db
    .select({
      total_expected: sum(loanInstallmentsTable.amount),
      count: count(loanInstallmentsTable.id)
    })
    .from(loanInstallmentsTable)
    .where(and(
      gte(loanInstallmentsTable.due_date, start_date),
      lte(loanInstallmentsTable.due_date, end_date)
    ))
    .execute();

  const total_expected = parseFloat(expectedResult[0]?.total_expected || '0');

  // Get installments collected within date range (including partial payments)
  const collectedResult = await db
    .select({
      total_collected: sum(loanInstallmentsTable.paid_amount)
    })
    .from(loanInstallmentsTable)
    .where(and(
      sql`${loanInstallmentsTable.paid_amount} > 0`,
      gte(loanInstallmentsTable.paid_at, start_date),
      lte(loanInstallmentsTable.paid_at, end_date)
    ))
    .execute();

  const total_collected = parseFloat(collectedResult[0]?.total_collected || '0');

  // Get overdue installments (due before end_date but not paid)
  const overdueResult = await db
    .select({
      overdue_amount: sum(sql`${loanInstallmentsTable.amount} - ${loanInstallmentsTable.paid_amount}`)
    })
    .from(loanInstallmentsTable)
    .where(and(
      eq(loanInstallmentsTable.is_paid, false),
      lte(loanInstallmentsTable.due_date, end_date)
    ))
    .execute();

  const overdue_amount = parseFloat(overdueResult[0]?.overdue_amount || '0');

  // Calculate collection rate
  const collection_rate = total_expected > 0 ? (total_collected / total_expected) * 100 : 0;

  return {
    total_expected,
    total_collected,
    overdue_amount,
    collection_rate: Math.round(collection_rate * 100) / 100 // Round to 2 decimal places
  };
}