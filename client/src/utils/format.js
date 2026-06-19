export function formatDate(date) {
  return new Date(date).toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-UG').format(n || 0);
}
