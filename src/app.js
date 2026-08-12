import { scoreProducts } from "./score.js";
import { findPdsLink } from "./pds.js";
import { calculateClientContext } from "./client-context.js";
import { buildComparison, resolveCurrentFundValue } from "./current-comparison.js";

const cards = document.querySelector("#result-cards");
const form = document.querySelector("#research-form");
const title = document.querySelector("#results-title");
const context = document.querySelector("#results-context");
const showMore = document.querySelector("#show-more");
const clientSummary = document.querySelector("#client-summary");
const contributionPreview = document.querySelector("#contribution-preview");
const comparisonPanel = document.querySelector("#current-comparison");
const currentFundSelect = document.querySelector("#current-fund");
const currentFundSearch = document.querySelector("#current-fund-search");
const currentFundToggle = document.querySelector("#current-fund-toggle");
const currentFundPanel = document.querySelector("#current-fund-options");
const currentFundList = document.querySelector("#current-fund-list");
const currentFundStatus = document.querySelector("#current-fund-status");
const manualCurrentFundField = document.querySelector("#manual-current-fund-field");
const manualCurrentFundInput = document.querySelector("#manual-current-fund");
const MANUAL_CURRENT_FUND = "__manual__";
let products = [], visible = 6, current = [], currentProductOptions = [];

const pct = value => value == null ? "—" : `${value.toFixed(2).replace(/\.00$/,"")}%`;
const aud = value => value == null ? "—" : new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:2}).format(value);
const number = value => new Intl.NumberFormat("en-AU").format(value);
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const label = key => ({growthFit:"Growth fit",feeEfficiency:"Fee efficiency",netReturn:"Net return",performanceTest:"APRA test",completeness:"Data completeness"}[key]);

function clientInputs() {
  return {
    employmentStatus:document.querySelector("#employment-status").value,
    currentFund:resolveCurrentFundValue(currentFundSelect.value, manualCurrentFundInput.value, MANUAL_CURRENT_FUND),
    age:Number(document.querySelector("#client-age").value),
    retirementAge:Number(document.querySelector("#retirement-age").value),
    superableEarnings:Number(document.querySelector("#salary").value),
    sgRate:Number(document.querySelector("#sg-rate").value),
    salarySacrifice:Number(document.querySelector("#salary-sacrifice").value),
    personalConcessional:Number(document.querySelector("#personal-concessional").value)
  };
}

function updateContributionPreview() {
  const client=calculateClientContext(clientInputs());
  document.querySelector("#contribution-fields").hidden=!client.isWorking;
  contributionPreview.innerHTML=client.isWorking
    ? `<span>Employer SG <strong>${aud(client.employerSg)}</strong></span><span>Total concessional <strong>${aud(client.totalConcessional)}</strong></span><span>Years to retirement <strong>${client.yearsToRetirement}</strong></span><span class="${client.capStatus==="over"?"cap-warning":""}">${escapeHtml(client.capMessage)}</span>`
    : `<span>No employer SG modelled for this employment status.</span><span>Years to retirement <strong>${client.yearsToRetirement}</strong></span>`;
  return client;
}

function criteria() {
  const [growthMin,growthMax] = new FormData(form).get("growth").split(",").map(Number);
  return { growthMin, growthMax, amount:Number(document.querySelector("#balance").value), horizon:document.querySelector("#horizon").value };
}

