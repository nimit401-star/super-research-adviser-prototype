const present = value => typeof value === "number" && Number.isFinite(value);
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));

export function calculateChoiceFee(record,requestedBalance) {
  const balance=clamp(Number(requestedBalance),10000,250000);
  const fixed=record?.feeBasis?.fixedAnnualDollars;
  const variable=record?.feeBasis?.variableRateDecimal;
  if(!present(fixed)||!present(variable)||fixed<0||variable<0) return null;
  const annualFee=fixed+balance*variable;
  return {amount:balance,annualFee,effectivePct:annualFee/balance*100,fixedAnnualDollars:fixed,variableRateDecimal:variable};
}

export function percentile(value,values,lowerIsBetter=false) {
  if(!present(value)||!values.length) return 0;
  if(values.length===1) return 1;
  const sorted=[...values].sort((a,b)=>a-b);
  const below=sorted.filter(item=>item<value).length;
  const equal=sorted.filter(item=>item===value).length;
  const rank=(below+(equal-1)/2)/(sorted.length-1);
  return lowerIsBetter?1-rank:rank;
}

function pathwayLabel(record) {
  return [record.rseName,record.productName,record.menuName].filter(Boolean).join(" · ");
}

export function rankChoiceOptions(dataset,{peerGroup,amount,horizon}) {
  if(!dataset?.rankingEnabled||!Array.isArray(dataset.records)) return [];
  if(!["3y","5y"].includes(horizon)) return [];
  const candidates=dataset.records
    .filter(record=>record.peerGroup===peerGroup)
    .map(record=>({record,fee:calculateChoiceFee(record,amount),netReturnPct:record.returns?.[horizon]?.netReturnPct}))
    .filter(item=>item.fee&&present(item.netReturnPct));
  const fees=candidates.map(item=>item.fee.effectivePct);
  const returns=candidates.map(item=>item.netReturnPct);
  const scored=candidates.map(({record,fee,netReturnPct})=>{
    const feeScore=Math.round(percentile(fee.effectivePct,fees,true)*500)/10;
    const returnScore=Math.round(percentile(netReturnPct,returns)*500)/10;
    return {...record,comparisonFee:fee,netReturnPct,peerCount:candidates.length,
      choiceRankScore:Math.round(feeScore+returnScore),
      scoreBreakdown:{feeEfficiency:feeScore,netReturn:returnScore},
      pathwayLabel:pathwayLabel(record)};
  }).sort((a,b)=>b.choiceRankScore-a.choiceRankScore||b.netReturnPct-a.netReturnPct||a.pathwayLabel.localeCompare(b.pathwayLabel));

  const grouped=new Map();
  scored.forEach(record=>{
    const existing=grouped.get(record.optionId);
    if(!existing) grouped.set(record.optionId,{...record,pathways:[record.pathwayLabel]});
    else {
      existing.pathways.push(record.pathwayLabel);
      if(record.choiceRankScore>existing.choiceRankScore) {
        const pathways=existing.pathways;
        grouped.set(record.optionId,{...record,pathways});
      }
    }
  });
  return [...grouped.values()]
    .map(record=>({...record,pathwayCount:record.pathways.length}))
    .sort((a,b)=>b.choiceRankScore-a.choiceRankScore||b.netReturnPct-a.netReturnPct||a.optionName.localeCompare(b.optionName));
}
