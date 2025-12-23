
import React, { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { Layout } from './components/Layout';
import { storageService } from './services/storageService';
import { User, ROLE_RANK } from './types';
import { Loader2 } from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Attempt to restore session
    const checkSession = async () => {
        try {
            const savedUser = await storageService.getCurrentUser();
            if (savedUser) setUser(savedUser);
        } catch (e) {
            console.error("Session restore failed", e);
        } finally {
            setCheckingSession(false);
        }
    };
    checkSession();
  }, []);

  const handleLogin = (u: User) => {
    setUser(u);
  };

  const handleLogout = () => {
    storageService.logout();
    setUser(null);
  };

  if (checkingSession) {
      return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-blue-600" size={40}/></div>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // If user has a role with management capability (rank > 1), show AdminDashboard (Manager view)
  const isManager = ROLE_RANK[user.role] > 1;

  return (
    <Layout user={user} onLogout={handleLogout}>
      {isManager ? (
        <AdminDashboard currentUser={user} />
      ) : (
        <EmployeeDashboard user={user} />
      )}
    </Layout>
  );
}

export default App;
