const normalise = value => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function resolveCurrentFundValue(selectedValue, manualValue, manualToken = "__manual__") {
  return selectedValue === manualToken ? String(manualValue ?? "").trim() : String(selectedValue ?? "").trim();
}

export function findCurrentProduct(products, query) {
  const wanted = normalise(query);
  if (!wanted) return { status: "empty", product: null, candidates: [] };

  const exactDisplay = products.filter(product => normalise(product.lifecycleStageName ? `${product.productName} — ${product.lifecycleStageName}` : product.productName) === wanted);
  if (exactDisplay.length === 1) return { status: "matched", product: exactDisplay[0], candidates: exactDisplay };

  const exactProduct = products.filter(product => normalise(product.productName) === wanted);
  if (exactProduct.length === 1) return { status: "matched", product: exactProduct[0], candidates: exactProduct };
  if (exactProduct.length > 1) return { status: "ambiguous", product: null, candidates: exactProduct };

  const exactFund = products.filter(product => normalise(product.rseName) === wanted);
  if (exactFund.length === 1) return { status: "matched", product: exactFund[0], candidates: exactFund };
  if (exactFund.length > 1) return { status: "ambiguous", product: null, candidates: exactFund };

  return { status: "unmapped", product: null, candidates: [] };
}

export function buildComparison(products, scoredProducts, query, limit = 3) {
  const match = findCurrentProduct(products, query);
  if (match.status !== "matched") return { ...match, shortlist: scoredProducts.slice(0, limit) };
  const current = scoredProducts.find(product => product.productId === match.product.productId && product.lifecycleStageName === match.product.lifecycleStageName)
    ?? scoredProducts.find(product => product.productId === match.product.productId)
    ?? null;
  const shortlist = scoredProducts.filter(product => !current || product.productId !== current.productId || product.lifecycleStageName !== current.lifecycleStageName).slice(0, limit);
  return { ...match, current, shortlist };
}
