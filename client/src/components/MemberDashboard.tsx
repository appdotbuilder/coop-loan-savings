import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import type { User, Account, Transaction, Loan, CreateLoanApplicationInput } from '../../../server/src/schema';

interface MemberDashboardProps {
  user: User;
}

export function MemberDashboard({ user }: MemberDashboardProps) {
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loan application form state
  const [loanForm, setLoanForm] = useState<CreateLoanApplicationInput>({
    user_id: user.id,
    amount: 0,
    term_months: 12,
    purpose: null
  });
  const [showLoanDialog, setShowLoanDialog] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load savings balance
      const accountData = await trpc.getSavingsBalance.query({ userId: user.id });
      setAccount(accountData);

      // Load transaction history
      const transactionData = await trpc.getTransactionHistory.query({ userId: user.id });
      setTransactions(transactionData);

      // Load user loans
      const loanData = await trpc.getUserLoans.query({ userId: user.id });
      setLoans(loanData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLoanApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      await trpc.applyForLoan.mutate(loanForm);
      setShowLoanDialog(false);
      setLoanForm({
        user_id: user.id,
        amount: 0,
        term_months: 12,
        purpose: null
      });
      await loadData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply for loan');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionColor = (type: string) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600';
  };

  const getTransactionIcon = (type: string) => {
    return type === 'deposit' ? '↗️' : '↙️';
  };

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome back, {user.full_name}! 👋</CardTitle>
          <p className="text-blue-100">Manage your savings and loans with ease</p>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">💰 Savings Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {account ? `$${account.balance.toFixed(2)}` : '$0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Account: {account?.account_number || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🏦 Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loans.filter((loan: Loan) => loan.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Total applications: {loans.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">📊 Total Debt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${loans
                .filter((loan: Loan) => loan.status === 'active')
                .reduce((sum: number, loan: Loan) => sum + loan.remaining_balance, 0)
                .toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding balance
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="loans">My Loans</TabsTrigger>
          <TabsTrigger value="apply">Apply for Loan</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Recent Transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No transactions yet</p>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((transaction: Transaction) => (
                    <div key={transaction.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getTransactionIcon(transaction.type)}</span>
                        <div>
                          <p className="font-medium capitalize">{transaction.type}</p>
                          <p className="text-sm text-gray-500">
                            {transaction.created_at.toLocaleDateString()}
                          </p>
                          {transaction.description && (
                            <p className="text-sm text-gray-600">{transaction.description}</p>
                          )}
                        </div>
                      </div>
                      <span className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Loans Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Active Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {loans.filter((loan: Loan) => loan.status === 'active').length === 0 ? (
                <p className="text-gray-500 text-center py-4">No active loans</p>
              ) : (
                <div className="space-y-3">
                  {loans
                    .filter((loan: Loan) => loan.status === 'active')
                    .map((loan: Loan) => (
                      <div key={loan.id} className="p-4 rounded-lg border">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium">${loan.amount.toFixed(2)} Loan</p>
                            <p className="text-sm text-gray-500">
                              {loan.interest_rate}% APR • {loan.term_months} months
                            </p>
                          </div>
                          <Badge className={getStatusColor(loan.status)}>
                            {loan.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Monthly Payment</p>
                            <p className="font-medium">${loan.monthly_payment.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Remaining Balance</p>
                            <p className="font-medium">${loan.remaining_balance.toFixed(2)}</p>
                          </div>
                        </div>
                        {loan.purpose && (
                          <p className="text-sm text-gray-600 mt-2">Purpose: {loan.purpose}</p>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No transactions found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction: Transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>{transaction.created_at.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <span>{getTransactionIcon(transaction.type)}</span>
                            <span className="capitalize">{transaction.type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{transaction.description || '-'}</TableCell>
                        <TableCell className={`text-right font-medium ${getTransactionColor(transaction.type)}`}>
                          {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card>
            <CardHeader>
              <CardTitle>My Loan Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {loans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No loan applications found</p>
              ) : (
                <div className="space-y-4">
                  {loans.map((loan: Loan) => (
                    <div key={loan.id} className="p-4 rounded-lg border">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium text-lg">${loan.amount.toFixed(2)} Loan</h3>
                          <p className="text-sm text-gray-500">
                            Applied: {loan.created_at.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={getStatusColor(loan.status)}>
                          {loan.status}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <p className="text-gray-500">Interest Rate</p>
                          <p className="font-medium">{loan.interest_rate}% APR</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Term</p>
                          <p className="font-medium">{loan.term_months} months</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Monthly Payment</p>
                          <p className="font-medium">${loan.monthly_payment.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Total Amount</p>
                          <p className="font-medium">${loan.total_amount.toFixed(2)}</p>
                        </div>
                      </div>

                      {loan.status === 'active' && (
                        <div className="bg-blue-50 p-3 rounded text-sm">
                          <p className="text-blue-800 font-medium">
                            Remaining Balance: ${loan.remaining_balance.toFixed(2)}
                          </p>
                        </div>
                      )}

                      {loan.purpose && (
                        <p className="text-sm text-gray-600 mt-2">
                          <span className="font-medium">Purpose:</span> {loan.purpose}
                        </p>
                      )}

                      {loan.approved_at && (
                        <p className="text-sm text-gray-500 mt-1">
                          Approved: {loan.approved_at.toLocaleDateString()}
                        </p>
                      )}

                      {loan.disbursed_at && (
                        <p className="text-sm text-gray-500 mt-1">
                          Disbursed: {loan.disbursed_at.toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apply">
          <Card>
            <CardHeader>
              <CardTitle>Apply for a New Loan</CardTitle>
              <p className="text-gray-600">Fill out the form below to submit a loan application</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLoanApplication} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Loan Amount ($)</label>
                  <Input
                    type="number"
                    min="100"
                    max="50000"
                    step="50"
                    value={loanForm.amount || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoanForm((prev: CreateLoanApplicationInput) => ({
                        ...prev,
                        amount: parseFloat(e.target.value) || 0
                      }))
                    }
                    placeholder="Enter loan amount"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Loan Term (months)</label>
                  <Input
                    type="number"
                    min="6"
                    max="60"
                    value={loanForm.term_months}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setLoanForm((prev: CreateLoanApplicationInput) => ({
                        ...prev,
                        term_months: parseInt(e.target.value) || 12
                      }))
                    }
                    placeholder="Enter loan term in months"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Purpose (optional)</label>
                  <Textarea
                    value={loanForm.purpose || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setLoanForm((prev: CreateLoanApplicationInput) => ({
                        ...prev,
                        purpose: e.target.value || null
                      }))
                    }
                    placeholder="Describe the purpose of your loan"
                    rows={3}
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <span className="font-medium">Note:</span> Your loan application will be reviewed by the cooperative management. 
                    Interest rates and terms will be determined based on your application and cooperative policies.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || loanForm.amount <= 0}
                  className="w-full"
                >
                  {isLoading ? 'Submitting...' : 'Submit Loan Application'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}