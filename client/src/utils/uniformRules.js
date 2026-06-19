/** Mirror server catalog — used when API omits product.gender */
export const PRODUCT_GENDER_BY_SKU = {
  'US-WSH': 'unisex',
  'US-BSK': 'girl',
  'US-DRS': 'girl',
  'US-SHT': 'boy',
  'SP-WSH': 'unisex',
  'SP-YSH': 'unisex',
  'SP-WTS': 'unisex',
  'TR-MRN': 'unisex',
  'TR-BLK': 'unisex',
  'SK-CBR': 'unisex',
  'SK-NVY': 'unisex',
  'SK-WHT': 'unisex',
  'SW-NVY': 'unisex',
  'SW-MRN': 'unisex',
  'SW-GRY': 'unisex',
};

const OTHER_CATEGORIES = ['Sports Wear', 'Track Suits', 'Sweaters', 'Socks'];
const GIRL_SKIRT_DRESS_SKUS = ['US-BSK', 'US-DRS'];

export function normalizeGender(value) {
  if (!value) return null;
  const g = String(value).toLowerCase().trim();
  if (['boy', 'male', 'm', 'b'].includes(g)) return 'boy';
  if (['girl', 'female', 'f', 'g'].includes(g)) return 'girl';
  return null;
}

export function productGender(product) {
  return product.gender || PRODUCT_GENDER_BY_SKU[product.sku] || 'unisex';
}

/** All catalog items that apply to this child (replacement / resize issues). */
export function productsForStudentGender(products, gender) {
  const g = normalizeGender(gender);
  if (!g) return [];
  return products.filter((p) => productMatchesGender(p, g));
}

export function productMatchesGender(product, gender) {
  const g = normalizeGender(gender);
  const pg = productGender(product);
  if (!g) return pg === 'unisex';
  if (pg === 'unisex') return true;
  return pg === g;
}

/** Client-side full-uniform evaluation (matches server). */
export function evaluateStudentUniform({ gender, receivedItems = [] }) {
  const g = normalizeGender(gender);
  const receivedSkus = new Set(receivedItems.map((i) => i.sku).filter(Boolean));
  const receivedByCategory = {};
  for (const item of receivedItems) {
    const cat = item.category_name;
    if (!cat) continue;
    if (!receivedByCategory[cat]) receivedByCategory[cat] = new Set();
    receivedByCategory[cat].add(item.sku);
  }

  const itemsStillNeeded = [];
  const missingCategories = [];

  if (!g) {
    missingCategories.push('Uniform Store');
  } else if (g === 'boy') {
    if (!receivedSkus.has('US-WSH')) {
      itemsStillNeeded.push({ label: 'White Shirt', category: 'Uniform Store', sku: 'US-WSH' });
    }
    if (!receivedSkus.has('US-SHT')) {
      itemsStillNeeded.push({ label: 'Beige Shorts', category: 'Uniform Store', sku: 'US-SHT' });
    }
  } else if (g === 'girl') {
    if (!receivedSkus.has('US-WSH')) {
      itemsStillNeeded.push({ label: 'White Shirt', category: 'Uniform Store', sku: 'US-WSH' });
    }
    if (!receivedSkus.has('US-BSK') && !receivedSkus.has('US-DRS')) {
      itemsStillNeeded.push({
        label: 'Beige Skirt or Dress',
        category: 'Uniform Store',
        sku: null,
      });
    }
  }

  for (const cat of OTHER_CATEGORIES) {
    if (!receivedByCategory[cat] || receivedByCategory[cat].size === 0) {
      missingCategories.push(cat);
    }
  }

  const uniformStoreOk =
    g && itemsStillNeeded.filter((i) => i.category === 'Uniform Store').length === 0;
  const otherOk = missingCategories.length === 0;
  const anyIssued = receivedItems.length > 0;

  let status = 'none';
  let label = 'No uniform issued';
  if (anyIssued && uniformStoreOk && otherOk) {
    status = 'full';
    label = 'Full uniform received';
  } else if (anyIssued) {
    status = 'partial';
    const parts = itemsStillNeeded.length + missingCategories.length;
    label = `Partial uniform (${parts} still needed)`;
  } else if (!g) {
    label = 'No uniform issued — set gender on child';
  }

  return {
    status,
    label,
    gender: g,
    items_still_needed: itemsStillNeeded,
    missing_categories: missingCategories,
    missing_core_items: [
      ...itemsStillNeeded.map((i) => i.label),
      ...missingCategories,
    ],
  };
}

function categoryMatches(productCategory, missingCategory) {
  if (productCategory === missingCategory) return true;
  if (missingCategory.startsWith('Uniform Store') && productCategory === 'Uniform Store') return true;
  return false;
}

/** Show product on Issue Uniform if child still needs it. */
export function isProductStillNeeded(product, evaluation, receivedSkus, studentGender = null) {
  if (!evaluation || evaluation.status === 'full') return false;
  if (receivedSkus.has(product.sku)) return false;

  const g = normalizeGender(evaluation.gender ?? studentGender);
  if (!productMatchesGender(product, g)) return false;

  const stillNeeded =
    evaluation.items_still_needed || evaluation.itemsStillNeeded || [];
  const missingCats =
    evaluation.missing_categories || evaluation.missingCategories || [];

  for (const need of stillNeeded) {
    if (need.sku && need.sku === product.sku) return true;
    if (
      !need.sku &&
      need.category === 'Uniform Store' &&
      product.category_name === 'Uniform Store' &&
      GIRL_SKIRT_DRESS_SKUS.includes(product.sku)
    ) {
      return true;
    }
  }

  for (const cat of missingCats) {
    if (categoryMatches(product.category_name, cat)) return true;
  }

  return false;
}
