import { useEffect, useState } from 'react';
import { Boxes, AlertTriangle, ClipboardList, GraduationCap } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { api } from '../api';
import { formatNumber } from '../utils/format';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.stats().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-school-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return <p className="text-red-500">Failed to load dashboard</p>;

  const { metrics, lowStockAlerts, inventoryByCategory, stockMovement } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Bursar overview — stock and issuances</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Stock"
          value={formatNumber(metrics.totalStock)}
          subtitle="Units on hand"
          icon={Boxes}
        />
        <MetricCard
          title="Low Stock"
          value={formatNumber(metrics.lowStockItems)}
          subtitle="Reorder needed"
          icon={AlertTriangle}
          accent="warning"
        />
        <MetricCard
          title="Issued to Children"
          value={formatNumber(metrics.totalIssuances)}
          subtitle="Issuance slips this month"
          icon={ClipboardList}
          accent="brand"
        />
        <MetricCard
          title="Students"
          value={formatNumber(metrics.enrolledStudents)}
          subtitle={`${formatNumber(metrics.registeredParents)} families registered`}
          icon={GraduationCap}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Low Stock Alerts</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {lowStockAlerts.length === 0 ? (
              <p className="text-sm text-gray-400">All items adequately stocked</p>
            ) : (
              lowStockAlerts.map((item) => (
                <div key={`${item.id}-${item.size || ''}`} className="flex items-center gap-3">
                  <img src={item.image_url} alt="" className="w-10 h-10 rounded-lg bg-gray-100 object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">
                      {item.size ? `Size ${item.size}` : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-school-red whitespace-nowrap">
                    {item.current_stock} left
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Stock Movement (This Month)</h2>
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-100 rounded-lg p-4">
              <p className="text-sm text-green-700 font-medium">Stock In</p>
              <p className="text-2xl font-bold text-green-800">+{formatNumber(stockMovement.stockIn)} units</p>
            </div>
            <div className="bg-red-50 border border-school-red/20 rounded-lg p-4">
              <p className="text-sm text-school-red font-medium">Issued to Children</p>
              <p className="text-2xl font-bold text-school-red-dark">-{formatNumber(stockMovement.stockOut)} units</p>
            </div>
            <div className="bg-school-navy/5 border border-school-navy/15 rounded-lg p-4">
              <p className="text-sm text-school-navy font-medium">Net Movement</p>
              <p className="text-2xl font-bold text-school-navy">
                {stockMovement.netMovement >= 0 ? '+' : ''}
                {formatNumber(stockMovement.netMovement)} units
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Stock by Product Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {inventoryByCategory.map((cat) => (
            <div key={cat.category_id}>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color_code }} />
                {cat.category_name}
              </h3>
              <div className="space-y-2">
                {cat.products.length === 0 ? (
                  <p className="text-xs text-gray-400">No stock added yet</p>
                ) : (
                  cat.products.slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="truncate flex-1">{p.name}</span>
                      <span className="text-gray-500 font-medium ml-2">{formatNumber(p.current_stock)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
