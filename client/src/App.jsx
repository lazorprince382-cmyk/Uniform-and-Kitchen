import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Products from './pages/Products';
import StockIn from './pages/StockIn';
import IssueUniform from './pages/IssueUniform';
import UniformHistory from './pages/UniformHistory';
import Parents from './pages/Parents';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Roles from './pages/Roles';
import Settings from './pages/Settings';

function InactivityGuard({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useInactivityLogout({
    enabled: !!user,
    onTimeout: () => {
      logout();
      navigate('/login?reason=timeout', { replace: true });
    },
  });

  return children;
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }
  return user ? (
    <InactivityGuard>{children}</InactivityGuard>
  ) : (
    <Navigate to={`/login${location.search || ''}`} replace />
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="products" element={<Products />} />
        <Route path="stock-in" element={<StockIn />} />
        <Route path="issue-uniform" element={<IssueUniform />} />
        <Route path="uniform-history" element={<UniformHistory />} />
        <Route path="categories" element={<Navigate to="/inventory" replace />} />
        <Route path="orders" element={<Navigate to="/uniform-history" replace />} />
        <Route path="issuances" element={<Navigate to="/uniform-history" replace />} />
        <Route path="returns" element={<Navigate to="/uniform-history" replace />} />
        <Route path="stock-out" element={<Navigate to="/inventory" replace />} />
        <Route path="parents" element={<Parents />} />
        <Route path="customers" element={<Navigate to="/parents" replace />} />
        <Route path="suppliers" element={<Navigate to="/" replace />} />
        <Route path="reports/stock" element={<Reports />} />
        <Route path="reports/collections" element={<Reports />} />
        <Route path="reports/sales" element={<Navigate to="/reports/collections" replace />} />
        <Route path="reports/low-stock" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
