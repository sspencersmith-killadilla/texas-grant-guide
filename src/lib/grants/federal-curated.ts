import type { Grant } from "./types";

const CHECKED = "2026-07-26T00:00:00.000Z";

/**
 * Recurring national library, museum, arts and humanities programs where a city
 * (or a city-run library, museum or arts department) is an eligible applicant.
 * These agencies post to Grants.gov only during an open cycle, so they are kept
 * here as maintained entries that always link back to the official program page.
 */
export const FEDERAL_CURATED_GRANTS: Grant[] = [
  {
    id: "fed-imls-grants-to-states",
    source: "federal",
    title: "Grants to States (LSTA) — subgranted in Texas by TSLAC",
    agency: "Institute of Museum and Library Services",
    category: "culture",
    deadlineNote: "IMLS allots funds to states annually; Texas libraries apply through TSLAC competitive cycles.",
    matchNote: "State match handled by TSLAC; individual subgrants may require local cost share.",
    url: "https://www.imls.gov/grants/grants-states",
    description:
      "The largest source of federal funding for libraries. IMLS distributes Library Services and Technology Act dollars to each State Library Administrative Agency; in Texas the Texas State Library and Archives Commission (TSLAC) re-grants those funds to public libraries for technology, broadband and device lending, summer reading, literacy, workforce and small business services, digitization and continuing education. City-operated public libraries are the primary subgrantees.",
    eligibility: "City and county public libraries and library systems, via TSLAC subgrant programs.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-imls-museums-for-america",
    source: "federal",
    title: "Museums for America",
    agency: "Institute of Museum and Library Services",
    category: "culture",
    deadlineNote: "Annual cycle; applications generally due in mid-November.",
    matchNote: "Cost share of at least 1:1 required for most project categories.",
    costSharing: true,
    awardFloor: 5000,
    awardCeiling: 250000,
    url: "https://www.imls.gov/grants/available/museums-america",
    description:
      "Project support for museums of all sizes to strengthen collections stewardship, exhibitions, education and community engagement, and institutional capacity. Municipally owned museums, historic houses, science centers and cultural centers are eligible applicants.",
    eligibility: "Museums, including those operated by a unit of state, local or tribal government.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-imls-inspire-small-museums",
    source: "federal",
    title: "Inspire! Grants for Small Museums",
    agency: "Institute of Museum and Library Services",
    category: "culture",
    deadlineNote: "Annual cycle; applications generally due in mid-November.",
    matchNote: "No cost share required.",
    awardFloor: 5000,
    awardCeiling: 75000,
    url: "https://www.imls.gov/grants/available/inspire-grants-small-museums",
    description:
      "A special initiative of Museums for America designed for small museums with limited staff and budget. Funds collections care, exhibition development, educational programming, community partnerships and organizational planning. City-run local history museums and heritage centers are common applicants.",
    eligibility: "Small museums, including municipal museums, with modest operating budgets and staffing.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-imls-nlg-libraries",
    source: "federal",
    title: "National Leadership Grants for Libraries",
    agency: "Institute of Museum and Library Services",
    category: "culture",
    deadlineNote: "Annual cycle; preliminary proposals typically due in the spring.",
    matchNote: "Cost share required for most project categories.",
    costSharing: true,
    url: "https://www.imls.gov/grants/available/national-leadership-grants-libraries",
    description:
      "Funding for projects that address broad challenges facing the library field and produce results that other libraries can adopt: digital inclusion, community memory and digitization, emergency preparedness, workforce services and data-driven service design. Public libraries, including city libraries partnering with other institutions, may apply.",
    eligibility: "Libraries and library agencies, including city-operated public libraries and consortia.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-imls-laura-bush-librarian",
    source: "federal",
    title: "Laura Bush 21st Century Librarian Program",
    agency: "Institute of Museum and Library Services",
    category: "culture",
    deadlineNote: "Annual cycle; preliminary proposals typically due in the spring.",
    matchNote: "Cost share required for most project categories.",
    costSharing: true,
    url: "https://www.imls.gov/grants/available/laura-bush-21st-century-librarian-program",
    description:
      "Supports recruiting, educating and retaining library and archives professionals and paraprofessionals, including continuing education for existing staff. City libraries usually participate through a partnership with a school of information or a state library agency.",
    eligibility: "Libraries, archives, and library/archives education programs, including municipal libraries as partners.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-nea-our-town",
    source: "federal",
    title: "Our Town (Creative Placemaking)",
    agency: "National Endowment for the Arts",
    category: "culture",
    deadlineNote: "Annual cycle; applications generally due in the summer.",
    matchNote: "Requires a 1:1 non-federal match.",
    costSharing: true,
    awardFloor: 25000,
    awardCeiling: 150000,
    url: "https://www.arts.gov/grants/our-town",
    description:
      "Creative placemaking grants for projects that integrate arts, culture and design into local efforts such as downtown revitalization, public space improvements, cultural planning and community development. Applications require a partnership between a local government and a nonprofit arts organization, and one partner must be a government entity.",
    eligibility: "Local governments in partnership with a nonprofit organization; a city may be the lead applicant.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-nea-grants-arts-projects",
    source: "federal",
    title: "Grants for Arts Projects",
    agency: "National Endowment for the Arts",
    category: "culture",
    deadlineNote: "Two application deadlines per year, typically February and July.",
    matchNote: "Requires a 1:1 non-federal match.",
    costSharing: true,
    awardFloor: 10000,
    awardCeiling: 100000,
    url: "https://www.arts.gov/grants/grants-for-arts-projects",
    description:
      "Project-based support for arts programming across disciplines: festivals, public art, performances, arts education, design and cultural facility planning. Cities, parks and recreation departments and municipal arts commissions can apply directly.",
    eligibility: "Nonprofit organizations, units of state or local government, and federally recognized tribes.",
    lastChecked: CHECKED,
  },
  {
    id: "fed-neh-humanities-communities",
    source: "federal",
    title: "Public Humanities Projects",
    agency: "National Endowment for the Humanities",
    category: "culture",
    deadlineNote: "Annual cycle; applications generally due in the summer.",
    matchNote: "No match for outright funds; matching funds category available.",
    awardCeiling: 400000,
    url: "https://www.neh.gov/grants/public/public-humanities-projects",
    description:
      "Support for humanities programming that reaches the public: interpretive exhibitions, historic place interpretation, community conversations and related planning. Municipal museums, libraries and historic sites are eligible applicants, and planning-level grants are available for early-stage projects.",
    eligibility: "Nonprofits, accredited institutions, and state and local governmental agencies.",
    lastChecked: CHECKED,
  },
];
