import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { User, Transaction, Account, CreateTransactionInput, TransactionType } from '../../../server/src/schema';

interface TransactionManagementProps {
  currentUser: User;
}

export function TransactionManagement({ currentUser }: TransactionManagementProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);

  // Transaction form state
  const [transactionForm, setTransactionForm] = useState<CreateTransactionInput>({
    account_id: 0,
    type: 'deposit',
    amount: 0,
    description: null,
    processed_by: currentUser.id
  });

  const [selectedUserId, setSelectedUserId] = useState<number>(0);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all users to get member list
      const usersData = await trpc.getUsers.query();
      const members = usersData.filter((user: User) => user.role === 'member' && user.is_active);
      setUsers(members);

      // Load accounts for form selection
      // Note: This would typically be a separate endpoint to get all accounts
      // For now, we'll collect them as we load transaction data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMemberTransactions = useCallback(async (userId: number) => {
    try {
      setIsLoading(true);
      
      // Load member's account
      const account = await trpc.getSavingsBalance.query({ userId });
      
      // Load member's transaction history
      const transactions = await trpc.getTransactionHistory.query({ userId });
      setRecentTransactions(transactions);
      
      // Update form with account ID
      setTransactionForm((prev: CreateTransactionInput) => ({
        ...prev,
        account_id: account.id
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load member transactions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUserSelect = (userId: number) => {
    setSelectedUserId(userId);
    loadMemberTransactions(userId);
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const newTransaction = await trpc.createTransaction.mutate(transactionForm);
      
      // Add to transactions list
      setRecentTransactions((prev: Transaction[]) => [newTransaction, ...prev]);
      
      // Reset form
      setTransactionForm({
        account_id: transactionForm.account_id, // Keep the same account
        type: 'deposit',
        amount: 0,
        description: null,
        processed_by: currentUser.id
      });
      
      setShowTransactionDialog(false);
      
      // Refresh member data
      if (selectedUserId) {
        await loadMemberTransactions(selectedUserId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction');
    } finally {
      setIsLoading(false);
    }
  };

  const getTransactionColor = (type: TransactionType) => {
    return type === 'deposit' ? 'text-green-600' : 'text-red-600';
  };

  const getTransactionIcon = (type: TransactionType) => {
    return type === 'deposit' ? '↗️' : '↙️';
  };

  const selectedUser = users.find((user: User) => user.id === selectedUserId);

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
          <CardTitle className="flex items-center justify-between">
            <span>💰 Transaction Management</span>
            <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
              <DialogTrigger asChild>
                <Button disabled={!selectedUserId}>
                  Record Transaction
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Record New Transaction</DialogTitle>
                  {selectedUser && (
                    <p className="text-sm text-gray-600">
                      Recording transaction for {selectedUser.full_name}
                    </p>
                  )}
                </DialogHeader>
                <form onSubmit={handleCreateTransaction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Transaction Type</label>
                    <Select
                      value={transactionForm.type}
                      onValueChange={(value: TransactionType) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Amount ($)</label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={transactionForm.amount || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0
                        }))
                      }
                      placeholder="Enter amount"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Description (optional)</label>
                    <Textarea
                      value={transactionForm.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({
                          ...prev,
                          description: e.target.value || null
                        }))
                      }
                      placeholder="Add a note about this transaction"
                      rows={3}
                    />
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg text-sm">
                    <p className="text-blue-800">
                      <span className="font-medium">Note:</span> This transaction will be processed immediately 
                      and will update the member's account balance.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="submit"
                      disabled={isLoading || transactionForm.amount <= 0}
                      className="flex-1"
                    >
                      {isLoading ? 'Processing...' : `Record ${transactionForm.type}`}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowTransactionDialog(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </CardTitle>
          <p className="text-gray-600">Record savings deposits and withdrawals for members</p>
        </CardHeader>
      </Card>

      {/* Member Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Member</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Select
              value={selectedUserId.toString() || ''}
              onValueChange={(value) => handleUserSelect(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a member to manage transactions" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user: User) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedUser && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{selectedUser.full_name}</h3>
                    <p className="text-sm text-gray-600">{selectedUser.email}</p>
                    {selectedUser.phone && (
                      <p className="text-sm text-gray-600">{selectedUser.phone}</p>
                    )}
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    Active Member
                  </Badge>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Balance and Recent Transactions */}
      {selectedUserId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Account Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Account Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Current Balance</p>
                  <p className="text-2xl font-bold">
                    {recentTransactions.length > 0 ? (
                      `$${recentTransactions
                        .reduce((balance: number, transaction: Transaction) => {
                          return transaction.type === 'deposit' 
                            ? balance + transaction.amount 
                            : balance - transaction.amount;
                        }, 0)
                        .toFixed(2)}`
                    ) : (
                      '$0.00'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Transactions</p>
                  <p className="text-lg font-semibold">{recentTransactions.length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Transaction</p>
                  <p className="text-sm">
                    {recentTransactions.length > 0 
                      ? recentTransactions[0].created_at.toLocaleDateString()
                      : 'No transactions yet'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No transactions found</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Record the first transaction using the "Record Transaction" button
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {recentTransactions.map((transaction: Transaction) => (
                    <div key={transaction.id} className="flex justify-between items-center p-3 rounded-lg bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{getTransactionIcon(transaction.type)}</span>
                        <div>
                          <p className="font-medium capitalize">{transaction.type}</p>
                          <p className="text-sm text-gray-500">
                            {transaction.created_at.toLocaleDateString()} at {transaction.created_at.toLocaleTimeString()}
                          </p>
                          {transaction.description && (
                            <p className="text-sm text-gray-600 mt-1">{transaction.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold ${getTransactionColor(transaction.type)}`}>
                          {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                        </span>
                        <p className="text-xs text-gray-500">
                          Processed by User #{transaction.processed_by}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* All Transactions Table */}
      {selectedUserId && recentTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead>Running Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.map((transaction: Transaction, index: number) => {
                  // Calculate running balance (this is a simplified version)
                  const runningBalance = recentTransactions
                    .slice(index)
                    .reduce((balance: number, t: Transaction) => {
                      return t.type === 'deposit' 
                        ? balance + t.amount 
                        : balance - t.amount;
                    }, 0);

                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm">{transaction.created_at.toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500">{transaction.created_at.toLocaleTimeString()}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>{getTransactionIcon(transaction.type)}</span>
                          <Badge variant={transaction.type === 'deposit' ? 'default' : 'secondary'}>
                            {transaction.type}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className={`font-medium ${getTransactionColor(transaction.type)}`}>
                        {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                      </TableCell>
                      <TableCell>{transaction.description || '-'}</TableCell>
                      <TableCell>User #{transaction.processed_by}</TableCell>
                      <TableCell className="font-medium">
                        ${runningBalance.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      {!selectedUserId && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <p>📝 <strong>Select a member</strong> from the dropdown above to view their account and manage transactions.</p>
              <p>💰 <strong>Record deposits</strong> when members bring money to save in their account.</p>
              <p>💸 <strong>Record withdrawals</strong> when members want to take money from their savings.</p>
              <p>📊 <strong>View transaction history</strong> to track all account activity.</p>
              <p>✅ All transactions are automatically recorded with your user ID as the processor.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}