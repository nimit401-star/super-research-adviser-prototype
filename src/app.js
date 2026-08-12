import { scoreProducts } from "./score.js";
import { findPdsLink } from "./pds.js";
import { calculateClientContext } from "./client-context.js";
import { buildComparison, resolveCurrentFundValue } from "./current-comparison.js";
import { rankChoiceOptions } from "./choice-score.js";

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
const choiceCards = document.querySelector("#choice-cards");
const choiceContext = document.querySelector("#choice-context");
const showMoreChoice = document.querySelector("#show-more-choice");
let products = [], directoryProducts = [], choiceDataset = null, visible = 6, choiceVisible = 6, current = [], currentChoice = [], currentProductOptions = [];

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
  return { growthMin, growthMax, choicePeerGroup:document.querySelector("#choice-peer-group").value, amount:Number(document.querySelector("#balance").value), horizon:document.querySelector("#horizon").value };
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

function renderChoiceCard(option,selected) {
  const otherPathways=option.pathwayCount>1
    ? `<span class="pathway-note">Also reported through ${option.pathwayCount-1} other product/menu pathway${option.pathwayCount===2?"":"s"}; expand for details.</span>`
    : "";
  return `<article class="card choice-card">
    <div class="card-top"><div><span class="product-type">Choice · ${escapeHtml(option.peerGroup.replaceAll("-"," "))}</span><h3>${escapeHtml(option.optionName)}</h3><p class="fund">${escapeHtml(option.productName)} · ${escapeHtml(option.rseName)}</p></div><div class="score choice-score" style="--score:${option.choiceRankScore}"><span>${option.choiceRankScore}<small>/100</small></span></div></div>
    <p class="pathway">${escapeHtml(option.menuName)}${otherPathways}</p>
    <div class="metrics"><div class="metric"><strong>${pct(option.growthAllocationPct)}</strong><span>Growth assets</span></div><div class="metric"><strong>${aud(option.comparisonFee.annualFee)}</strong><span>Annual fee · ${pct(option.comparisonFee.effectivePct)}</span></div><div class="metric"><strong>${pct(option.netReturnPct)}</strong><span>Net return · ${selected.horizon}</span></div></div>
    <details class="breakdown"><summary>View Choice rank and pathways</summary><div class="score-detail"><h4>Choice peer rank</h4><div class="score-row"><div><strong>Fee efficiency</strong><span>Lower balance-adjusted fee within this ${escapeHtml(option.peerGroup)} peer group.</span></div><b>${option.scoreBreakdown.feeEfficiency}<small> / 50</small></b></div><div class="score-row"><div><strong>Net return</strong><span>Higher APRA ${escapeHtml(selected.horizon.replace("y","-year"))} net return within the same peer group.</span></div><b>${option.scoreBreakdown.netReturn}<small> / 50</small></b></div></div><div class="fee-detail"><h4>Fee at ${aud(option.comparisonFee.amount)}</h4><p><code>${aud(option.comparisonFee.fixedAnnualDollars)} fixed + ${aud(option.comparisonFee.amount)} × ${pct(option.comparisonFee.variableRateDecimal*100)} = ${aud(option.comparisonFee.annualFee)}</code></p></div><div class="pathway-list"><strong>APRA product pathways</strong><ul>${option.pathways.map(path=>`<li>${escapeHtml(path)}</li>`).join("")}</ul></div></details>
  </article>`;
}

function renderChoiceResults(selected) {
  if(!choiceDataset?.rankingEnabled) {
    currentChoice=[]; choiceCards.innerHTML=""; choiceContext.textContent="Choice ranking data is not available."; showMoreChoice.hidden=true; return;
  }
  if(!["3y","5y"].includes(selected.horizon)) {
    currentChoice=[]; choiceCards.innerHTML='<p class="choice-empty">Choice options currently have validated 3- and 5-year returns only. Select one of those periods to view the Choice peer ranking.</p>';
    choiceContext.textContent=`No Choice ranking is shown for the selected ${selected.horizon.replace("y","-year")} period.`; showMoreChoice.hidden=true; return;
  }
  currentChoice=rankChoiceOptions(choiceDataset,{peerGroup:selected.choicePeerGroup,amount:selected.amount,horizon:selected.horizon});
  const peerLabel=selected.choicePeerGroup.replaceAll("-"," ");
  choiceContext.textContent=`${currentChoice.length} distinct Choice investment options ranked within the ${peerLabel} peer group at ${aud(selected.amount)}. Shared underlying options are shown once, with all APRA product/menu pathways retained in the details.`;
  choiceCards.innerHTML=currentChoice.slice(0,choiceVisible).map(option=>renderChoiceCard(option,selected)).join("");
  showMoreChoice.hidden=choiceVisible>=currentChoice.length;
}

function comparisonColumn(product, selected, heading) {
  return `<article class="comparison-column"><small>${escapeHtml(heading)}</small><h3>${escapeHtml(product.productName)}</h3><p>${escapeHtml(product.rseName)}</p><dl><div><dt>Research score</dt><dd>${product.matchScore}/100</dd></div><div><dt>Growth assets</dt><dd>${pct(product.growthAllocationPct)}</dd></div><div><dt>Annual fee</dt><dd>${aud(product.comparisonFee.annualFee)}</dd></div><div><dt>${selected.horizon.replace("y","-year")} net return</dt><dd>${pct(product.returns[selected.horizon].netReturn50kPct)}</dd></div><div><dt>APRA test</dt><dd>${escapeHtml(product.performanceTestResult ?? "Not assessed")}</dd></div></dl></article>`;
}

