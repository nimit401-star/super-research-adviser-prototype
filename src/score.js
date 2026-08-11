export const WEIGHTS = Object.freeze({ growthFit: 35, feeEfficiency: 25, netReturn: 25, performanceTest: 10, completeness: 5 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const present = value => typeof value === "number" && Number.isFinite(value);

export function percentile(value, sortedValues, lowerIsBetter = false) {
  if (!present(value) || !sortedValues.length) return 0;
  if (sortedValues.length === 1) return 1;
  const below = sortedValues.filter(item => item < value).length;
  const equal = sortedValues.filter(item => item === value).length;
  const rank = (below + (equal - 1) / 2) / (sortedValues.length - 1);
  return lowerIsBetter ? 1 - rank : rank;
}

export function scoreProducts(products, criteria) {
  const candidates = products.filter(product =>
    present(product.growthAllocationPct) &&
    present(product.fees?.[criteria.balance]?.totalPct) &&
    present(product.returns?.[criteria.horizon]?.netReturn50kPct)
  );
  const fees = candidates.map(p => p.fees[criteria.balance].totalPct).sort((a,b) => a-b);
  const returns = candidates.map(p => p.returns[criteria.horizon].netReturn50kPct).sort((a,b) => a-b);

  return candidates.map(product => {
    const growth = product.growthAllocationPct;
    const distance = growth < criteria.growthMin ? criteria.growthMin-growth : growth > criteria.growthMax ? growth-criteria.growthMax : 0;
    const fields = [growth, product.fees[criteria.balance].totalPct, product.returns[criteria.horizon].netReturn50kPct, product.performanceTestResult, product.performanceTestMeasurePct];
    const parts = {
      growthFit: clamp(WEIGHTS.growthFit - distance * 1.75, 0, WEIGHTS.growthFit),
      feeEfficiency: percentile(product.fees[criteria.balance].totalPct, fees, true) * WEIGHTS.feeEfficiency,
      netReturn: percentile(product.returns[criteria.horizon].netReturn50kPct, returns) * WEIGHTS.netReturn,
      performanceTest: product.performanceTestResult === "Pass" ? 10 : product.performanceTestResult === "Fail" ? 0 : 5,
      completeness: fields.filter(value => value !== null && value !== undefined).length / fields.length * WEIGHTS.completeness
    };
    Object.keys(parts).forEach(key => parts[key] = Math.round(parts[key] * 10) / 10);
    return { ...product, matchScore: Math.round(Object.values(parts).reduce((sum,value)=>sum+value,0)), scoreBreakdown: parts };
  }).sort((a,b) => b.matchScore-a.matchScore || a.productName.localeCompare(b.productName));
}
