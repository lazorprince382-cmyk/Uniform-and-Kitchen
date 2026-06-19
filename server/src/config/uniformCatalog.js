/** Standard sizes for school uniforms */
export const STANDARD_SIZES = ['4', '6', '8', '10', '12', '14', '16', '18', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];

/** Canonical uniform catalog for The Ocean of Knowledge School */
export const CATEGORIES = [
  { name: 'Uniform Store', description: 'Main school uniform', color_code: '#152a5e' },
  { name: 'Sports Wear', description: 'PE and sports kit', color_code: '#c41e3a' },
  { name: 'Track Suits', description: 'Track suits', color_code: '#1e4080' },
  { name: 'Socks', description: 'School socks', color_code: '#9e1830' },
  { name: 'Sweaters', description: 'School sweaters and jumpers', color_code: '#152a5e' },
];

export const PRODUCTS = [
  {
    name: 'White Shirts',
    sku: 'US-WSH',
    category: 'Uniform Store',
    gender: 'unisex',
    price: 45000,
    stock: 0,
    min: 30,
    core: true,
  },
  {
    name: 'Beige Skirts',
    sku: 'US-BSK',
    category: 'Uniform Store',
    gender: 'girl',
    price: 52000,
    stock: 0,
    min: 25,
    core: true,
    image: '/images/products/beige-skirts.png',
  },
  {
    name: 'Dresses',
    sku: 'US-DRS',
    category: 'Uniform Store',
    gender: 'girl',
    price: 68000,
    stock: 0,
    min: 20,
    core: true,
  },
  {
    name: 'Beige Shorts',
    sku: 'US-SHT',
    category: 'Uniform Store',
    gender: 'boy',
    price: 38000,
    stock: 0,
    min: 25,
    core: true,
    image: '/images/products/beige-shorts.png',
  },
  {
    name: 'White Shirts',
    sku: 'SP-WSH',
    category: 'Sports Wear',
    gender: 'unisex',
    price: 38000,
    stock: 0,
    min: 20,
    core: false,
  },
  {
    name: 'Yellow Shirts',
    sku: 'SP-YSH',
    category: 'Sports Wear',
    gender: 'unisex',
    price: 38000,
    stock: 0,
    min: 20,
    core: false,
  },
  {
    name: 'White T-Shirts',
    sku: 'SP-WTS',
    category: 'Sports Wear',
    gender: 'unisex',
    price: 32000,
    stock: 0,
    min: 20,
    core: false,
  },
  {
    name: 'Maroon Track Suit',
    sku: 'TR-MRN',
    category: 'Track Suits',
    gender: 'unisex',
    price: 85000,
    stock: 0,
    min: 15,
    core: false,
  },
  {
    name: 'Black Track Suit',
    sku: 'TR-BLK',
    category: 'Track Suits',
    gender: 'unisex',
    price: 85000,
    stock: 0,
    min: 15,
    core: false,
  },
  {
    name: 'Coffee Brown Socks',
    sku: 'SK-CBR',
    category: 'Socks',
    gender: 'unisex',
    price: 8000,
    stock: 0,
    min: 50,
    core: true,
  },
  {
    name: 'Navy Blue Socks',
    sku: 'SK-NVY',
    category: 'Socks',
    gender: 'unisex',
    price: 8000,
    stock: 0,
    min: 50,
    core: true,
  },
  {
    name: 'White Socks',
    sku: 'SK-WHT',
    category: 'Socks',
    gender: 'unisex',
    price: 7500,
    stock: 0,
    min: 50,
    core: true,
  },
  {
    name: 'Navy Sweater',
    sku: 'SW-NVY',
    category: 'Sweaters',
    gender: 'unisex',
    price: 65000,
    stock: 0,
    min: 15,
    core: false,
  },
  {
    name: 'Maroon Sweater',
    sku: 'SW-MRN',
    category: 'Sweaters',
    gender: 'unisex',
    price: 65000,
    stock: 0,
    min: 15,
    core: false,
  },
  {
    name: 'Grey Sweater',
    sku: 'SW-GRY',
    category: 'Sweaters',
    gender: 'unisex',
    price: 62000,
    stock: 0,
    min: 15,
    core: false,
  },
];

/** Full uniform = each type below, with Uniform Store rules by gender (boy/girl). */
export const FULL_UNIFORM_CATEGORIES = [
  'Uniform Store',
  'Sports Wear',
  'Track Suits',
  'Sweaters',
  'Socks',
];

export const PRODUCT_GENDER_BY_SKU = Object.fromEntries(
  PRODUCTS.map((p) => [p.sku, p.gender || 'unisex'])
);

const OTHER_CATEGORIES = ['Sports Wear', 'Track Suits', 'Sweaters', 'Socks'];

export function normalizeGender(value) {
  if (!value) return null;
  const g = String(value).toLowerCase().trim();
  if (['boy', 'male', 'm', 'b'].includes(g)) return 'boy';
  if (['girl', 'female', 'f', 'g'].includes(g)) return 'girl';
  return null;
}

/** Whether a catalog/DB product applies to this child's gender. */
export function productMatchesGender(product, gender) {
  const g = normalizeGender(gender);
  const pg = product.gender || PRODUCT_GENDER_BY_SKU[product.sku] || 'unisex';
  if (!g) return true;
  if (pg === 'unisex') return true;
  return pg === g;
}

/**
 * Evaluate full/partial uniform for one student.
 * @param {{ gender?: string, receivedItems: Array<{ sku, category_name, product_name, product_id? }> }}
 */
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

  // —— Uniform Store (gender-specific items) ——
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

  // —— Other types: any one item in that category ——
  for (const cat of OTHER_CATEGORIES) {
    if (!receivedByCategory[cat] || receivedByCategory[cat].size === 0) {
      missingCategories.push(cat);
    }
  }

  const uniformStoreOk =
    g &&
    itemsStillNeeded.filter((i) => i.category === 'Uniform Store').length === 0;
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

  const missingDisplay = [
    ...itemsStillNeeded.map((i) => i.label),
    ...missingCategories,
  ];

  let stepsDone = 0;
  const stepsTotal = FULL_UNIFORM_CATEGORIES.length;
  if (uniformStoreOk) stepsDone += 1;
  for (const cat of OTHER_CATEGORIES) {
    if (receivedByCategory[cat]?.size) stepsDone += 1;
  }

  return {
    status,
    label,
    gender: g,
    itemsStillNeeded,
    missingCategories,
    missing_core_items: missingDisplay,
    coreReceived: stepsDone,
    coreTotal: stepsTotal,
  };
}

/** @deprecated */
export function computeUniformStatus(receivedCategoryNames) {
  return evaluateStudentUniform({
    gender: 'boy',
    receivedItems: (receivedCategoryNames || []).map((c) => ({
      sku: 'legacy',
      category_name: c,
      product_name: c,
    })),
  });
}