function renderCurrentComparison(client, selected) {
  if (!client.currentFund) { comparisonPanel.hidden=true; comparisonPanel.innerHTML=""; return; }
  const comparison=buildComparison(products,current,client.currentFund);
  comparisonPanel.hidden=false;
  if (comparison.status==="unmapped") {
    comparisonPanel.innerHTML=`<div class="comparison-message"><strong>Current position not mapped</strong><span>“${escapeHtml(client.currentFund)}” is recorded from APRA’s broader product directory or manual entry, but it is not yet available in the quantitative comparison dataset. Keep it as an adviser review item and verify the current PDS.</span></div>`;
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
    button.innerHTML=`<strong>${escapeHtml(option.productName)}</strong><span>${escapeHtml([option.stageName,option.productType,option.productPhase,option.availability].filter(Boolean).join(" · "))}</span>`;
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
      productType:"MySuper · research comparison available",
      productPhase:"Accumulation",
      availability:"",
      directoryOnly:false,
      searchText:`${product.rseName} ${product.productName} ${product.lifecycleStageName??""}`.toLowerCase()
    });
  });
  directoryProducts.forEach(product=>{
    const alreadyComparable=[...unique.values()].some(option=>option.fundName===product.rseName && option.productName===product.productName);
    if(alreadyComparable && product.productType==="MySuper Product") return;
    const value=`${product.productName} [${product.productType??"APRA product"}]`;
    unique.set(`directory|${product.productId}`,{
      value, productName:product.productName, stageName:"", fundName:product.rseName,
      productType:product.productType??"APRA product", productPhase:product.productPhase??"Phase not stated",
      availability:product.openToNewMembers==="Yes"?"Open to new members":"Check availability", directoryOnly:true,
      searchText:`${product.rseName} ${product.productName} ${product.productType??""} ${product.productPhase??""}`.toLowerCase()
    });
  });
  currentProductOptions=[...unique.values()];
  currentProductOptions.sort((a,b)=>a.fundName.localeCompare(b.fundName)||a.productName.localeCompare(b.productName)||a.stageName.localeCompare(b.stageName));
}

function updateCurrentFundMode() {
  const isManual=currentFundSelect.value===MANUAL_CURRENT_FUND;
  manualCurrentFundField.hidden=!isManual;
  manualCurrentFundInput.required=isManual;
  if(!isManual) manualCurrentFundInput.value="";
}

function render(reset=true) {
  if (reset) { visible=6; choiceVisible=6; }
  const selected=criteria(), client=updateContributionPreview(); current=scoreProducts(products,selected);
  title.textContent=`${current.length} comparable MySuper records`;
  context.textContent=`MySuper and Choice results are shown as separate research universes. MySuper uses the existing CPPP score; Choice options are ranked only inside the selected ${selected.choicePeerGroup.replaceAll("-"," ")} peer group using balance-adjusted fees and validated returns. The current-fund directory contains ${number(directoryProducts.length)} APRA products.`;
  const currentFund=client.currentFund?`Current position: <strong>${escapeHtml(client.currentFund)}</strong>`:"Current fund not entered";
  clientSummary.innerHTML=`<span>${currentFund}</span><span>Age <strong>${client.age}</strong> · retirement in <strong>${client.yearsToRetirement} years</strong></span>${client.isWorking?`<span>First-year employer SG <strong>${aud(client.employerSg)}</strong></span><span>Total concessional <strong>${aud(client.totalConcessional)}</strong></span>`:""}`;
  renderCurrentComparison(client,selected);
  cards.innerHTML=current.slice(0,visible).map(product=>renderCard(product,selected)).join("");
  showMore.hidden=visible>=current.length;
  renderChoiceResults(selected);
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
showMoreChoice.addEventListener("click",()=>{choiceVisible+=6;render(false)});

try {
  const [productResponse,metadataResponse,directoryResponse,directoryMetadataResponse,choiceResponse]=await Promise.all([
    fetch("public/data/products.json"),fetch("public/data/metadata.json"),
    fetch("public/data/product-directory.json"),fetch("public/data/product-directory-metadata.json"),
    fetch("public/data/choice-products.json")
  ]);
  if(!productResponse.ok||!metadataResponse.ok||!directoryResponse.ok||!directoryMetadataResponse.ok||!choiceResponse.ok) throw new Error("Research data could not be loaded.");
  products=await productResponse.json(); const metadata=await metadataResponse.json();
  directoryProducts=await directoryResponse.json(); const directoryMetadata=await directoryMetadataResponse.json();
  choiceDataset=await choiceResponse.json();
  populateCurrentProductOptions();
  updateCurrentFundMode();
  document.querySelector("#reporting-date").textContent=`MySuper ${metadata.reportingDate} · Choice ${choiceDataset.reportingDate} · Directory ${directoryMetadata.reportingDate}`; render();
} catch(error) { title.textContent="Data unavailable"; cards.innerHTML=`<p class="error">${escapeHtml(error.message)} Please refresh or try again later.</p>`; }