function explanations(product, selected) {
  const b=product.scoreBreakdown, fee=product.comparisonFee, ret=product.returns[selected.horizon].netReturn50kPct;
  const distance=product.growthAllocationPct<selected.growthMin?selected.growthMin-product.growthAllocationPct:product.growthAllocationPct>selected.growthMax?product.growthAllocationPct-selected.growthMax:0;
  const feeMethod=fee.estimated?`Estimated between APRA's $${number(fee.lowerAmount)} and $${number(fee.upperAmount)} published balance points.`:"Uses APRA's published balance point.";
  const rows=[
    ["Growth fit",b.growthFit,35,distance===0?`${pct(product.growthAllocationPct)} is inside the selected ${selected.growthMin}–${selected.growthMax}% range.`:`${pct(product.growthAllocationPct)} is ${distance.toFixed(1)} percentage points outside the selected range; 1.75 points are deducted per point outside.`],
    ["Fee efficiency",b.feeEfficiency,25,`${pct(fee.effectivePct)} effective annual fee is ranked against ${product.peerCount} comparable products; lower fees earn more points.`],
    ["Net return",b.netReturn,25,`${pct(ret)} ${selected.horizon.replace("y","-year")} annualised net return is ranked against ${product.peerCount} comparable products; higher returns earn more points.`],
    ["APRA test",b.performanceTest,10,product.performanceTestResult==="Pass"?"APRA result is Pass, so all 10 points are awarded.":product.performanceTestResult==="Fail"?"APRA result is Fail, so 0 points are awarded.":"This stage was not assessed, so a neutral 5 points are used."],
    ["Data completeness",b.completeness,5,b.completeness===5?"All five fields used by the model are present.":`${b.completeness} of 5 points based on fields available to the model.`]
  ];
  return `<div class="fee-detail"><h4>Estimated annual fees at ${aud(fee.amount)}</h4><div class="fee-total"><strong>${aud(fee.annualFee)}</strong><span>${pct(fee.effectivePct)} of comparison amount</span></div><p><code>${aud(fee.amount)} × ${pct(fee.effectivePct)} = ${aud(fee.annualFee)} per year</code></p><small>${feeMethod} APRA reports total fees and costs; the source does not provide every underlying fee component in this prototype.</small></div><div class="score-detail"><h4>How each score was calculated</h4>${rows.map(([name,value,max,why])=>`<div class="score-row"><div><strong>${name}</strong><span>${escapeHtml(why)}</span></div><b>${value}<small> / ${max}</small></b></div>`).join("")}</div>`;
}

function renderCard(product, selected) {
  const stage = product.lifecycleStageName ? ` · ${product.lifecycleStageName}` : "";
  const flag = product.performanceTestResult == null ? '<span class="flag">APRA test not assessed for this stage</span>' : "";
  const pds = findPdsLink(product);
  const pdsAction = pds
    ? `<div class="pds-action"><a href="${escapeHtml(pds.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(pds.label)} <span aria-hidden="true">↗</span></a><small>Official fund website · Link verified ${escapeHtml(pds.verifiedAt)}</small></div>`
    : '<div class="pds-action unavailable"><span>PDS link not yet verified</span><small>Confirm the current document on the fund’s official website.</small></div>';
  return `<article class="card">
    <div class="card-top"><div><h3>${escapeHtml(product.productName)}${escapeHtml(stage)}</h3><p class="fund">${escapeHtml(product.rseName)}</p></div><div class="score" style="--score:${product.matchScore}"><span>${product.matchScore}<small>/100</small></span></div></div>
    <div class="metrics"><div class="metric"><strong>${pct(product.growthAllocationPct)}</strong><span>Growth assets</span></div><div class="metric"><strong>${aud(product.comparisonFee.annualFee)}</strong><span>Est. annual fee · ${pct(product.comparisonFee.effectivePct)}</span></div><div class="metric"><strong>${pct(product.returns[selected.horizon].netReturn50kPct)}</strong><span>Net return · ${selected.horizon}</span></div></div>
    <details class="breakdown"><summary>View fee calculation and score explanation</summary>${explanations(product,selected)}</details>${pdsAction}${flag}
  </article>`;
}

function comparisonColumn(product, selected, heading) {
  return `<article class="comparison-column"><small>${escapeHtml(heading)}</small><h3>${escapeHtml(product.productName)}</h3><p>${escapeHtml(product.rseName)}</p><dl><div><dt>Research score</dt><dd>${product.matchScore}/100</dd></div><div><dt>Growth assets</dt><dd>${pct(product.growthAllocationPct)}</dd></div><div><dt>Annual fee</dt><dd>${aud(product.comparisonFee.annualFee)}</dd></div><div><dt>${selected.horizon.replace("y","-year")} net return</dt><dd>${pct(product.returns[selected.horizon].netReturn50kPct)}</dd></div><div><dt>APRA test</dt><dd>${escapeHtml(product.performanceTestResult ?? "Not assessed")}</dd></div></dl></article>`;
}

