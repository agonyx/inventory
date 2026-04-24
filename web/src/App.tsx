import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './api/client';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import PickListPage from './pages/PickListPage';
import AuditLogsPage from './pages/AuditLogsPage';
import LocationsPage from './pages/LocationsPage';
import InventoryPage from './pages/InventoryPage';
import TransfersPage from './pages/TransfersPage';
import StocktakesPage from './pages/StocktakesPage';
import ReportsPage from './pages/ReportsPage';
import WebhookConfigsPage from './pages/WebhookConfigsPage';
import SettingsPage from './pages/SettingsPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import NotFoundPage from './pages/NotFoundPage';
import ReturnsPage from './pages/ReturnsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster richColors position="top-right" />
      <BrowserRouter>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<ProductsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/returns" element={<ReturnsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/transfers" element={<TransfersPage />} />
              <Route path="/stocktakes" element={<StocktakesPage />} />
              <Route path="/pick-list" element={<PickListPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/locations" element={<LocationsPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/webhooks" element={<WebhookConfigsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
