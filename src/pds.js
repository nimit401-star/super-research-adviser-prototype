export const VERIFIED_DISCLOSURE_LINKS = [
  { rseName: "Mercer Super Trust", productName: "Virgin Money MySuper", documents: [{ type: "PDS and guides", url: "https://www.virginmoney.com.au/help-and-support/forms-and-important-information/superannuation-key-documents" }], verifiedAt: "2026-08-11" },
  { rseName: "AustralianSuper", documents: [{ type: "PDS and guides", url: "https://www.australiansuper.com/education-advice/product-disclosure-statements" }], verifiedAt: "2026-08-11" },
  { rseName: "Local Authorities Superannuation Fund", documents: [{ type: "PDS and guides", url: "https://www.visionsuper.com.au/forms-and-resources/pds" }], verifiedAt: "2026-08-11" },
  { rseName: "Mercer Super Trust", documents: [{ type: "PDS and guides", url: "https://www.mercersuper.com.au/documents/product-disclosure-statement/" }], verifiedAt: "2026-08-11" },
  { rseName: "Australian Retirement Trust", documents: [{ type: "PDS, investment guides and TMD", url: "https://www.australianretirementtrust.com.au/pds-guides" }], verifiedAt: "2026-08-11" }
];

export const VERIFIED_PDS_LINKS = VERIFIED_DISCLOSURE_LINKS.map(entry => ({
  ...entry, url: entry.documents[0].url, label: `View ${entry.documents[0].type}`
}));

export function findDisclosureLinks(product, links = VERIFIED_DISCLOSURE_LINKS) {
  return links.find(link => link.rseName === product.rseName && link.productName === product.productName)
    ?? links.find(link => link.rseName === product.rseName && !link.productName) ?? null;
}

export function findPdsLink(product, links = VERIFIED_PDS_LINKS) {
  const match = links.find(link => link.rseName === product.rseName && link.productName === product.productName)
    ?? links.find(link => link.rseName === product.rseName && !link.productName) ?? null;
  return match ? { ...match, url: match.url ?? match.documents?.[0]?.url, label: match.label ?? `View ${match.documents?.[0]?.type ?? "official disclosures"}` } : null;
}
