import assert from "node:assert/strict";
import { calculateClientContext, CONTRIBUTION_SETTINGS } from "../src/client-context.js";
const employed=calculateClientContext({employmentStatus:"employed",age:40,retirementAge:67,superableEarnings:120000,sgRate:12,salarySacrifice:5000,personalConcessional:1000,currentFund:"Example Super"});
assert.equal(employed.employerSg,14400); assert.equal(employed.totalConcessional,20400); assert.equal(employed.yearsToRetirement,27); assert.equal(employed.currentFund,"Example Super"); assert.equal(employed.capStatus,"within");
const over=calculateClientContext({employmentStatus:"employed",age:50,retirementAge:65,superableEarnings:250000,sgRate:12,salarySacrifice:3000});
assert.equal(over.totalConcessional,33000); assert.equal(over.capStatus,"over");
const retired=calculateClientContext({employmentStatus:"retired",age:70,retirementAge:67,superableEarnings:100000,sgRate:12,salarySacrifice:1000});
assert.equal(retired.employerSg,0); assert.equal(retired.totalConcessional,0); assert.equal(retired.yearsToRetirement,0); assert.equal(CONTRIBUTION_SETTINGS.effectiveFrom,"2026-07-01");
console.log("Client context and SG tests passed");
