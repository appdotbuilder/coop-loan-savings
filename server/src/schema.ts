import { z } from 'zod';

// User roles enum
export const userRoleEnum = z.enum(['member', 'cooperative_management', 'admin']);
export type UserRole = z.infer<typeof userRoleEnum>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: z.string().email(),
  full_name: z.string(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  role: userRoleEnum,
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Account schema for savings
export const accountSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  account_number: z.string(),
  balance: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Account = z.infer<typeof accountSchema>;

// Transaction types enum
export const transactionTypeEnum = z.enum(['deposit', 'withdrawal']);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

// Transaction schema for savings
export const transactionSchema = z.object({
  id: z.number(),
  account_id: z.number(),
  type: transactionTypeEnum,
  amount: z.number().positive(),
  description: z.string().nullable(),
  processed_by: z.number(), // User ID who processed the transaction
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Loan status enum
export const loanStatusEnum = z.enum(['pending', 'approved', 'rejected', 'active', 'completed']);
export type LoanStatus = z.infer<typeof loanStatusEnum>;

// Loan schema
export const loanSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  amount: z.number().positive(),
  interest_rate: z.number().positive(), // Annual interest rate as percentage
  term_months: z.number().int().positive(),
  monthly_payment: z.number().positive(),
  total_amount: z.number().positive(), // Principal + interest
  remaining_balance: z.number(),
  status: loanStatusEnum,
  purpose: z.string().nullable(),
  approved_by: z.number().nullable(), // User ID who approved
  approved_at: z.coerce.date().nullable(),
  disbursed_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Loan = z.infer<typeof loanSchema>;

// Loan installment schema
export const loanInstallmentSchema = z.object({
  id: z.number(),
  loan_id: z.number(),
  installment_number: z.number().int().positive(),
  due_date: z.coerce.date(),
  amount: z.number().positive(),
  principal_amount: z.number().positive(),
  interest_amount: z.number().positive(),
  paid_amount: z.number(),
  paid_at: z.coerce.date().nullable(),
  recorded_by: z.number().nullable(), // User ID who recorded payment
  is_paid: z.boolean(),
  created_at: z.coerce.date()
});

export type LoanInstallment = z.infer<typeof loanInstallmentSchema>;

// Input schemas for user operations
export const createUserInputSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  role: userRoleEnum
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  username: z.string().min(3).optional(),
  email: z.string().email().optional(),
  full_name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  role: userRoleEnum.optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

// Input schemas for transactions
export const createTransactionInputSchema = z.object({
  account_id: z.number(),
  type: transactionTypeEnum,
  amount: z.number().positive(),
  description: z.string().nullable(),
  processed_by: z.number()
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Input schemas for loans
export const createLoanApplicationInputSchema = z.object({
  user_id: z.number(),
  amount: z.number().positive(),
  term_months: z.number().int().positive(),
  purpose: z.string().nullable()
});

export type CreateLoanApplicationInput = z.infer<typeof createLoanApplicationInputSchema>;

export const processLoanApplicationInputSchema = z.object({
  loan_id: z.number(),
  status: z.enum(['approved', 'rejected']),
  approved_by: z.number(),
  interest_rate: z.number().positive().optional() // Required for approval
});

export type ProcessLoanApplicationInput = z.infer<typeof processLoanApplicationInputSchema>;

// Input schema for loan installment payment
export const recordLoanPaymentInputSchema = z.object({
  installment_id: z.number(),
  paid_amount: z.number().positive(),
  recorded_by: z.number()
});

export type RecordLoanPaymentInput = z.infer<typeof recordLoanPaymentInputSchema>;

// Financial report schemas
export const financialReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});

export type FinancialReportInput = z.infer<typeof financialReportInputSchema>;

export const financialReportSchema = z.object({
  period: z.object({
    start_date: z.coerce.date(),
    end_date: z.coerce.date()
  }),
  savings: z.object({
    total_deposits: z.number(),
    total_withdrawals: z.number(),
    net_savings: z.number(),
    total_balance: z.number()
  }),
  loans: z.object({
    total_disbursed: z.number(),
    total_repaid: z.number(),
    outstanding_principal: z.number(),
    interest_earned: z.number(),
    active_loans: z.number(),
    completed_loans: z.number()
  }),
  installments: z.object({
    total_expected: z.number(),
    total_collected: z.number(),
    overdue_amount: z.number(),
    collection_rate: z.number()
  })
});

export type FinancialReport = z.infer<typeof financialReportSchema>;