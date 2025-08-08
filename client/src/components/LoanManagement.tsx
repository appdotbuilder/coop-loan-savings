import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { User, Loan, LoanInstallment, ProcessLoanApplicationInput, RecordLoanPaymentInput } from '../../../server/src/schema';

interface LoanManagementProps {
  currentUser: User;
}

export function LoanManagement({ currentUser }: LoanManagementProps) {
  const [applications, setApplications] = useState<Loan[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Process application form
  const [processForm, setProcessForm] = useState<ProcessLoanApplicationInput>({
    loan_id: 0,
    status: 'approved',
    approved_by: currentUser.id,
    interest_rate: 12
  });
  const [showProcessDialog, setShowProcessDialog] = useState(false);

  // Payment recording form
  const [paymentForm, setPaymentForm] = useState<RecordLoanPaymentInput>({
    installment_id: 0,
    paid_amount: 0,
    recorded_by: currentUser.id
  });
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const loadLoansData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load loan applications
      const applicationsData = await trpc.getLoanApplications.query();
      setApplications(applicationsData);

      // Separate active loans
      setActiveLoans(applicationsData.filter((loan: Loan) => loan.status === 'active'));

      // Load pending installments
      const installmentsData = await trpc.getPendingInstallments.query();
      setInstallments(installmentsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loan data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadLoanInstallments = useCallback(async (loanId: number) => {
    try {
      const loanInstallments = await trpc.getLoanInstallments.query({ loanId });
      setInstallments(loanInstallments);
      setSelectedLoanId(loanId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load loan installments');
    }
  }, []);

  useEffect(() => {
    loadLoansData();
  }, [loadLoansData]);

  const handleProcessApplication = async (loan: Loan, status: 'approved' | 'rejected') => {
    setProcessForm({
      loan_id: loan.id,
      status,
      approved_by: currentUser.id,
      interest_rate: 12 // Default interest rate
    });
    setShowProcessDialog(true);
  };

  const submitProcessApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const updatedLoan = await trpc.processLoanApplication.mutate(processForm);
      setApplications((prev: Loan[]) =>
        prev.map((loan: Loan) => loan.id === updatedLoan.id ? updatedLoan : loan)
      );
      if (updatedLoan.status === 'active') {
        setActiveLoans((prev: Loan[]) => [...prev, updatedLoan]);
      }
      setShowProcessDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process application');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordPayment = (installment: LoanInstallment) => {
    setPaymentForm({
      installment_id: installment.id,
      paid_amount: installment.amount - installment.paid_amount,
      recorded_by: currentUser.id
    });
    setShowPaymentDialog(true);
  };

  const submitRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const updatedInstallment = await trpc.recordLoanPayment.mutate(paymentForm);
      setInstallments((prev: LoanInstallment[]) =>
        prev.map((inst: LoanInstallment) => inst.id === updatedInstallment.id ? updatedInstallment : inst)
      );
      setShowPaymentDialog(false);
      
      // Reload data to get updated loan balances
      await loadLoansData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
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

  const pendingApplications = applications.filter((loan: Loan) => loan.status === 'pending');
  const overdueInstallments = installments.filter((inst: LoanInstallment) => 
    new Date(inst.due_date) < new Date() && !inst.is_paid
  );

  if (error) {
    return (
      <Alert className="mb-6">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>🏦 Loan Management</CardTitle>
          <p className="text-gray-600">Manage loan applications, approvals, and payments</p>
        </CardHeader>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{pendingApplications.length}</div>
            <p className="text-xs text-muted-foreground">Pending Applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{activeLoans.length}</div>
            <p className="text-xs text-muted-foreground">Active Loans</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{overdueInstallments.length}</div>
            <p className="text-xs text-muted-foreground">Overdue Payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${activeLoans.reduce((sum: number, loan: Loan) => sum + loan.remaining_balance, 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Outstanding Principal</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="applications" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="active">Active Loans</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="installments">Installments</TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <Card>
            <CardHeader>
              <CardTitle>Pending Loan Applications</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingApplications.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No pending applications</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Term</TableHead>
                      <TableHead>Purpose</TableHead>
                      <TableHead>Applied</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingApplications.map((loan: Loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>User #{loan.user_id}</TableCell>
                        <TableCell>${loan.amount.toFixed(2)}</TableCell>
                        <TableCell>{loan.term_months} months</TableCell>
                        <TableCell>{loan.purpose || '-'}</TableCell>
                        <TableCell>{loan.created_at.toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(loan.status)}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleProcessApplication(loan, 'approved')}
                              disabled={isLoading}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProcessApplication(loan, 'rejected')}
                              disabled={isLoading}
                            >
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {activeLoans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active loans</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loan ID</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Interest Rate</TableHead>
                      <TableHead>Monthly Payment</TableHead>
                      <TableHead>Remaining Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLoans.map((loan: Loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>#{loan.id}</TableCell>
                        <TableCell>User #{loan.user_id}</TableCell>
                        <TableCell>${loan.amount.toFixed(2)}</TableCell>
                        <TableCell>{loan.interest_rate}%</TableCell>
                        <TableCell>${loan.monthly_payment.toFixed(2)}</TableCell>
                        <TableCell>${loan.remaining_balance.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(loan.status)}>
                            {loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => loadLoanInstallments(loan.id)}
                          >
                            View Installments
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Recording</CardTitle>
              <p className="text-gray-600">Record daily loan installment payments</p>
            </CardHeader>
            <CardContent>
              {overdueInstallments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No overdue payments</p>
              ) : (
                <div className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      {overdueInstallments.length} installment(s) are overdue and require immediate attention.
                    </AlertDescription>
                  </Alert>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan ID</TableHead>
                        <TableHead>Installment #</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Amount Due</TableHead>
                        <TableHead>Paid Amount</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Days Late</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueInstallments.map((installment: LoanInstallment) => {
                        const remaining = installment.amount - installment.paid_amount;
                        const daysLate = Math.floor(
                          (new Date().getTime() - new Date(installment.due_date).getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return (
                          <TableRow key={installment.id}>
                            <TableCell>#{installment.loan_id}</TableCell>
                            <TableCell>{installment.installment_number}</TableCell>
                            <TableCell>{installment.due_date.toLocaleDateString()}</TableCell>
                            <TableCell>${installment.amount.toFixed(2)}</TableCell>
                            <TableCell>${installment.paid_amount.toFixed(2)}</TableCell>
                            <TableCell className="text-red-600">${remaining.toFixed(2)}</TableCell>
                            <TableCell className="text-red-600 font-medium">{daysLate} days</TableCell>
                            <TableCell>
                              {remaining > 0 && (
                                <Button
                                  size="sm"
                                  onClick={() => handleRecordPayment(installment)}
                                  disabled={isLoading}
                                >
                                  Record Payment
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installments">
          <Card>
            <CardHeader>
              <CardTitle>Loan Installments</CardTitle>
              {selectedLoanId && (
                <p className="text-gray-600">Showing installments for Loan #{selectedLoanId}</p>
              )}
            </CardHeader>
            <CardContent>
              {!selectedLoanId ? (
                <p className="text-gray-500 text-center py-8">
                  Select a loan from the Active Loans tab to view installments
                </p>
              ) : installments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No installments found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Installment #</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Interest</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paid Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installments.map((installment: LoanInstallment) => (
                      <TableRow key={installment.id}>
                        <TableCell>{installment.installment_number}</TableCell>
                        <TableCell>{installment.due_date.toLocaleDateString()}</TableCell>
                        <TableCell>${installment.amount.toFixed(2)}</TableCell>
                        <TableCell>${installment.principal_amount.toFixed(2)}</TableCell>
                        <TableCell>${installment.interest_amount.toFixed(2)}</TableCell>
                        <TableCell>${installment.paid_amount.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={installment.is_paid ? "default" : "secondary"}>
                            {installment.is_paid ? 'Paid' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {installment.paid_at ? installment.paid_at.toLocaleDateString() : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Application Dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {processForm.status === 'approved' ? 'Approve Loan Application' : 'Reject Loan Application'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitProcessApplication} className="space-y-4">
            {processForm.status === 'approved' && (
              <div>
                <label className="block text-sm font-medium mb-1">Interest Rate (%)</label>
                <Input
                  type="number"
                  min="1"
                  max="30"
                  step="0.1"
                  value={processForm.interest_rate || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setProcessForm((prev: ProcessLoanApplicationInput) => ({
                      ...prev,
                      interest_rate: parseFloat(e.target.value) || 0
                    }))
                  }
                  required
                />
              </div>
            )}
            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1"
                variant={processForm.status === 'approved' ? 'default' : 'destructive'}
              >
                {isLoading ? 'Processing...' : `${processForm.status === 'approved' ? 'Approve' : 'Reject'} Application`}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowProcessDialog(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Loan Payment</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitRecordPayment} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Amount ($)</label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentForm.paid_amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPaymentForm((prev: RecordLoanPaymentInput) => ({
                    ...prev,
                    paid_amount: parseFloat(e.target.value) || 0
                  }))
                }
                required
              />
              <p className="text-sm text-gray-600 mt-1">
                Enter the amount paid by the borrower
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Recording...' : 'Record Payment'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowPaymentDialog(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}