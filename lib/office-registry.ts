import type { OfficeType } from "./types"

export type OfficeEvidence = {
  sourceUrl: string
  reviewer: string
  checkedOn: string
  reviewDue: string
}

export type OfficeRecord = {
  id: string
  name: string
  type: OfficeType
  mode: "physical" | "online" | "hybrid"
  status: "active" | "closed"
  website: string
  address?: string
  addressEvidence?: OfficeEvidence
  physicalCityCode?: string
  services: {
    requirementId: string
    serviceEvidence: OfficeEvidence
    coverageEvidence: OfficeEvidence
    areas: { cityCode: string; barangays?: string[] }[]
    assignmentRequired?: boolean
  }[]
  coordinates?: {
    lat: number
    lng: number
    precision: "entrance" | "building" | "approximate"
    license: string
    evidence: OfficeEvidence
  }
}

// Official-source review covers the listed service and Manila jurisdiction. Addresses are
// source-listed contact locations; none is an independently verified map coordinate.
const MANILA = "1380600000"
const CHECKED = "2026-10-23"
const REVIEW_DUE = "2027-01-23"
const evidence = (sourceUrl: string): OfficeEvidence => ({
  sourceUrl, reviewer: "Hermit official-source review", checkedOn: CHECKED, reviewDue: REVIEW_DUE,
})
const service = (requirementId: string, serviceUrl: string, coverageUrl = serviceUrl, assignmentRequired = false) => ({
  requirementId,
  serviceEvidence: evidence(serviceUrl),
  coverageEvidence: evidence(coverageUrl),
  areas: [{ cityCode: MANILA }],
  assignmentRequired,
})

const BOP = "https://www.manila.gov.ph/wp-content/uploads/2021/10/2021-CITIZENS-CHARTER-HANDBOOK-BOP.pdf"
const MANILA_EODB = "https://citycouncilofmanila.com.ph/wp-content/uploads/2023/02/ORDINANCE-NO.-8754.pdf"
const MANILA_DEPARTMENTS = "https://citycouncilofmanila.com.ph/city-of-manila-information/departments/"
const BIR_SERVICE = "https://www.bir.gov.ph/BIRCC-RDO-External-Service-08"
const BIR_DIRECTORY = "https://bir-cdn.bir.gov.ph/BIR/pdf/citizens-charter-rr-rdo-2024-v3.pdf"
const BIR_ADDRESS = "https://bir-cdn.bir.gov.ph/BIR/pdf/RFQ_Internet%202026.pdf"
const BIR_BUILDING_2 = "BIR Building 2, Solana Street corner Beaterio Street, Intramuros, Manila"
const BIR_BOY_SCOUTS = "Boy Scouts of the Philippines Building, 181 Natividad Almeda-Lopez Street, Ermita, Manila"

const birRdo = (id: string, district: string, address: string): OfficeRecord => ({
  id: `bir-rdo-${id}`,
  name: `BIR RDO ${id} — ${district}`,
  type: "bir_rdo",
  mode: "physical",
  status: "active",
  website: "https://www.bir.gov.ph",
  address,
  addressEvidence: evidence(BIR_ADDRESS),
  physicalCityCode: MANILA,
  services: [
    service("bir_cor", BIR_SERVICE, BIR_DIRECTORY, true),
    service("bir_books", BIR_DIRECTORY, BIR_DIRECTORY, true),
    service("bir_invoices", BIR_DIRECTORY, BIR_DIRECTORY, true),
  ],
})

