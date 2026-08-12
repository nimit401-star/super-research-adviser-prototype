import assert from "node:assert/strict";
import { findCurrentProduct, buildComparison } from "../src/current-comparison.js";

const products = [
  { productId:"a", productName:"Alpha MySuper", rseName:"Alpha Super", lifecycleStageName:null },
  { productId:"b", productName:"Beta Lifecycle", rseName:"Beta Super", lifecycleStageName:"Age 40" },
  { productId:"b", productName:"Beta Lifecycle", rseName:"Beta Super", lifecycleStageName:"Age 50" },
  { productId:"c", productName:"Gamma MySuper", rseName:"Gamma Super", lifecycleStageName:null }
];
const scored = products.map((product,index)=>({...product,matchScore:90-index}));

assert.equal(findCurrentProduct(products," Alpha MySuper ").status,"matched");
assert.equal(findCurrentProduct(products,"alpha super").product.productId,"a");
assert.equal(findCurrentProduct(products,"Beta Lifecycle").status,"ambiguous");
assert.equal(findCurrentProduct(products,"Beta Lifecycle — Age 40").product.lifecycleStageName,"Age 40");
assert.equal(findCurrentProduct(products,"Unknown Fund").status,"unmapped");
const comparison=buildComparison(products,scored,"Alpha Super",2);
assert.equal(comparison.current.productId,"a");
assert.equal(comparison.shortlist.length,2);
assert.ok(comparison.shortlist.every(product=>product.productId!=="a"));
console.log("Current-position comparison tests passed");
