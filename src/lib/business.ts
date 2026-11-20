// Company details shown in the footer and on the contact page.
// Raiffeisen's e-commerce audit requires these to be live on the website (build plan,
// "Legal and compliance" #16). Fill them in once the business is registered with ARBK.
// Empty values are simply not shown.

export const business = {
  /** Registered company name, e.g. "Mirhaba SH.P.K." */
  name: "",
  /** ARBK business registration number (Numri i regjistrimit të biznesit). */
  registrationNumber: "",
  /** Fiscal number (Numri fiskal), if different. */
  fiscalNumber: "",
  /** Street, city, postcode, Kosovo. */
  address: "",
  email: "hello@mirhaba.app",
  privacyEmail: "privacy@mirhaba.app",
  /** Optional, e.g. "+383 44 000 000". */
  phone: "",
} as const;

export const isBusinessRegistered = !!(business.name && business.registrationNumber && business.address);
