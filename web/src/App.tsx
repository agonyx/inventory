import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from './api/client';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import LoadingFallback from './components/LoadingFallback';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const PickListPage = lazy(() => import('./pages/PickListPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const LocationsPage = lazy(() => import('./pages/LocationsPage'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const TransfersPage = lazy(() => import('./pages/TransfersPage'));
const StocktakesPage = lazy(() => import('./pages/StocktakesPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));
const WebhookConfigsPage = lazy(() => import('./pages/WebhookConfigsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage'));
const PurchaseOrdersPage = lazy(() => import('./pages/PurchaseOrdersPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ReturnsPage = lazy(() => import('./pages/ReturnsPage'));

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
          <Suspense fallback={<LoadingFallback />}>
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
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
