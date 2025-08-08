import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  updateUserInputSchema,
  createTransactionInputSchema,
  createLoanApplicationInputSchema,
  processLoanApplicationInputSchema,
  recordLoanPaymentInputSchema,
  financialReportInputSchema
} from './schema';

// Import handlers
import { createUser } from './handlers/create_user';
import { updateUser } from './handlers/update_user';
import { deleteUser } from './handlers/delete_user';
import { getUsers } from './handlers/get_users';
import { getUserProfile } from './handlers/get_user_profile';
import { getSavingsBalance } from './handlers/get_savings_balance';
import { createTransaction } from './handlers/create_transaction';
import { getTransactionHistory } from './handlers/get_transaction_history';
import { applyForLoan } from './handlers/apply_for_loan';
import { processLoanApplication } from './handlers/process_loan_application';
import { getLoanApplications } from './handlers/get_loan_applications';
import { getUserLoans } from './handlers/get_user_loans';
import { getLoanInstallments } from './handlers/get_loan_installments';
import { recordLoanPayment } from './handlers/record_loan_payment';
import { getPendingInstallments } from './handlers/get_pending_installments';
import { generateFinancialReport } from './handlers/generate_financial_report';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // User management routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),

  updateUser: publicProcedure
    .input(updateUserInputSchema)
    .mutation(({ input }) => updateUser(input)),

  deleteUser: publicProcedure
    .input(z.object({ userId: z.number() }))
    .mutation(({ input }) => deleteUser(input.userId)),

  getUsers: publicProcedure
    .query(() => getUsers()),

  getUserProfile: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserProfile(input.userId)),

  // Savings account routes
  getSavingsBalance: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getSavingsBalance(input.userId)),

  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  getTransactionHistory: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getTransactionHistory(input.userId)),

  // Loan management routes
  applyForLoan: publicProcedure
    .input(createLoanApplicationInputSchema)
    .mutation(({ input }) => applyForLoan(input)),

  processLoanApplication: publicProcedure
    .input(processLoanApplicationInputSchema)
    .mutation(({ input }) => processLoanApplication(input)),

  getLoanApplications: publicProcedure
    .query(() => getLoanApplications()),

  getUserLoans: publicProcedure
    .input(z.object({ userId: z.number() }))
    .query(({ input }) => getUserLoans(input.userId)),

  getLoanInstallments: publicProcedure
    .input(z.object({ loanId: z.number() }))
    .query(({ input }) => getLoanInstallments(input.loanId)),

  // Loan payment routes
  recordLoanPayment: publicProcedure
    .input(recordLoanPaymentInputSchema)
    .mutation(({ input }) => recordLoanPayment(input)),

  getPendingInstallments: publicProcedure
    .query(() => getPendingInstallments()),

  // Financial reporting routes
  generateFinancialReport: publicProcedure
    .input(financialReportInputSchema)
    .query(({ input }) => generateFinancialReport(input))
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();