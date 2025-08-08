import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { User, UserRole } from '../../server/src/schema';

// Components for different features
import { MemberDashboard } from '@/components/MemberDashboard';
import { ManagementDashboard } from '@/components/ManagementDashboard';
import { UserManagement } from '@/components/UserManagement';
import { LoanManagement } from '@/components/LoanManagement';
import { TransactionManagement } from '@/components/TransactionManagement';
import { FinancialReports } from '@/components/FinancialReports';

// Mock authentication - In a real app, this would be handled by auth provider
const mockUsers: User[] = [
  {
    id: 1,
    username: 'john_member',
    email: 'john@example.com',
    full_name: 'John Doe',
    phone: '+1234567890',
    address: '123 Main St',
    role: 'member',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 2,
    username: 'jane_manager',
    email: 'jane@example.com',
    full_name: 'Jane Smith',
    phone: '+1234567891',
    address: '456 Oak Ave',
    role: 'cooperative_management',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: 3,
    username: 'admin_user',
    email: 'admin@example.com',
    full_name: 'Admin User',
    phone: '+1234567892',
    address: '789 Pine St',
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    updated_at: new Date()
  }
];

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getRoleColor = (role: UserRole) => {
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

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'cooperative_management':
        return 'Management';
      case 'member':
        return 'Member';
      default:
        return role;
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Login screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">
              🏦 Cooperative Savings & Loans
            </CardTitle>
            <p className="text-gray-600 mt-2">
              Select a user to simulate login
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockUsers.map((user: User) => (
              <Button
                key={user.id}
                onClick={() => handleLogin(user)}
                variant="outline"
                className="w-full justify-between h-auto p-4"
                disabled={isLoading}
              >
                <div className="text-left">
                  <div className="font-medium">{user.full_name}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </div>
                <Badge className={getRoleColor(user.role)}>
                  {getRoleDisplayName(user.role)}
                </Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main application
  const isManagementOrAdmin = currentUser.role === 'cooperative_management' || currentUser.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-gray-900">
                🏦 Cooperative Savings & Loans
              </h1>
              <Badge className={getRoleColor(currentUser.role)}>
                {getRoleDisplayName(currentUser.role)}
              </Badge>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {currentUser.full_name}
              </span>
              <Button onClick={handleLogout} variant="outline" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === 'member' ? (
          <MemberDashboard user={currentUser} />
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-2 lg:grid-cols-5 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="users">Members</TabsTrigger>
              <TabsTrigger value="loans">Loans</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <ManagementDashboard user={currentUser} />
            </TabsContent>

            <TabsContent value="users">
              <UserManagement currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="loans">
              <LoanManagement currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionManagement currentUser={currentUser} />
            </TabsContent>

            <TabsContent value="reports">
              <FinancialReports currentUser={currentUser} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

export default App;