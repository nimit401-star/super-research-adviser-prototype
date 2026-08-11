export const VERIFIED_PDS_LINKS = [
  {
    rseName: "Mercer Super Trust",
    productName: "Virgin Money MySuper",
    url: "https://www.virginmoney.com.au/help-and-support/forms-and-important-information/superannuation-key-documents",
    label: "View Virgin Money Super PDS",
    verifiedAt: "2026-08-11"
  },
  {
    rseName: "AustralianSuper",
    url: "https://www.australiansuper.com/education-advice/product-disclosure-statements",
    label: "View AustralianSuper PDS",
    verifiedAt: "2026-08-11"
  },
  {
    rseName: "Local Authorities Superannuation Fund",
    url: "https://www.visionsuper.com.au/forms-and-resources/pds",
    label: "View Vision Super PDS",
    verifiedAt: "2026-08-11"
  },
  {
    rseName: "Mercer Super Trust",
    url: "https://www.mercersuper.com.au/documents/product-disclosure-statement/",
    label: "View Mercer Super PDS documents",
    verifiedAt: "2026-08-11"
  },
  {
    rseName: "Australian Retirement Trust",
    url: "https://www.australianretirementtrust.com.au/pds-guides",
    label: "View ART PDS and guides",
    verifiedAt: "2026-08-11"
  }
];

export function findPdsLink(product, links = VERIFIED_PDS_LINKS) {
  return links.find(link => link.rseName === product.rseName && link.productName === product.productName)
    ?? links.find(link => link.rseName === product.rseName && !link.productName)
    ?? null;
}
