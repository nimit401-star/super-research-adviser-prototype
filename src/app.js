import { scoreProducts } from "./score.js";

const cards = document.querySelector("#result-cards");
const form = document.querySelector("#research-form");
const title = document.querySelector("#results-title");
const context = document.querySelector("#results-context");
const showMore = document.querySelector("#show-more");
let products = [], visible = 6, current = [];

const pct = value => value == null ? "—" : `${value.toFixed(2).replace(/\.00$/,"")}%`;
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
const label = key => ({growthFit:"Growth fit",feeEfficiency:"Fee efficiency",netReturn:"Net return",performanceTest:"APRA test",completeness:"Data completeness"}[key]);

function criteria() {
  const [growthMin,growthMax] = new FormData(form).get("growth").split(",").map(Number);
  return { growthMin, growthMax, balance:document.querySelector("#balance").value, horizon:document.querySelector("#horizon").value };
}

function renderCard(product, selected) {
  const stage = product.lifecycleStageName ? ` · ${product.lifecycleStageName}` : "";
  const flag = product.performanceTestResult == null ? '<span class="flag">APRA test not assessed for this stage</span>' : "";
  return `<article class="card">
    <div class="card-top"><div><h3>${escapeHtml(product.productName)}${escapeHtml(stage)}</h3><p class="fund">${escapeHtml(product.rseName)}</p></div><div class="score" style="--score:${product.matchScore}"><span>${product.matchScore}<small>/100</small></span></div></div>
    <div class="metrics"><div class="metric"><strong>${pct(product.growthAllocationPct)}</strong><span>Growth assets</span></div><div class="metric"><strong>${pct(product.fees[selected.balance].totalPct)}</strong><span>Total fee · ${selected.balance}</span></div><div class="metric"><strong>${pct(product.returns[selected.horizon].netReturn50kPct)}</strong><span>Net return · ${selected.horizon}</span></div></div>
    <details class="breakdown"><summary>Why this score</summary><ul>${Object.entries(product.scoreBreakdown).map(([key,value])=>`<li><span>${label(key)}</span><strong>${value}</strong></li>`).join("")}</ul></details>${flag}
  </article>`;
}

function render(reset=true) {
  if (reset) visible=6;
  const selected=criteria(); current=scoreProducts(products,selected);
  title.textContent=`${current.length} comparable products`;
  context.textContent=`Ranked for ${selected.growthMin}–${selected.growthMax}% growth, ${selected.balance.replace("k",",000")} balance and ${selected.horizon.replace("y","-year")} net return. Showing research matches, not recommendations.`;
  cards.innerHTML=current.slice(0,visible).map(product=>renderCard(product,selected)).join("");
  showMore.hidden=visible>=current.length;
}

form.addEventListener("submit", event => { event.preventDefault(); render(); document.querySelector("#results").scrollIntoView({behavior:"smooth"}); });
showMore.addEventListener("click",()=>{visible+=6;render(false)});

try {
  const [productResponse,metadataResponse]=await Promise.all([fetch("public/data/products.json"),fetch("public/data/metadata.json")]);
  if(!productResponse.ok||!metadataResponse.ok) throw new Error("Research data could not be loaded.");
  products=await productResponse.json(); const metadata=await metadataResponse.json();
  document.querySelector("#reporting-date").textContent=`Reporting date ${metadata.reportingDate}`; render();
} catch(error) { title.textContent="Data unavailable"; cards.innerHTML=`<p class="error">${escapeHtml(error.message)} Please refresh or try again later.</p>`; }
