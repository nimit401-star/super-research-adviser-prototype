export const WEIGHTS = Object.freeze({ growthFit: 35, feeEfficiency: 25, netReturn: 25, performanceTest: 10, completeness: 5 });

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const present = value => typeof value === "number" && Number.isFinite(value);
const FEE_BALANCES = Object.freeze([[10000,"10k"],[25000,"25k"],[50000,"50k"],[100000,"100k"],[250000,"250k"]]);

const feeDollarsAt = (product, amount, key) => {
  const rate = product.fees?.[key]?.totalPct;
  return present(rate) ? amount * rate / 100 : null;
};

export function calculateFee(product, requestedAmount) {
  const amount = clamp(Number(requestedAmount), 10000, 250000);
  const exact = FEE_BALANCES.find(([value]) => value === amount);
  if (exact) {
    const annualFee = feeDollarsAt(product, amount, exact[1]);
    return present(annualFee) ? {amount,annualFee,effectivePct:annualFee/amount*100,estimated:false,lowerAmount:amount,upperAmount:amount} : null;
  }
  const upperIndex = FEE_BALANCES.findIndex(([value]) => value > amount);
  const [lowerAmount,lowerKey] = FEE_BALANCES[upperIndex-1];
  const [upperAmount,upperKey] = FEE_BALANCES[upperIndex];
  const lowerFee = feeDollarsAt(product,lowerAmount,lowerKey);
  const upperFee = feeDollarsAt(product,upperAmount,upperKey);
  if (!present(lowerFee) || !present(upperFee)) return null;
  const annualFee = lowerFee + (upperFee-lowerFee) * (amount-lowerAmount) / (upperAmount-lowerAmount);
  return {amount,annualFee,effectivePct:annualFee/amount*100,estimated:true,lowerAmount,upperAmount};
}

export function percentile(value, sortedValues, lowerIsBetter = false) {
  if (!present(value) || !sortedValues.length) return 0;
  if (sortedValues.length === 1) return 1;
  const below = sortedValues.filter(item => item < value).length;
  const equal = sortedValues.filter(item => item === value).length;
  const rank = (below + (equal - 1) / 2) / (sortedValues.length - 1);
  return lowerIsBetter ? 1 - rank : rank;
}

export function scoreProducts(products, criteria) {
  const amount = Number(criteria.amount ?? String(criteria.balance ?? "50k").replace("k","000"));
  const candidates = products.map(product => ({product,fee:calculateFee(product,amount)})).filter(({product,fee}) =>
    present(product.growthAllocationPct) && fee && present(product.returns?.[criteria.horizon]?.netReturn50kPct)
  );
  const fees = candidates.map(({fee}) => fee.effectivePct).sort((a,b) => a-b);
  const returns = candidates.map(({product}) => product.returns[criteria.horizon].netReturn50kPct).sort((a,b) => a-b);

  return candidates.map(({product,fee}) => {
    const growth = product.growthAllocationPct;
    const distance = growth < criteria.growthMin ? criteria.growthMin-growth : growth > criteria.growthMax ? growth-criteria.growthMax : 0;
    const fields = [growth, fee.effectivePct, product.returns[criteria.horizon].netReturn50kPct, product.performanceTestResult, product.performanceTestMeasurePct];
    const parts = {
      growthFit: clamp(WEIGHTS.growthFit - distance * 1.75, 0, WEIGHTS.growthFit),
      feeEfficiency: percentile(fee.effectivePct, fees, true) * WEIGHTS.feeEfficiency,
      netReturn: percentile(product.returns[criteria.horizon].netReturn50kPct, returns) * WEIGHTS.netReturn,
      performanceTest: product.performanceTestResult === "Pass" ? 10 : product.performanceTestResult === "Fail" ? 0 : 5,
      completeness: fields.filter(value => value !== null && value !== undefined).length / fields.length * WEIGHTS.completeness
    };
    Object.keys(parts).forEach(key => parts[key] = Math.round(parts[key] * 10) / 10);
    return { ...product, comparisonFee:fee, peerCount:candidates.length, matchScore: Math.round(Object.values(parts).reduce((sum,value)=>sum+value,0)), scoreBreakdown: parts };
  }).sort((a,b) => b.matchScore-a.matchScore || a.productName.localeCompare(b.productName));
}
