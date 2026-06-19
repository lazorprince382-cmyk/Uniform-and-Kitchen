import { SCHOOL } from '../config/school';

/**
 * School logo and name — use in sidebar, login, headers.
 */
export default function SchoolBrand({ compact = false, light = false, className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={SCHOOL.logoUrl}
        alt={SCHOOL.name}
        className={`rounded-full object-cover bg-white shrink-0 ring-2 ring-white/20 ${
          compact ? 'w-10 h-10' : 'w-12 h-12'
        }`}
      />
      <div className="min-w-0">
        <h1
          className={`font-semibold leading-tight ${
            light ? 'text-white' : 'text-school-navy'
          } ${compact ? 'text-sm' : 'text-base'}`}
        >
          {compact ? SCHOOL.shortName : SCHOOL.name}
        </h1>
        <p className={`text-xs ${light ? 'text-gray-300' : 'text-gray-500'}`}>
          {SCHOOL.deskTitle}
        </p>
      </div>
    </div>
  );
}
