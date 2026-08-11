import assert from "node:assert/strict";
import { scoreProducts, WEIGHTS } from "../src/score.js";

const product=(name,growth,fee,ret,result="Pass",measure=.2)=>({productName:name,growthAllocationPct:growth,fees:{"50k":{totalPct:fee}},returns:{"10y":{netReturn50kPct:ret}},performanceTestResult:result,performanceTestMeasurePct:measure});
const criteria={growthMin:70,growthMax:90,balance:"50k",horizon:"10y"};
const scored=scoreProducts([product("A",80,.5,8),product("B",60,1,6,"Fail")],criteria);

assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
assert.equal(scored[0].productName,"A");
assert.equal(scored[0].scoreBreakdown.growthFit,35);
assert.equal(scored[0].scoreBreakdown.performanceTest,10);
assert.equal(scored[1].scoreBreakdown.performanceTest,0);
assert.ok(scored.every(item=>item.matchScore>=0&&item.matchScore<=100));
assert.equal(scoreProducts([product("Missing",80,null,8)],criteria).length,0);
console.log("Research Match Score contract tests passed");
