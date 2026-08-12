import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source=await readFile(new URL("../src/choice-score.js",import.meta.url),"utf8");
const {calculateChoiceFee,rankChoiceOptions}=await import(`data:text/javascript,${encodeURIComponent(source)}`);

const record=(overrides={})=>({
  productId:"p1",menuId:"m1",optionId:"o1",rseName:"Fund",productName:"Product",
  menuName:"Menu",optionName:"Option",peerGroup:"growth",growthAllocationPct:70,
  returns:{"3y":{netReturnPct:7},"5y":{netReturnPct:6}},
  feeBasis:{fixedAnnualDollars:20,variableRateDecimal:.002},...overrides
});

test("Choice fee uses fixed and percentage components at selected balance",()=>{
  assert.deepEqual(calculateChoiceFee(record(),100000),{
    amount:100000,annualFee:220,effectivePct:.22,fixedAnnualDollars:20,variableRateDecimal:.002
  });
});

test("ranking stays inside one peer group and requires a supported period",()=>{
  const dataset={rankingEnabled:true,records:[record(),record({optionId:"o2",peerGroup:"balanced"})]};
  assert.equal(rankChoiceOptions(dataset,{peerGroup:"growth",amount:50000,horizon:"3y"}).length,1);
  assert.equal(rankChoiceOptions(dataset,{peerGroup:"growth",amount:50000,horizon:"10y"}).length,0);
});

test("shared option pathways render once and retain every pathway",()=>{
  const dataset={rankingEnabled:true,records:[
    record(),record({productId:"p2",menuId:"m2",productName:"Product 2",menuName:"Menu 2"})
  ]};
  const ranked=rankChoiceOptions(dataset,{peerGroup:"growth",amount:50000,horizon:"5y"});
  assert.equal(ranked.length,1);
  assert.equal(ranked[0].pathwayCount,2);
  assert.equal(ranked[0].pathways.length,2);
});
