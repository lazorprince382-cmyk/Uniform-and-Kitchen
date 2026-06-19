export default function MetricCard({ title, value, subtitle, icon: Icon, accent }) {
  const subtitleClass = {
    default: 'text-gray-600',
    warning: 'text-school-red',
    brand: 'text-school-red',
    success: 'text-green-600',
  };

  const iconWrapClass = {
    default: 'bg-gray-50 text-gray-400',
    warning: 'bg-red-50 text-school-red',
    brand: 'bg-red-50 text-school-red',
    success: 'bg-green-50 text-green-600',
  };

  const cardBorder =
    accent === 'brand'
      ? 'border-l-4 border-l-school-red'
      : accent === 'warning'
        ? 'border-l-4 border-l-school-red'
        : '';

  return (
    <div className={`card p-5 ${cardBorder}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className={`text-xs mt-1 ${subtitleClass[accent] || subtitleClass.default}`}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              iconWrapClass[accent] || iconWrapClass.default
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