function renderCurrentComparison(client, selected) {
  if (!client.currentFund) { comparisonPanel.hidden=true; comparisonPanel.innerHTML=""; return; }
  const comparison=buildComparison(products,current,client.currentFund);
  comparisonPanel.hidden=false;
  if (comparison.status==="unmapped") {
    comparisonPanel.innerHTML=`<div class="comparison-message"><strong>Current position not mapped</strong><span>“${escapeHtml(client.currentFund)}” was not found in the current MySuper dataset. Keep it as an adviser review item; broader Choice and fund-issued data is being added separately.</span></div>`;
    return;
  }
  if (comparison.status==="ambiguous") {
    comparisonPanel.innerHTML=`<div class="comparison-message"><strong>Select the specific current product or lifecycle stage</strong><span>${comparison.candidates.length} APRA rows match “${escapeHtml(client.currentFund)}”. Enter the exact product and stage before relying on a comparison.</span></div>`;
    return;
  }
  if (!comparison.current) {
    comparisonPanel.innerHTML=`<div class="comparison-message"><strong>Current product is not comparable under these criteria</strong><span>The product was found, but one or more fee, growth or ${escapeHtml(selected.horizon)} return fields needed by this model are unavailable.</span></div>`;
    return;
  }
  comparisonPanel.innerHTML=`<div class="comparison-heading"><div><p class="eyebrow">Stay versus shortlist</p><h2>Compare the current position with leading research matches</h2></div><span>Same balance, return period and scoring rules</span></div><div class="comparison-grid">${comparisonColumn(comparison.current,selected,"Current position")}${comparison.shortlist.map((product,index)=>comparisonColumn(product,selected,`Research match ${index+1}`)).join("")}</div><p class="comparison-note">This is a like-for-like APRA data comparison only. Insurance, eligibility, investment-option features, tax and switching consequences still require adviser review.</p>`;
}

function productDisplayValue(product) {
  return product.lifecycleStageName ? `${product.productName} — ${product.lifecycleStageName}` : product.productName;
}

function closeCurrentFundOptions() {
  currentFundPanel.hidden=true;
  currentFundSearch.setAttribute("aria-expanded","false");
}

function chooseCurrentFund(value, displayText=value) {
  currentFundSelect.value=value;
  currentFundSearch.value=displayText;
  closeCurrentFundOptions();
  updateCurrentFundMode();
  updateContributionPreview();
}

function renderCurrentProductOptions(query="") {
  const wanted=query.trim().toLowerCase();
  const matches=currentProductOptions.filter(option =>
    !wanted || option.searchText.includes(wanted)
  );
  const visibleMatches=matches.slice(0,80);
  currentFundList.innerHTML="";
  let activeFund="";
  visibleMatches.forEach(option=>{
    if(option.fundName!==activeFund) {
      activeFund=option.fundName;
      const heading=document.createElement("div");
      heading.className="combobox-group";
      heading.textContent=activeFund;
      currentFundList.append(heading);
    }
    const button=document.createElement("button");
    button.type="button";
    button.className="combobox-option";
    button.setAttribute("role","option");
    button.dataset.value=option.value;
    button.innerHTML=`<strong>${escapeHtml(option.productName)}</strong>${option.stageName?`<span>${escapeHtml(option.stageName)}</span>`:""}`;
    button.addEventListener("click",()=>chooseCurrentFund(option.value,option.value));
    currentFundList.append(button);
  });
  const manual=document.createElement("button");
  manual.type="button";
  manual.className="combobox-option manual-option";
  manual.setAttribute("role","option");
  manual.innerHTML="<strong>Fund/product not listed</strong><span>Enter the current product manually</span>";
  manual.addEventListener("click",()=>chooseCurrentFund(MANUAL_CURRENT_FUND,"Fund/product not listed — enter manually"));
  currentFundList.append(manual);
  currentFundStatus.textContent=matches.length>80
    ? `Showing 80 of ${matches.length} matches — type more to narrow the list`
    : `${matches.length} matching product${matches.length===1?"":"s"}`;
  currentFundPanel.hidden=false;
  currentFundSearch.setAttribute("aria-expanded","true");
}

