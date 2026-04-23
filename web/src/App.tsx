import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/client';
import Layout from './components/Layout';
import ProductsPage from './pages/ProductsPage';
import OrdersPage from './pages/OrdersPage';
import PickListPage from './pages/PickListPage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<ProductsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/pick-list" element={<PickListPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
