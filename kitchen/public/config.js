/** Configure standalone local development or the unified /kitchen mount. */
(function configureKitchen() {
  const isUnified = window.location.pathname.startsWith('/kitchen');

  window.KITCHEN_UNIFIED_LOGIN_URL = isUnified
    ? `${window.location.origin}/login?system=kitchen`
    : 'http://localhost:3002/login?system=kitchen';
  window.KITCHEN_API_BASE = isUnified ? '/kitchen' : '';
  window.KITCHEN_BASE_PATH = isUnified ? '/kitchen/' : '';
})();