function populateCurrentProductOptions() {
  const unique=new Map();
  [...products].sort((a,b)=>a.rseName.localeCompare(b.rseName)||a.productName.localeCompare(b.productName)||(a.lifecycleStageName??"").localeCompare(b.lifecycleStageName??"")).forEach(product=>{
    const value=productDisplayValue(product);
    const key=`${product.rseName}|${value}`;
    if(!unique.has(key)) unique.set(key,{
      value,
      productName:product.productName,
      stageName:product.lifecycleStageName??"",
      fundName:product.rseName,
      searchText:`${product.rseName} ${product.productName} ${product.lifecycleStageName??""}`.toLowerCase()
    });
  });
  currentProductOptions=[...unique.values()];
}

function updateCurrentFundMode() {
  const isManual=currentFundSelect.value===MANUAL_CURRENT_FUND;
  manualCurrentFundField.hidden=!isManual;
  manualCurrentFundInput.required=isManual;
  if(!isManual) manualCurrentFundInput.value="";
}

function render(reset=true) {
  if (reset) visible=6;
  const selected=criteria(), client=updateContributionPreview(); current=scoreProducts(products,selected);
  title.textContent=`${current.length} comparable products`;
  context.textContent=`Ranked for ${selected.growthMin}–${selected.growthMax}% growth, ${aud(selected.amount)} comparison amount and ${selected.horizon.replace("y","-year")} net return. Showing research matches, not recommendations.`;
  const currentFund=client.currentFund?`Current position: <strong>${escapeHtml(client.currentFund)}</strong>`:"Current fund not entered";
  clientSummary.innerHTML=`<span>${currentFund}</span><span>Age <strong>${client.age}</strong> · retirement in <strong>${client.yearsToRetirement} years</strong></span>${client.isWorking?`<span>First-year employer SG <strong>${aud(client.employerSg)}</strong></span><span>Total concessional <strong>${aud(client.totalConcessional)}</strong></span>`:""}`;
  renderCurrentComparison(client,selected);
  cards.innerHTML=current.slice(0,visible).map(product=>renderCard(product,selected)).join("");
  showMore.hidden=visible>=current.length;
}

currentFundSearch.addEventListener("focus",()=>renderCurrentProductOptions(currentFundSearch.value));
currentFundSearch.addEventListener("input",()=>{
  currentFundSelect.value="";
  updateCurrentFundMode();
  renderCurrentProductOptions(currentFundSearch.value);
});
currentFundSearch.addEventListener("keydown",event=>{
  if(event.key==="Escape") closeCurrentFundOptions();
  if(event.key==="Enter" && !currentFundPanel.hidden) {
    event.preventDefault();
    currentFundList.querySelector(".combobox-option")?.click();
  }
});
currentFundToggle.addEventListener("click",()=>{
  if(currentFundPanel.hidden) {
    currentFundSearch.focus();
    renderCurrentProductOptions(currentFundSearch.value);
  } else closeCurrentFundOptions();
});
document.addEventListener("click",event=>{
  if(!document.querySelector("#current-fund-combobox").contains(event.target)) closeCurrentFundOptions();
});
form.addEventListener("input", updateContributionPreview);
updateContributionPreview();
form.addEventListener("submit", event => { event.preventDefault(); render(); document.querySelector("#results").scrollIntoView({behavior:"smooth"}); });
showMore.addEventListener("click",()=>{visible+=6;render(false)});

try {
  const [productResponse,metadataResponse]=await Promise.all([fetch("public/data/products.json"),fetch("public/data/metadata.json")]);
  if(!productResponse.ok||!metadataResponse.ok) throw new Error("Research data could not be loaded.");
  products=await productResponse.json(); const metadata=await metadataResponse.json();
  populateCurrentProductOptions();
  updateCurrentFundMode();
  document.querySelector("#reporting-date").textContent=`Reporting date ${metadata.reportingDate}`; render();
} catch(error) { title.textContent="Data unavailable"; cards.innerHTML=`<p class="error">${escapeHtml(error.message)} Please refresh or try again later.</p>`; }
