import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/utils/trpc';
import type { User, Loan, LoanInstallment, FinancialReport, FinancialReportInput } from '../../../server/src/schema';

interface ManagementDashboardProps {
  user: User;
}

export function ManagementDashboard({ user }: ManagementDashboardProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [pendingLoans, setPendingLoans] = useState<Loan[]>([]);
  const [pendingInstallments, setPendingInstallments] = useState<LoanInstallment[]>([]);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load users count
      const usersData = await trpc.getUsers.query();
      setUsers(usersData);

      // Load pending loan applications
      const loansData = await trpc.getLoanApplications.query();
      setPendingLoans(loansData.filter((loan: Loan) => loan.status === 'pending'));

      // Load pending installments
      const installmentsData = await trpc.getPendingInstallments.query();
      setPendingInstallments(installmentsData);

      // Generate current month financial report
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const reportInput: FinancialReportInput = {
        start_date: startOfMonth,
        end_date: endOfMonth
      };
      
      const reportData = await trpc.generateFinancialReport.query(reportInput);
      setFinancialReport(reportData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'cooperative_management':
        return 'bg-blue-100 text-blue-800';
      case 'member':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const totalMembers = users.filter((u: User) => u.role === 'member').length;
  const activeMembers = users.filter((u: User) => u.role === 'member' && u.is_active).length;
  const overdueInstallments = pendingInstallments.filter((inst: LoanInstallment) => 
    new Date(inst.due_date) < new Date() && !inst.is_paid
  );

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
        <CardHeader>
          <CardTitle className="text-2xl">
            Management Dashboard 📊
          </CardTitle>
          <p className="text-indigo-100">
            Overview of cooperative operations and key metrics
          </p>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">👥 Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {activeMembers} active members
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">⏳ Pending Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingLoans.length}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">💰 Total Savings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${financialReport?.savings.total_balance.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🚨 Overdue Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueInstallments.length}</div>
            <p className="text-xs text-muted-foreground">
              Installments overdue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      {financialReport && (
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary - Current Month</CardTitle>
            <p className="text-sm text-gray-600">
              {financialReport.period.start_date.toLocaleDateString()} - {financialReport.period.end_date.toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">💰 Savings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Total Deposits:</span>
                    <span className="text-green-600">+${financialReport.savings.total_deposits.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Withdrawals:</span>
                    <span className="text-red-600">-${financialReport.savings.total_withdrawals.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Net Savings:</span>
                    <span className={financialReport.savings.net_savings >= 0 ? 'text-green-600' : 'text-red-600'}>
                      ${financialReport.savings.net_savings.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">🏦 Loans</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Disbursed:</span>
                    <span>${financialReport.loans.total_disbursed.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Repaid:</span>
                    <span className="text-green-600">${financialReport.loans.total_repaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outstanding:</span>
                    <span>${financialReport.loans.outstanding_principal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Interest Earned:</span>
                    <span className="text-blue-600">${financialReport.loans.interest_earned.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">📊 Installments</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Expected:</span>
                    <span>${financialReport.installments.total_expected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Collected:</span>
                    <span className="text-green-600">${financialReport.installments.total_collected.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Overdue:</span>
                    <span className="text-red-600">${financialReport.installments.overdue_amount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>Collection Rate:</span>
                    <span className={financialReport.installments.collection_rate >= 90 ? 'text-green-600' : 'text-orange-600'}>
                      {financialReport.installments.collection_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Loan Applications */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Loan Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingLoans.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending applications</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Applied</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingLoans.slice(0, 5).map((loan: Loan) => (
                    <TableRow key={loan.id}>
                      <TableCell>User #{loan.user_id}</TableCell>
                      <TableCell>${loan.amount.toFixed(2)}</TableCell>
                      <TableCell>{loan.term_months}mo</TableCell>
                      <TableCell>{loan.created_at.toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Overdue Installments */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Installments</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueInstallments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No overdue payments</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loan ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Late</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueInstallments.slice(0, 5).map((installment: LoanInstallment) => {
                    const daysLate = Math.floor((new Date().getTime() - new Date(installment.due_date).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <TableRow key={installment.id}>
                        <TableCell>#{installment.loan_id}</TableCell>
                        <TableCell>${installment.amount.toFixed(2)}</TableCell>
                        <TableCell>{installment.due_date.toLocaleDateString()}</TableCell>
                        <TableCell className="text-red-600 font-medium">{daysLate} days</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="text-2xl mb-2">👥</div>
              <p className="text-sm font-medium">Manage Members</p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="text-2xl mb-2">🏦</div>
              <p className="text-sm font-medium">Process Loans</p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="text-2xl mb-2">💰</div>
              <p className="text-sm font-medium">Record Transactions</p>
            </div>
            <div className="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
              <div className="text-2xl mb-2">📊</div>
              <p className="text-sm font-medium">View Reports</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}