export const OFFICE_REGISTRY: readonly OfficeRecord[] = [
  {
    id: "manila-bureau-of-permits",
    name: "Manila Bureau of Permits",
    type: "bplo", mode: "physical", status: "active",
    website: "https://manila.gov.ph",
    address: "Room 110, Manila City Hall, A. J. Villegas Street, Ermita, Manila",
    addressEvidence: evidence(MANILA_DEPARTMENTS),
    physicalCityCode: MANILA,
    services: [
      service("mayors_permit", BOP, MANILA_DEPARTMENTS),
      service("mayors_renewal", BOP, MANILA_DEPARTMENTS),
      service("brgy_clearance", MANILA_EODB),
      service("brgy_renewal", MANILA_EODB),
      service("sanitary_permit", MANILA_EODB),
    ],
  },
  {
    id: "manila-health-department",
    name: "Manila Health Department",
    type: "health", mode: "physical", status: "active",
    website: "https://manila.gov.ph",
    address: "Room 101, Manila City Hall, A. J. Villegas Street, Ermita, Manila",
    addressEvidence: evidence(MANILA_DEPARTMENTS),
    physicalCityCode: MANILA,
    services: [
      service("sanitary_permit", BOP, MANILA_DEPARTMENTS),
      service("health_certs", "https://citycouncilofmanila.com.ph/wp-content/uploads/2023/03/ORDINANCE-NO.-7794.pdf", MANILA_DEPARTMENTS),
    ],
  },
  {
    id: "bfp-manila-fire-district",
    name: "BFP Manila Fire District Office",
    type: "bfp", mode: "physical", status: "active",
    website: "https://ncr.bfp.gov.ph",
    address: "Rizal Avenue corner Quiricada Street, Santa Cruz, Manila",
    addressEvidence: evidence("https://ncr.bfp.gov.ph/wp-content/uploads/2023/11/Bidding-Documents-for-the-Upgrading-of-Electrical-System-of-Manila-Fire-District-Office-BFP-NCR.pdf"),
    physicalCityCode: MANILA,
    services: [service("fsic",
      "https://www.bfp.gov.ph/wp-content/uploads/2020/12/3-BFP-Citizens-Charter-Handbook-for-Printing.pdf",
      "https://ncr.bfp.gov.ph/wp-content/uploads/2023/11/Bidding-Documents-for-the-Upgrading-of-Electrical-System-of-Manila-Fire-District-Office-BFP-NCR.pdf")],
  },
  birRdo("29", "Tondo and San Nicolas", BIR_BOY_SCOUTS),
  birRdo("30", "Binondo", BIR_BUILDING_2),
  birRdo("31", "Santa Cruz", BIR_BUILDING_2),
  birRdo("32", "Quiapo, Sampaloc, San Miguel and Santa Mesa", BIR_BUILDING_2),
  birRdo("33", "Ermita, Intramuros and Malate", BIR_BOY_SCOUTS),
  birRdo("34", "Paco, Pandacan, Santa Ana and San Andres", BIR_BUILDING_2),
  {
    id: "dti-nc-area-2-makati",
    name: "DTI Negosyo Center Area 2 — Makati",
    type: "negosyo_center", mode: "physical", status: "active",
    website: "https://www.dti.gov.ph",
    address: "4th Floor, Trade and Industry Building, 361 Senator Gil Puyat Avenue, Makati City",
    addressEvidence: evidence("https://www.dti.gov.ph/wp-content/uploads/2025/08/CitizensCharter2025Internal7thEdition_v1.pdf"),
    physicalCityCode: "1380300000",
    services: [service("dti_bn", "https://www.dti.gov.ph/wp-content/uploads/2025/08/CitizensCharter2025Internal7thEdition_v1.pdf",
      "https://ecommerce.dti.gov.ph/faqs/")],
  },
  {
    id: "sec-esparc-online",
    name: "SEC eSPARC company registration",
    type: "sec", mode: "online", status: "active",
    website: "https://esparc.sec.gov.ph/application",
    services: [service("sec_reg", "https://esparc.sec.gov.ph/application")],
  },
  {
    id: "cda-ncr-extension",
    name: "CDA NCR Extension Office",
    type: "cda", mode: "physical", status: "active",
    website: "https://cda.gov.ph/region-ncr/contact-us/",
    address: "Lower Ground Floor, EDSA Grand Residences, 75 Corregidor Street corner EDSA, Bago Bantay, Quezon City",
    addressEvidence: evidence("https://cda.gov.ph/region-ncr/contact-us/"),
    physicalCityCode: "1381300000",
    services: [service("cda_reg", "https://cda.gov.ph/frequently-asked-questions/",
      "https://cda.gov.ph/region-ncr/contact-us/")],
  },
  {
    id: "dti-bmbe-online",
    name: "DTI BMBE online registration",
    type: "negosyo_center", mode: "online", status: "active",
    website: "https://bmbe-registration.dti.gov.ph/undertaking",
    services: [service("bmbe", "https://www.dti.gov.ph/dti-news-archived/dti-region-12-news-archived/dti-micro-businesses-bmbe-register")],
  },
  {
    id: "fda-eservices-food",
    name: "FDA eServices — food authorizations",
    type: "fda", mode: "online", status: "active",
    website: "https://eservices.fda.gov.ph/applications",
    services: [
      service("fda_lto", "https://www.fda.gov.ph/wp-content/uploads/2024/04/15.-License-to-Operate-LTO.pdf"),
      service("fda_cpr", "https://eservices.fda.gov.ph/applications/certificate_product_registration/foods"),
    ],
  },
]
