import { useEffect, useState, useMemo, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { api } from '../api';
import { formatNumber } from '../utils/format';

function groupByProduct(rows) {
  const map = {};
  for (const r of rows) {
    if (!map[r.product_id]) {
      map[r.product_id] = {
        product_id: r.product_id,
        product_name: r.product_name,
        category_name: r.category_name,
        color_code: r.color_code,
        min_stock_level: r.min_stock_level,
        sizes: [],
        total_quantity: 0,
        has_low_stock: false,
      };
    }
    const g = map[r.product_id];
    g.sizes.push({
      id: r.id,
      size: r.size,
      quantity: r.quantity,
      is_low_stock: r.is_low_stock,
    });
    g.total_quantity += r.quantity;
    if (r.is_low_stock) g.has_low_stock = true;
  }
  for (const g of Object.values(map)) {
    g.sizes.sort((a, b) => String(a.size).localeCompare(String(b.size), undefined, { numeric: true }));
  }
  return Object.values(map).sort((a, b) =>
    a.category_name.localeCompare(b.category_name) || a.product_name.localeCompare(b.product_name)
  );
}

export default function Inventory() {
  const [rows, setRows] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState({});

  const load = () => {
    api.stock.inventory(filter ? `?category_id=${filter}` : '').then(setRows);
    api.categories.list().then((list) => {
      const seen = new Set();
      setCategories(
        list.filter((c) => {
          if (seen.has(c.name)) return false;
          seen.add(c.name);
          return true;
        })
      );
    });
  };

  useEffect(() => {
    load();
  }, [filter]);

  const grouped = useMemo(() => groupByProduct(rows), [rows]);

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <PageHeader title="Inventory" />

      <div className="flex gap-2 mb-4 flex-wrap p-1 rounded-xl bg-school-navy/5 border border-school-navy/10">
        <button
          type="button"
          className={`filter-pill ${!filter ? 'filter-pill-active' : ''}`}
          onClick={() => setFilter('')}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`filter-pill ${filter == c.id ? 'filter-pill-active' : ''}`}
            onClick={() => setFilter(String(c.id))}
          >
            {c.name}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <p className="text-center text-gray-500 text-sm mt-8 card p-8">
          No stock yet. Use <strong>Add Stock</strong> to add each product and size separately.
        </p>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase w-8" />
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Product type
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Sizes
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Total in stock
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((product) => {
                const isOpen = expanded[product.product_id];
                const sizeCount = product.sizes.length;
                return (
                  <Fragment key={product.product_id}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                      onClick={() => toggle(product.product_id)}
                    >
                      <td className="py-3 px-4 text-gray-400">
                        {isOpen ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: product.color_code }}
                          />
                          {product.category_name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{product.product_name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {product.sizes.map((s) => (
                            <span
                              key={s.size}
                              className={`text-xs px-2 py-0.5 rounded-full border ${
                                s.is_low_stock
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-gray-100 text-gray-700 border-gray-200'
                              }`}
                            >
                              {s.size}: {s.quantity}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold">{formatNumber(product.total_quantity)}</td>
                      <td className="py-3 px-4">
                        {product.has_low_stock ? (
                          <span className="text-red-600 text-xs font-medium">Low on some sizes</span>
                        ) : (
                          <span className="text-green-600 text-xs font-medium">OK</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && sizeCount > 0 && (
                      <tr key={`${product.product_id}-detail`} className="bg-gray-50/50">
                        <td colSpan={6} className="px-4 pb-3 pt-0">
                          <table className="w-full max-w-lg ml-8 text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="text-left py-2 pr-4">Size</th>
                                <th className="text-left py-2 pr-4">In stock</th>
                                <th className="text-left py-2">Reorder at</th>
                                <th className="text-left py-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {product.sizes.map((s) => (
                                <tr key={s.size} className="border-t border-gray-100">
                                  <td className="py-2 pr-4 font-medium">{s.size}</td>
                                  <td
                                    className={`py-2 pr-4 ${s.is_low_stock ? 'text-red-600 font-semibold' : ''}`}
                                  >
                                    {formatNumber(s.quantity)}
                                  </td>
                                  <td className="py-2 pr-4 text-gray-500">
                                    {formatNumber(product.min_stock_level)} per size
                                  </td>
                                  <td className="py-2">
                                    {s.is_low_stock ? (
                                      <span className="text-red-600">Low stock</span>
                                    ) : (
                                      <span className="text-green-600">OK</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
