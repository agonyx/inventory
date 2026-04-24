import { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Package, DollarSign, AlertTriangle, ClipboardList, TrendingUp, PackageCheck,
} from 'lucide-react';
import {
  useReportSummary, useStockByLocation, useOrdersOverTime,
  useTopProducts, useInventoryValuation,
} from '../hooks/useReports';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function formatCurrency(val: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
}

function formatNumber(val: number) {
  return new Intl.NumberFormat('en-US').format(val);
}

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType;
  color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const { data: summary, isLoading: summaryLoading } = useReportSummary();
  const { data: stockByLocation } = useStockByLocation();
  const { data: ordersOverTime } = useOrdersOverTime();
  const { data: topProducts } = useTopProducts(10);
  const { data: valuation } = useInventoryValuation();

  // Orders by status for donut chart
  const ordersByStatus = [
    { name: 'Pending', value: summary?.pendingOrders ?? 0, color: '#f59e0b' },
    { name: 'Shipped', value: Math.max(0, (summary?.totalOrders ?? 0) - (summary?.pendingOrders ?? 0) - 5), color: '#3b82f6' },
    { name: 'Other', value: 5, color: '#6b7280' },
  ];

  if (summaryLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Reports Dashboard</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Total Products" value={formatNumber(summary?.totalProducts ?? 0)} icon={Package} color="bg-blue-500" />
        <KpiCard label="Stock Value" value={formatCurrency(summary?.totalStockValue ?? 0)} icon={DollarSign} color="bg-green-500" sub="across all locations" />
        <KpiCard label="Low Stock Alerts" value={summary?.lowStockCount ?? 0} icon={AlertTriangle} color="bg-amber-500" />
        <KpiCard label="Pending Orders" value={summary?.pendingOrders ?? 0} icon={ClipboardList} color="bg-orange-500" />
        <KpiCard label="Orders Today" value={summary?.ordersToday ?? 0} icon={TrendingUp} color="bg-purple-500" />
        <KpiCard label="Total Orders" value={formatNumber(summary?.totalOrders ?? 0)} icon={PackageCheck} color="bg-cyan-500" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders Over Time */}
        <ChartCard title="Orders Over Time (Last 30 Days)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ordersOverTime ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
                  formatter={(val, name) => [
                    name === 'revenue' ? formatCurrency(Number(val)) : formatNumber(Number(val)),
                    name === 'revenue' ? 'Revenue' : 'Orders',
                  ]}
                />
                <Legend />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} name="Orders" dot={false} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="Revenue ($)" dot={false} yAxisId={0} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Orders by Status */}
        <ChartCard title="Orders by Status">
          <div className="h-72 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ordersByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {ordersByStatus.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Stock Levels by Location */}
        <ChartCard title="Stock Levels by Location">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockByLocation ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="locationName"
                  tick={{ fontSize: 11 }}
                  width={100}
                />
                <Tooltip />
                <Bar dataKey="totalQuantity" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total Qty" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Top Selling Products */}
        <ChartCard title="Top Selling Products (Last 30 Days)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="productName"
                  tick={{ fontSize: 10 }}
                  angle={-25}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val, name) => [
                  name === 'totalRevenue' ? formatCurrency(Number(val)) : formatNumber(Number(val)),
                  name === 'totalRevenue' ? 'Revenue' : 'Qty Sold',
                ]} />
                <Legend />
                <Bar dataKey="totalQuantity" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Qty Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Inventory Valuation Table */}
      <ChartCard title="Inventory Valuation">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-medium text-gray-600">Product</th>
                <th className="text-left py-2 px-3 font-medium text-gray-600">SKU</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Total Stock</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Unit Price</th>
                <th className="text-right py-2 px-3 font-medium text-gray-600">Total Value</th>
              </tr>
            </thead>
            <tbody>
              {(valuation ?? []).slice(0, 20).map((item) => (
                <tr key={item.productId} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 px-3 font-medium text-gray-900">{item.productName}</td>
                  <td className="py-2 px-3 text-gray-600">{item.sku}</td>
                  <td className="py-2 px-3 text-right text-gray-900">{formatNumber(item.totalStock)}</td>
                  <td className="py-2 px-3 text-right text-gray-600">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">{formatCurrency(item.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(valuation?.length ?? 0) > 20 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Showing top 20 of {valuation?.length} products
            </p>
          )}
        </div>
      </ChartCard>
    </div>
  );
}
