export interface DraftQuestion {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
  multiline: boolean;
}

export const DRAFT_QUESTIONS: DraftQuestion[] = [
  {
    id: "applicant",
    label: "Which city is applying, and how big is it?",
    helper: "City name, county, and population. A rough number is fine — the draft will flag anything to verify.",
    placeholder: "City of Bastrop, Bastrop County, population approximately 10,500.",
    multiline: true,
  },
  {
    id: "need",
    label: "What problem are you trying to solve?",
    helper: "Describe it the way you would to a neighbor. Include how long it has been a problem and what happens if nothing changes.",
    placeholder:
      "Our 1968 lift station on Water Street fails during heavy rain and has overflowed three times in two years, sending untreated wastewater toward the creek...",
    multiline: true,
  },
  {
    id: "project",
    label: "What exactly do you want to fund?",
    helper: "The concrete thing you would buy, build, hire or study with this money.",
    placeholder: "Replace the lift station with a new duplex pump station, add a backup generator and SCADA alarms...",
    multiline: true,
  },
  {
    id: "beneficiaries",
    label: "Who benefits, and how many people?",
    helper: "Residents served, neighborhoods affected, and any low- and moderate-income or underserved populations.",
    placeholder: "About 3,200 residents on the east side, including two schools and a senior housing complex...",
    multiline: true,
  },
  {
    id: "budget",
    label: "What will it cost, and how much are you requesting?",
    helper: "Total project cost and the grant amount you want. Break out big line items if you know them.",
    placeholder: "Total cost $1.4M: engineering $180K, equipment $760K, construction $420K. Requesting $1.05M.",
    multiline: true,
  },
  {
    id: "match",
    label: "What can the city contribute?",
    helper: "Cash match, utility fund reserves, staff time, equipment, donated land, or partner contributions.",
    placeholder: "$350,000 from the utility capital fund, plus in-kind public works labor valued at about $40,000.",
    multiline: true,
  },
  {
    id: "timeline",
    label: "What is your timeline, and who will manage the project?",
    helper: "Rough start and finish, major phases, and the staff member or firm responsible.",
    placeholder: "Design Oct–Jan, bid Feb, construction Mar–Sep. Managed by the Public Works Director with an engineering firm.",
    multiline: true,
  },
  {
    id: "success",
    label: "How will you know it worked?",
    helper: "The numbers or conditions you would point to a year later to prove success.",
    placeholder: "Zero sanitary sewer overflows, pump run-time reduced 30 percent, response time to alarms under 20 minutes.",
    multiline: true,
  },
];
