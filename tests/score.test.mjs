import assert from "node:assert/strict";
import { calculateFee, scoreProducts, WEIGHTS } from "../src/score.js";
import { findDisclosureLinks, findPdsLink, VERIFIED_DISCLOSURE_LINKS, VERIFIED_PDS_LINKS } from "../src/pds.js";

const product=(name,growth,fee,ret,result="Pass",measure=.2)=>({productName:name,growthAllocationPct:growth,fees:{"10k":{totalPct:fee},"25k":{totalPct:fee},"50k":{totalPct:fee},"100k":{totalPct:fee},"250k":{totalPct:fee}},returns:{"10y":{netReturn50kPct:ret}},performanceTestResult:result,performanceTestMeasurePct:measure});
const criteria={growthMin:70,growthMax:90,amount:50000,horizon:"10y"};
const scored=scoreProducts([product("A",80,.5,8),product("B",60,1,6,"Fail")],criteria);

assert.equal(Object.values(WEIGHTS).reduce((a,b)=>a+b,0),100);
assert.equal(scored[0].productName,"A");
assert.equal(scored[0].scoreBreakdown.growthFit,35);
assert.equal(scored[0].scoreBreakdown.performanceTest,10);
assert.equal(scored[1].scoreBreakdown.performanceTest,0);
assert.ok(scored.every(item=>item.matchScore>=0&&item.matchScore<=100));
assert.equal(scoreProducts([product("Missing",80,null,8)],criteria).length,0);
assert.equal(calculateFee(product("Fee",80,1,8),50000).annualFee,500);
assert.equal(calculateFee(product("Fee",80,1,8),75000).annualFee,750);
assert.equal(calculateFee(product("Fee",80,1,8),75000).estimated,true);
assert.equal(findPdsLink({rseName:"Mercer Super Trust",productName:"Virgin Money MySuper"}).url.includes("virginmoney.com.au"),true);
assert.equal(findPdsLink({rseName:"Mercer Super Trust",productName:"Another Mercer product"}).url.includes("mercersuper.com.au"),true);
assert.equal(findPdsLink({rseName:"Unmapped fund",productName:"MySuper"}),null);
assert.equal(findDisclosureLinks({rseName:"Australian Retirement Trust",productName:"Choice"}).documents[0].type.includes("TMD"),true);
assert.equal(findDisclosureLinks({rseName:"Unmapped fund",productName:"Choice"}),null);
assert.ok(VERIFIED_DISCLOSURE_LINKS.every(link=>link.documents.length>0&&link.documents.every(document=>/^https:\/\//.test(document.url))));
assert.ok(VERIFIED_PDS_LINKS.every(link=>/^https:\/\//.test(link.url)&&/^\d{4}-\d{2}-\d{2}$/.test(link.verifiedAt)));
console.log("Research Match Score contract tests passed");
