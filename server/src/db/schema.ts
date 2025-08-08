import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['member', 'cooperative_management', 'admin']);
export const transactionTypeEnum = pgEnum('transaction_type', ['deposit', 'withdrawal']);
export const loanStatusEnum = pgEnum('loan_status', ['pending', 'approved', 'rejected', 'active', 'completed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  full_name: text('full_name').notNull(),
  phone: text('phone'), // Nullable by default
  address: text('address'), // Nullable by default
  role: userRoleEnum('role').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Accounts table for savings
export const accountsTable = pgTable('accounts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  account_number: text('account_number').notNull().unique(),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0.00'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Transactions table for savings deposits/withdrawals
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  account_id: integer('account_id').notNull().references(() => accountsTable.id),
  type: transactionTypeEnum('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  description: text('description'), // Nullable by default
  processed_by: integer('processed_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Loans table
export const loansTable = pgTable('loans', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  interest_rate: numeric('interest_rate', { precision: 5, scale: 2 }).notNull(), // Annual rate as percentage
  term_months: integer('term_months').notNull(),
  monthly_payment: numeric('monthly_payment', { precision: 12, scale: 2 }).notNull(),
  total_amount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(), // Principal + interest
  remaining_balance: numeric('remaining_balance', { precision: 12, scale: 2 }).notNull(),
  status: loanStatusEnum('status').notNull().default('pending'),
  purpose: text('purpose'), // Nullable by default
  approved_by: integer('approved_by').references(() => usersTable.id), // Nullable by default
  approved_at: timestamp('approved_at'), // Nullable by default
  disbursed_at: timestamp('disbursed_at'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Loan installments table
export const loanInstallmentsTable = pgTable('loan_installments', {
  id: serial('id').primaryKey(),
  loan_id: integer('loan_id').notNull().references(() => loansTable.id),
  installment_number: integer('installment_number').notNull(),
  due_date: timestamp('due_date').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  principal_amount: numeric('principal_amount', { precision: 12, scale: 2 }).notNull(),
  interest_amount: numeric('interest_amount', { precision: 12, scale: 2 }).notNull(),
  paid_amount: numeric('paid_amount', { precision: 12, scale: 2 }).notNull().default('0.00'),
  paid_at: timestamp('paid_at'), // Nullable by default
  recorded_by: integer('recorded_by').references(() => usersTable.id), // Nullable by default
  is_paid: boolean('is_paid').notNull().default(false),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ one, many }) => ({
  account: one(accountsTable, {
    fields: [usersTable.id],
    references: [accountsTable.user_id]
  }),
  loans: many(loansTable),
  processedTransactions: many(transactionsTable, {
    relationName: 'processedBy'
  }),
  approvedLoans: many(loansTable, {
    relationName: 'approvedBy'
  }),
  recordedPayments: many(loanInstallmentsTable, {
    relationName: 'recordedBy'
  })
}));

export const accountsRelations = relations(accountsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [accountsTable.user_id],
    references: [usersTable.id]
  }),
  transactions: many(transactionsTable)
}));

export const transactionsRelations = relations(transactionsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [transactionsTable.account_id],
    references: [accountsTable.id]
  }),
  processedBy: one(usersTable, {
    fields: [transactionsTable.processed_by],
    references: [usersTable.id],
    relationName: 'processedBy'
  })
}));

export const loansRelations = relations(loansTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [loansTable.user_id],
    references: [usersTable.id]
  }),
  approvedBy: one(usersTable, {
    fields: [loansTable.approved_by],
    references: [usersTable.id],
    relationName: 'approvedBy'
  }),
  installments: many(loanInstallmentsTable)
}));

export const loanInstallmentsRelations = relations(loanInstallmentsTable, ({ one }) => ({
  loan: one(loansTable, {
    fields: [loanInstallmentsTable.loan_id],
    references: [loansTable.id]
  }),
  recordedBy: one(usersTable, {
    fields: [loanInstallmentsTable.recorded_by],
    references: [usersTable.id],
    relationName: 'recordedBy'
  })
}));

// TypeScript types for table schema
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Account = typeof accountsTable.$inferSelect;
export type NewAccount = typeof accountsTable.$inferInsert;
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;
export type Loan = typeof loansTable.$inferSelect;
export type NewLoan = typeof loansTable.$inferInsert;
export type LoanInstallment = typeof loanInstallmentsTable.$inferSelect;
export type NewLoanInstallment = typeof loanInstallmentsTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  accounts: accountsTable,
  transactions: transactionsTable,
  loans: loansTable,
  loanInstallments: loanInstallmentsTable
};