import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { User, FinancialReport, FinancialReportInput } from '../../../server/src/schema';

interface FinancialReportsProps {
  currentUser: User;
}

export function FinancialReports({ currentUser }: FinancialReportsProps) {
  const [reportData, setReportData] = useState<FinancialReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Report form state
  const [reportForm, setReportForm] = useState<FinancialReportInput>({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // Start of current month
    end_date: new Date() // Today
  });

  const [quickPeriod, setQuickPeriod] = useState('current_month');

  const generateReport = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const report = await trpc.generateFinancialReport.query(reportForm);
      setReportData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  }, [reportForm]);

  const handleQuickPeriodChange = (period: string) => {
    setQuickPeriod(period);
    const now = new Date();
    
    switch (period) {
      case 'current_month':
        setReportForm({
          start_date: new Date(now.getFullYear(), now.getMonth(), 1),
          end_date: now
        });
        break;
      case 'last_month':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        setReportForm({
          start_date: lastMonth,
          end_date: lastMonthEnd
        });
        break;
      case 'current_quarter':
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        setReportForm({
          start_date: quarterStart,
          end_date: now
        });
        break;
      case 'current_year':
        setReportForm({
          start_date: new Date(now.getFullYear(), 0, 1),
          end_date: now
        });
        break;
      case 'last_year':
        setReportForm({
          start_date: new Date(now.getFullYear() - 1, 0, 1),
          end_date: new Date(now.getFullYear() - 1, 11, 31)
        });
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handleGenerateReport = (e: React.FormEvent) => {
    e.preventDefault();
    generateReport();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
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
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Financial Reports</CardTitle>
          <p className="text-gray-600">Generate comprehensive reports on savings, loans, and installments</p>
        </CardHeader>
      </Card>

      {/* Report Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Report Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Quick Period</label>
                <Select value={quickPeriod} onValueChange={handleQuickPeriodChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_month">Current Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="current_year">Current Year</SelectItem>
                    <SelectItem value="last_year">Last Year</SelectItem>
                    <SelectItem value="custom">Custom Period</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <Input
                  type="date"
                  value={reportForm.start_date.toISOString().split('T')[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setReportForm((prev: FinancialReportInput) => ({
                      ...prev,
                      start_date: new Date(e.target.value)
                    }))
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <Input
                  type="date"
                  value={reportForm.end_date.toISOString().split('T')[0]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setReportForm((prev: FinancialReportInput) => ({
                      ...prev,
                      end_date: new Date(e.target.value)
                    }))
                  }
                />
              </div>
            </div>

            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Generating Report...' : 'Generate Report'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Report Content */}
      {reportData && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="loans">Loans</TabsTrigger>
            <TabsTrigger value="installments">Installments</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(reportData.savings.total_balance)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total Savings Balance</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(reportData.loans.outstanding_principal)}
                    </div>
                    <p className="text-xs text-muted-foreground">Outstanding Loans</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-purple-600">
                      {formatCurrency(reportData.loans.interest_earned)}
                    </div>
                    <p className="text-xs text-muted-foreground">Interest Earned</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold text-orange-600">
                      {formatPercentage(reportData.installments.collection_rate)}
                    </div>
                    <p className="text-xs text-muted-foreground">Collection Rate</p>
                  </CardContent>
                </Card>
              </div>

              {/* Period Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Report Period</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg">
                    <span className="font-medium">
                      {reportData.period.start_date.toLocaleDateString()} - {reportData.period.end_date.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Generated on {new Date().toLocaleDateString()} by {currentUser.full_name}
                  </p>
                </CardContent>
              </Card>

              {/* Key Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Financial Health Indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Loan Collection Rate</span>
                        <span>{formatPercentage(reportData.installments.collection_rate)}</span>
                      </div>
                      <Progress value={reportData.installments.collection_rate} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Savings Growth</span>
                        <span className={reportData.savings.net_savings >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(reportData.savings.net_savings)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Net change in savings for the period
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Active Loans</span>
                        <span>{reportData.loans.active_loans}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Completed Loans</span>
                        <span>{reportData.loans.completed_loans}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Risk Indicators</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-red-800">Overdue Amount</span>
                        <span className="text-lg font-bold text-red-600">
                          {formatCurrency(reportData.installments.overdue_amount)}
                        </span>
                      </div>
                      <p className="text-xs text-red-600 mt-1">
                        Requires immediate attention
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-yellow-800">Collection Gap</span>
                        <span className="text-lg font-bold text-yellow-600">
                          {formatCurrency(reportData.installments.total_expected - reportData.installments.total_collected)}
                        </span>
                      </div>
                      <p className="text-xs text-yellow-600 mt-1">
                        Expected vs collected payments
                      </p>
                    </div>

                    {reportData.installments.collection_rate < 90 && (
                      <Alert>
                        <AlertDescription className="text-sm">
                          ⚠️ Collection rate is below 90%. Consider following up on overdue payments.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="savings">
            <Card>
              <CardHeader>
                <CardTitle>💰 Savings Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Activity Summary</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm">Total Deposits</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(reportData.savings.total_deposits)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm">Total Withdrawals</span>
                        <span className="font-semibold text-red-600">
                          {formatCurrency(reportData.savings.total_withdrawals)}
                        </span>
                      </div>
                      <div className={`flex justify-between p-3 rounded-lg ${
                        reportData.savings.net_savings >= 0 ? 'bg-green-50' : 'bg-red-50'
                      }`}>
                        <span className="text-sm font-medium">Net Savings</span>
                        <span className={`font-bold ${
                          reportData.savings.net_savings >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(reportData.savings.net_savings)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Current Status</h3>
                    <div className="space-y-3">
                      <div className="p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 mb-1">
                          {formatCurrency(reportData.savings.total_balance)}
                        </div>
                        <p className="text-sm text-gray-600">Total Balance Across All Accounts</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-lg font-semibold text-blue-600">
                            {((reportData.savings.total_deposits / (reportData.savings.total_deposits + reportData.savings.total_withdrawals)) * 100).toFixed(1)}%
                          </div>
                          <p className="text-xs text-blue-600">Deposit Ratio</p>
                        </div>
                        <div className="text-center p-3 bg-orange-50 rounded-lg">
                          <div className="text-lg font-semibold text-orange-600">
                            {((reportData.savings.total_withdrawals / (reportData.savings.total_deposits + reportData.savings.total_withdrawals)) * 100).toFixed(1)}%
                          </div>
                          <p className="text-xs text-orange-600">Withdrawal Ratio</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="loans">
            <Card>
              <CardHeader>
                <CardTitle>🏦 Loans Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Disbursement & Repayment</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm">Total Disbursed</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(reportData.loans.total_disbursed)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm">Total Repaid</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(reportData.loans.total_repaid)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm">Interest Earned</span>
                        <span className="font-semibold text-purple-600">
                          {formatCurrency(reportData.loans.interest_earned)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Loan Portfolio</h3>
                    <div className="space-y-3">
                      <div className="p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-600 mb-1">
                          {formatCurrency(reportData.loans.outstanding_principal)}
                        </div>
                        <p className="text-sm text-gray-600">Outstanding Principal</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-3 bg-green-50 rounded-lg">
                          <div className="text-lg font-semibold text-green-600">
                            {reportData.loans.active_loans}
                          </div>
                          <p className="text-xs text-green-600">Active Loans</p>
                        </div>
                        <div className="text-center p-3 bg-blue-50 rounded-lg">
                          <div className="text-lg font-semibold text-blue-600">
                            {reportData.loans.completed_loans}
                          </div>
                          <p className="text-xs text-blue-600">Completed Loans</p>
                        </div>
                      </div>

                      {reportData.loans.total_disbursed > 0 && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between text-sm">
                            <span>Recovery Rate</span>
                            <span className="font-medium">
                              {formatPercentage((reportData.loans.total_repaid / reportData.loans.total_disbursed) * 100)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="installments">
            <Card>
              <CardHeader>
                <CardTitle>📊 Installments Report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Collection Performance</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm">Expected Collections</span>
                        <span className="font-semibold text-blue-600">
                          {formatCurrency(reportData.installments.total_expected)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm">Actual Collections</span>
                        <span className="font-semibold text-green-600">
                          {formatCurrency(reportData.installments.total_collected)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-red-50 rounded-lg">
                        <span className="text-sm">Overdue Amount</span>
                        <span className="font-semibold text-red-600">
                          {formatCurrency(reportData.installments.overdue_amount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Collection Rate Analysis</h3>
                    <div className="space-y-3">
                      <div className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">Collection Rate</span>
                          <span className={`text-2xl font-bold ${
                            reportData.installments.collection_rate >= 90 ? 'text-green-600' : 
                            reportData.installments.collection_rate >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {formatPercentage(reportData.installments.collection_rate)}
                          </span>
                        </div>
                        <Progress value={reportData.installments.collection_rate} className="h-3" />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-3">
                        <div className={`p-3 rounded-lg ${
                          reportData.installments.collection_rate >= 90 ? 'bg-green-50' : 
                          reportData.installments.collection_rate >= 70 ? 'bg-yellow-50' : 'bg-red-50'
                        }`}>
                          <p className={`text-sm font-medium ${
                            reportData.installments.collection_rate >= 90 ? 'text-green-800' : 
                            reportData.installments.collection_rate >= 70 ? 'text-yellow-800' : 'text-red-800'
                          }`}>
                            Performance Status
                          </p>
                          <p className={`text-xs ${
                            reportData.installments.collection_rate >= 90 ? 'text-green-600' : 
                            reportData.installments.collection_rate >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {reportData.installments.collection_rate >= 90 ? 'Excellent - Above 90%' : 
                             reportData.installments.collection_rate >= 70 ? 'Good - Above 70%' : 'Needs Attention - Below 70%'}
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between text-sm">
                          <span>Collection Efficiency</span>
                          <span className="font-medium">
                            {formatCurrency(reportData.installments.total_collected)} / {formatCurrency(reportData.installments.total_expected)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}