import type {
  Activity,
  Album,
  Donation,
  Expense,
  Member,
  Photo,
  SocietyData,
} from "./types";
import { financialYear } from "./receipt";

/**
 * Sample data for a ~120-flat housing society, so every screen has something
 * real-looking in it. Replace it with your own society's details, or wipe it
 * from the Settings screen once the real records are in.
 *
 * Dates are fixed strings rather than computed from `new Date()` so the demo
 * looks identical on every device and reload.
 */

const ADMIN_SECRETARY = "mem-rajesh";
const ADMIN_TREASURER = "mem-meena";

/** Same password for every seeded account, shown as a hint on the login screen. */
const DEMO_PASSWORD = "demo1234";

export const DEMO_LOGINS = {
  admin: { email: "secretary@wellingtonpwc.in", password: DEMO_PASSWORD },
  collector: { email: "vikram.c@example.com", password: DEMO_PASSWORD },
  resident: { email: "sunil.k@example.com", password: DEMO_PASSWORD },
};

const members: Member[] = [
  {
    id: ADMIN_SECRETARY,
    name: "Rajesh Deshmukh",
    email: "secretary@wellingtonpwc.in",
    mobile: "98200 11234",
    wing: "A",
    flat: "1204",
    role: "admin",
    status: "approved",
    joinedAt: "2019-04-01",
    password: DEMO_PASSWORD,
  },
  {
    id: ADMIN_TREASURER,
    name: "Meena Iyer",
    email: "treasurer@wellingtonpwc.in",
    mobile: "98330 44210",
    wing: "B",
    flat: "702",
    role: "admin",
    status: "approved",
    joinedAt: "2020-06-15",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-sunil",
    name: "Sunil Kulkarni",
    email: "sunil.k@example.com",
    mobile: "99870 33456",
    wing: "A",
    flat: "305",
    role: "resident",
    status: "approved",
    joinedAt: "2021-01-20",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-farida",
    name: "Farida Shaikh",
    email: "farida.shaikh@example.com",
    mobile: "98675 90112",
    wing: "C",
    flat: "1101",
    role: "resident",
    status: "approved",
    joinedAt: "2021-08-11",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-anand",
    name: "Anand Rao",
    email: "anand.rao@example.com",
    mobile: "90045 67781",
    wing: "B",
    flat: "406",
    role: "resident",
    status: "approved",
    joinedAt: "2022-03-05",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-priya",
    name: "Priya Nair",
    email: "priya.nair@example.com",
    mobile: "98211 45678",
    wing: "D",
    flat: "802",
    role: "resident",
    status: "approved",
    joinedAt: "2022-07-19",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-vikram",
    name: "Vikram Chauhan",
    email: "vikram.c@example.com",
    mobile: "97690 22345",
    wing: "C",
    flat: "204",
    // Volunteer collectors record door-to-door collections on their own phones.
    role: "collector",
    status: "approved",
    joinedAt: "2023-02-14",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-latha",
    name: "Latha Subramanian",
    email: "latha.s@example.com",
    mobile: "98195 88123",
    wing: "A",
    flat: "901",
    role: "resident",
    status: "approved",
    joinedAt: "2023-05-30",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-imran",
    name: "Imran Qureshi",
    email: "imran.q@example.com",
    mobile: "99201 76543",
    wing: "D",
    flat: "1503",
    role: "resident",
    status: "approved",
    joinedAt: "2023-11-02",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-neha",
    name: "Neha Bhosale",
    email: "neha.b@example.com",
    mobile: "70450 12398",
    wing: "B",
    flat: "1201",
    role: "collector",
    status: "approved",
    joinedAt: "2024-01-08",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-joseph",
    name: "Joseph Fernandes",
    email: "joseph.f@example.com",
    mobile: "98334 55011",
    wing: "C",
    flat: "608",
    role: "collector",
    status: "approved",
    joinedAt: "2024-09-21",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-kavita",
    name: "Kavita Joshi",
    email: "kavita.joshi@example.com",
    mobile: "98920 34567",
    wing: "A",
    flat: "104",
    role: "resident",
    status: "approved",
    joinedAt: "2025-03-12",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-sandeep",
    name: "Sandeep Yadav",
    email: "sandeep.yadav@example.com",
    mobile: "88790 65432",
    wing: "D",
    flat: "407",
    role: "resident",
    status: "pending",
    joinedAt: "2026-08-14",
    password: DEMO_PASSWORD,
  },
  {
    id: "mem-ritu",
    name: "Ritu Malhotra",
    email: "ritu.m@example.com",
    mobile: "99303 11987",
    wing: "B",
    flat: "905",
    role: "resident",
    status: "pending",
    joinedAt: "2026-08-16",
    password: DEMO_PASSWORD,
  },
];

const activities: Activity[] = [
  {
    id: "act-janmashtami-2026",
    title: "Janmashtami & Dahi Handi 2026",
    description:
      "Krishna–Radha fancy dress for the children at 5 pm, bhajan sandhya from 7 pm, midnight aarti with makhan-mishri prasad, and the dahi handi on the podium the next morning with a visiting govinda pathak. Volunteers needed for the handi rigging, prasad counter and children's costumes desk.",
    category: "festival",
    startsAt: "2026-09-04T17:00:00",
    endsAt: "2026-09-05T13:00:00",
    venue: "Podium & central lawn",
    budget: 88000,
    status: "planned",
    organiser: "Festival Committee",
    createdAt: "2026-08-08",
  },
  {
    id: "act-ganesh-2026",
    title: "Ganesh Chaturthi 2026",
    description:
      "Five days of celebration in the podium hall — daily aarti at 8 am and 7:30 pm, prasad distribution, cultural evening on day 3 and visarjan procession on day 5. Volunteers needed for the decoration and prasad committees.",
    category: "festival",
    startsAt: "2026-09-14T08:00:00",
    endsAt: "2026-09-18T21:00:00",
    venue: "Podium hall & main gate",
    budget: 185000,
    status: "planned",
    organiser: "Festival Committee",
    createdAt: "2026-06-20",
  },
  {
    id: "act-navratri-2026",
    title: "Navratri Garba Nights",
    description:
      "Nine evenings of garba on the open lawn with a live dhol party on the weekend nights. Dandiya sticks provided. Best-dressed prizes on the final night.",
    category: "festival",
    startsAt: "2026-10-11T19:00:00",
    endsAt: "2026-10-19T23:00:00",
    venue: "Central lawn",
    budget: 240000,
    status: "planned",
    organiser: "Cultural Committee",
    createdAt: "2026-07-02",
  },
  {
    id: "act-health-camp-2026",
    title: "Free Health Check-up Camp",
    description:
      "Blood sugar, BP, ECG and eye screening for all residents, with a dedicated senior-citizen hour from 9 to 10 am. Conducted in partnership with Sai Multispeciality Clinic.",
    category: "community-service",
    startsAt: "2026-09-27T09:00:00",
    endsAt: "2026-09-27T14:00:00",
    venue: "Clubhouse ground floor",
    budget: 35000,
    status: "planned",
    organiser: "Health & Welfare Committee",
    createdAt: "2026-07-28",
  },
  {
    id: "act-diwali-2026",
    title: "Diwali Get-together & Rangoli Contest",
    description:
      "Rangoli competition per wing judged at 6 pm, followed by a lantern-lighting ceremony, snacks counter and a green-crackers-only display for the children.",
    category: "festival",
    startsAt: "2026-11-08T17:00:00",
    endsAt: "2026-11-08T22:00:00",
    venue: "Central lawn & wing lobbies",
    budget: 95000,
    status: "planned",
    organiser: "Cultural Committee",
    createdAt: "2026-08-05",
  },
  {
    id: "act-independence-2026",
    title: "Independence Day Flag Hoisting",
    description:
      "Flag hoisting at 8 am by our senior-most resident, followed by the national anthem, a patriotic song performance by the society children and sweet distribution.",
    category: "cultural",
    startsAt: "2026-08-15T08:00:00",
    endsAt: "2026-08-15T10:00:00",
    venue: "Main gate flag post",
    budget: 25000,
    status: "completed",
    organiser: "Managing Committee",
    createdAt: "2026-07-20",
  },
  {
    id: "act-tree-2026",
    title: "Monsoon Tree Plantation Drive",
    description:
      "Sixty saplings planted along the compound wall and in the rear garden, with a one-year care roster signed up by twelve families.",
    category: "community-service",
    startsAt: "2026-07-12T07:30:00",
    endsAt: "2026-07-12T11:00:00",
    venue: "Compound wall & rear garden",
    budget: 18000,
    status: "completed",
    organiser: "Green Committee",
    createdAt: "2026-06-25",
  },
  {
    id: "act-summer-camp-2026",
    title: "Summer Camp for Children",
    description:
      "Three-week camp for ages 6 to 14 — swimming, chess, clay modelling, skating and a closing talent show. Forty-two children enrolled.",
    category: "workshop",
    startsAt: "2026-05-04T08:00:00",
    endsAt: "2026-05-23T12:00:00",
    venue: "Clubhouse & pool deck",
    budget: 45000,
    status: "completed",
    organiser: "Kids Activity Group",
    createdAt: "2026-04-10",
  },
  {
    id: "act-holi-2026",
    title: "Holi Celebration 2026",
    description:
      "Organic colours only, rain dance with a water sprinkler arrangement, thandai and puran poli counter, and a designated colour-free zone for senior citizens.",
    category: "festival",
    startsAt: "2026-03-03T09:00:00",
    endsAt: "2026-03-03T14:00:00",
    venue: "Central lawn",
    budget: 60000,
    status: "completed",
    organiser: "Cultural Committee",
    createdAt: "2026-02-10",
  },
  {
    id: "act-sports-2026",
    title: "Annual Sports Day 2026",
    description:
      "Box cricket, badminton doubles, carrom, chess and track events across three weekends, closing with a prize distribution dinner. One hundred and ten participants.",
    category: "sports",
    startsAt: "2026-02-08T07:00:00",
    endsAt: "2026-02-22T21:00:00",
    venue: "Society ground & clubhouse",
    budget: 80000,
    status: "completed",
    organiser: "Sports Committee",
    createdAt: "2026-01-05",
  },
  {
    id: "act-republic-2026",
    title: "Republic Day 2026",
    description:
      "Flag hoisting, a short speech on the Constitution by a resident advocate, and a drawing competition for the children of the society.",
    category: "cultural",
    startsAt: "2026-01-26T08:00:00",
    endsAt: "2026-01-26T10:30:00",
    venue: "Main gate flag post",
    budget: 20000,
    status: "completed",
    organiser: "Managing Committee",
    createdAt: "2026-01-10",
  },
  {
    id: "act-ganesh-2025",
    title: "Ganesh Chaturthi 2025",
    description:
      "Ten-day celebration with daily aarti, a bhajan sandhya, an annual-day cultural programme by the residents and visarjan at Kharghar lake.",
    category: "festival",
    startsAt: "2025-08-27T08:00:00",
    endsAt: "2025-09-06T20:00:00",
    venue: "Podium hall",
    budget: 170000,
    status: "completed",
    organiser: "Festival Committee",
    createdAt: "2025-07-15",
  },
];

/** Compact tuple form keeps this readable; expanded into objects below. */
type DonationSeed = [
  id: string,
  donorName: string,
  wing: string,
  flat: string,
  amount: number,
  method: Donation["method"],
  activityId: string | null,
  receivedAt: string,
  reference?: string,
  note?: string,
];

const donationSeeds: DonationSeed[] = [
  // ---- Ganesh Chaturthi 2026 — collection currently under way ----
  ["don-101", "Rajesh Deshmukh", "A", "1204", 11000, "upi", "act-ganesh-2026", "2026-07-04", "UPI/421903118472"],
  ["don-102", "Meena Iyer", "B", "702", 11000, "upi", "act-ganesh-2026", "2026-07-04", "UPI/421903221845"],
  ["don-103", "Sunil Kulkarni", "A", "305", 5100, "upi", "act-ganesh-2026", "2026-07-06", "UPI/422011903312"],
  ["don-104", "Farida Shaikh", "C", "1101", 5100, "upi", "act-ganesh-2026", "2026-07-06", "UPI/422013441209"],
  ["don-105", "Anand Rao", "B", "406", 7500, "bank-transfer", "act-ganesh-2026", "2026-07-09", "NEFT/HDFC0000521/8813"],
  ["don-106", "Priya Nair", "D", "802", 5100, "upi", "act-ganesh-2026", "2026-07-11", "UPI/422508871034"],
  ["don-107", "Vikram Chauhan", "C", "204", 3100, "cash", "act-ganesh-2026", "2026-07-12", undefined, "Collected at the July general body meeting"],
  ["don-108", "Latha Subramanian", "A", "901", 5100, "upi", "act-ganesh-2026", "2026-07-14", "UPI/422709912288"],
  ["don-109", "Imran Qureshi", "D", "1503", 11000, "bank-transfer", "act-ganesh-2026", "2026-07-16", "NEFT/ICIC0001204/5567"],
  ["don-110", "Neha Bhosale", "B", "1201", 2100, "upi", "act-ganesh-2026", "2026-07-18", "UPI/423001174590"],
  ["don-111", "Joseph Fernandes", "C", "608", 5100, "upi", "act-ganesh-2026", "2026-07-21", "UPI/423311908845"],
  ["don-112", "Kavita Joshi", "A", "104", 2100, "cash", "act-ganesh-2026", "2026-07-22"],
  ["don-113", "Deepak Sawant", "D", "204", 5100, "upi", "act-ganesh-2026", "2026-07-25", "UPI/423608812277"],
  ["don-114", "Shalini Gupta", "B", "1104", 3100, "upi", "act-ganesh-2026", "2026-07-27", "UPI/423809934411"],
  ["don-115", "Mohan Pillai", "C", "902", 5100, "cheque", "act-ganesh-2026", "2026-07-30", "CHQ/114502 · SBI"],
  ["don-116", "Arif Khan", "A", "607", 11000, "upi", "act-ganesh-2026", "2026-08-02", "UPI/424401128833"],
  ["don-117", "Sneha Patil", "D", "1102", 5100, "upi", "act-ganesh-2026", "2026-08-04", "UPI/424609917722"],
  ["don-118", "Ganesh Naik", "B", "308", 2100, "cash", "act-ganesh-2026", "2026-08-06"],
  ["don-119", "Rohit Mehta", "C", "1405", 15000, "bank-transfer", "act-ganesh-2026", "2026-08-08", "NEFT/AXIS0000912/2201", "Sponsoring the sound system for all five days"],
  ["don-120", "Asha Kamble", "A", "402", 3100, "upi", "act-ganesh-2026", "2026-08-10", "UPI/425108844190"],
  ["don-121", "Suresh Iyer", "D", "905", 5100, "upi", "act-ganesh-2026", "2026-08-12", "UPI/425309911034"],
  ["don-122", "Pooja Rane", "B", "504", 2100, "upi", "act-ganesh-2026", "2026-08-16", "UPI/425708823456"],

  // ---- Navratri 2026 — early sponsorships ----
  ["don-201", "Rohit Mehta", "C", "1405", 15000, "bank-transfer", "act-navratri-2026", "2026-08-09", "NEFT/AXIS0000912/2214", "Dhol party sponsorship"],
  ["don-202", "Imran Qureshi", "D", "1503", 5100, "upi", "act-navratri-2026", "2026-08-11", "UPI/425208819922"],
  ["don-203", "Anand Rao", "B", "406", 5100, "upi", "act-navratri-2026", "2026-08-13", "UPI/425411903388"],
  ["don-204", "Latha Subramanian", "A", "901", 3100, "upi", "act-navratri-2026", "2026-08-17", "UPI/425809934112"],

  // ---- Health camp sponsorship ----
  ["don-301", "Sai Multispeciality Clinic", "", "", 15000, "bank-transfer", "act-health-camp-2026", "2026-08-01", "NEFT/KKBK0000651/7781", "Clinic bearing the doctors' fee as CSR"],

  // ---- Independence Day 2026 ----
  ["don-401", "Rajesh Deshmukh", "A", "1204", 5000, "upi", "act-independence-2026", "2026-08-02", "UPI/424401177221"],
  ["don-402", "Kavita Joshi", "A", "104", 2100, "cash", "act-independence-2026", "2026-08-05"],
  ["don-403", "Vikram Chauhan", "C", "204", 5100, "upi", "act-independence-2026", "2026-08-07", "UPI/424801192233"],

  // ---- Tree plantation ----
  ["don-501", "Priya Nair", "D", "802", 5100, "upi", "act-tree-2026", "2026-06-28", "UPI/419902281144"],
  ["don-502", "Joseph Fernandes", "C", "608", 4000, "upi", "act-tree-2026", "2026-07-01", "UPI/420108829911"],

  // ---- Summer camp — participation contributions ----
  ["don-601", "Neha Bhosale", "B", "1201", 6000, "upi", "act-summer-camp-2026", "2026-04-18", "UPI/411802239900", "Two children enrolled"],
  ["don-602", "Farida Shaikh", "C", "1101", 3000, "upi", "act-summer-camp-2026", "2026-04-19", "UPI/411903318877"],
  ["don-603", "Sunil Kulkarni", "A", "305", 3000, "upi", "act-summer-camp-2026", "2026-04-20", "UPI/412009911223"],
  ["don-604", "Shalini Gupta", "B", "1104", 6000, "cash", "act-summer-camp-2026", "2026-04-22", undefined, "Two children enrolled"],
  ["don-605", "Sneha Patil", "D", "1102", 3000, "upi", "act-summer-camp-2026", "2026-04-24", "UPI/412408819900"],
  ["don-606", "Arif Khan", "A", "607", 12000, "bank-transfer", "act-summer-camp-2026", "2026-04-26", "NEFT/HDFC0000521/9012", "Sponsoring fees for four children whose families requested support"],

  // ---- Holi 2026 ----
  ["don-701", "Rajesh Deshmukh", "A", "1204", 7500, "upi", "act-holi-2026", "2026-02-14", "UPI/404501128899"],
  ["don-702", "Meena Iyer", "B", "702", 7500, "upi", "act-holi-2026", "2026-02-14", "UPI/404501128901"],
  ["don-703", "Rohit Mehta", "C", "1405", 10000, "bank-transfer", "act-holi-2026", "2026-02-16", "NEFT/AXIS0000912/1102"],
  ["don-704", "Deepak Sawant", "D", "204", 5100, "upi", "act-holi-2026", "2026-02-18", "UPI/404908812234"],
  ["don-705", "Mohan Pillai", "C", "902", 5100, "cheque", "act-holi-2026", "2026-02-20", "CHQ/114388 · SBI"],
  ["don-706", "Asha Kamble", "A", "402", 3100, "upi", "act-holi-2026", "2026-02-22", "UPI/405309918822"],
  ["don-707", "Ganesh Naik", "B", "308", 2100, "cash", "act-holi-2026", "2026-02-24"],
  ["don-708", "Suresh Iyer", "D", "905", 5100, "upi", "act-holi-2026", "2026-02-25", "UPI/405611902244"],
  ["don-709", "Pooja Rane", "B", "504", 3100, "upi", "act-holi-2026", "2026-02-27", "UPI/405808834112"],

  // ---- Sports Day 2026 ----
  ["don-801", "Arif Khan", "A", "607", 15000, "bank-transfer", "act-sports-2026", "2026-01-12", "NEFT/HDFC0000521/7745", "Trophy and medals sponsorship"],
  ["don-802", "Vikram Chauhan", "C", "204", 7500, "upi", "act-sports-2026", "2026-01-14", "UPI/401301192200"],
  ["don-803", "Imran Qureshi", "D", "1503", 7500, "upi", "act-sports-2026", "2026-01-16", "UPI/401508817733"],
  ["don-804", "Sunil Kulkarni", "A", "305", 5100, "upi", "act-sports-2026", "2026-01-18", "UPI/401709903311"],
  ["don-805", "Anand Rao", "B", "406", 5100, "upi", "act-sports-2026", "2026-01-20", "UPI/401908829944"],
  ["don-806", "Joseph Fernandes", "C", "608", 5100, "upi", "act-sports-2026", "2026-01-22", "UPI/402108811277"],
  ["don-807", "Priya Nair", "D", "802", 5100, "upi", "act-sports-2026", "2026-01-24", "UPI/402309934455"],
  ["don-808", "Latha Subramanian", "A", "901", 3100, "cash", "act-sports-2026", "2026-01-27"],
  ["don-809", "Neha Bhosale", "B", "1201", 3100, "upi", "act-sports-2026", "2026-01-29", "UPI/402808812390"],
  ["don-810", "Kavita Joshi", "A", "104", 2100, "upi", "act-sports-2026", "2026-02-01", "UPI/403109917788"],

  // ---- Republic Day 2026 ----
  ["don-901", "Meena Iyer", "B", "702", 5000, "upi", "act-republic-2026", "2026-01-15", "UPI/401408829901"],
  ["don-902", "Mohan Pillai", "C", "902", 2100, "cash", "act-republic-2026", "2026-01-18"],

  // ---- Ganesh Chaturthi 2025 ----
  ["don-1001", "Rajesh Deshmukh", "A", "1204", 11000, "upi", "act-ganesh-2025", "2025-07-20", "UPI/320108812234"],
  ["don-1002", "Meena Iyer", "B", "702", 11000, "upi", "act-ganesh-2025", "2025-07-20", "UPI/320108812240"],
  ["don-1003", "Rohit Mehta", "C", "1405", 21000, "bank-transfer", "act-ganesh-2025", "2025-07-22", "NEFT/AXIS0000912/0912", "Sponsoring the mandap decoration"],
  ["don-1004", "Arif Khan", "A", "607", 15000, "bank-transfer", "act-ganesh-2025", "2025-07-25", "NEFT/HDFC0000521/6612"],
  ["don-1005", "Imran Qureshi", "D", "1503", 11000, "upi", "act-ganesh-2025", "2025-07-28", "UPI/320908834411"],
  ["don-1006", "Sunil Kulkarni", "A", "305", 5100, "upi", "act-ganesh-2025", "2025-08-01", "UPI/321301192278"],
  ["don-1007", "Farida Shaikh", "C", "1101", 5100, "upi", "act-ganesh-2025", "2025-08-03", "UPI/321508811290"],
  ["don-1008", "Anand Rao", "B", "406", 7500, "upi", "act-ganesh-2025", "2025-08-05", "UPI/321709929911"],
  ["don-1009", "Priya Nair", "D", "802", 5100, "upi", "act-ganesh-2025", "2025-08-07", "UPI/321908812234"],
  ["don-1010", "Vikram Chauhan", "C", "204", 5100, "upi", "act-ganesh-2025", "2025-08-09", "UPI/322108844512"],
  ["don-1011", "Latha Subramanian", "A", "901", 5100, "cash", "act-ganesh-2025", "2025-08-11"],
  ["don-1012", "Deepak Sawant", "D", "204", 5100, "upi", "act-ganesh-2025", "2025-08-13", "UPI/322509911223"],
  ["don-1013", "Mohan Pillai", "C", "902", 5100, "cheque", "act-ganesh-2025", "2025-08-15", "CHQ/114201 · SBI"],
  ["don-1014", "Joseph Fernandes", "C", "608", 5100, "upi", "act-ganesh-2025", "2025-08-17", "UPI/322908817744"],
  ["don-1015", "Shalini Gupta", "B", "1104", 3100, "upi", "act-ganesh-2025", "2025-08-19", "UPI/323108839911"],
  ["don-1016", "Sneha Patil", "D", "1102", 5100, "upi", "act-ganesh-2025", "2025-08-21", "UPI/323308812234"],
  ["don-1017", "Ganesh Naik", "B", "308", 3100, "cash", "act-ganesh-2025", "2025-08-23"],
  ["don-1018", "Asha Kamble", "A", "402", 3100, "upi", "act-ganesh-2025", "2025-08-24", "UPI/323608829901"],
  ["don-1019", "Suresh Iyer", "D", "905", 5100, "upi", "act-ganesh-2025", "2025-08-25", "UPI/323708811234"],
  ["don-1020", "Pooja Rane", "B", "504", 3100, "upi", "act-ganesh-2025", "2025-08-26", "UPI/323808834190"],

  // ---- General society fund (not tied to any single activity) ----
  ["don-2001", "Shantiniketan Welfare Corpus", "", "", 50000, "bank-transfer", null, "2026-04-01", "NEFT/HDFC0000521/0001", "Annual transfer from the cultural corpus approved in the AGM"],
  ["don-2002", "Rohit Mehta", "C", "1405", 11000, "bank-transfer", null, "2026-05-10", "NEFT/AXIS0000912/1808", "Unrestricted — committee to use as needed"],
  ["don-2003", "Arif Khan", "A", "607", 11000, "upi", null, "2026-06-02", "UPI/415308812234", "Unrestricted"],
  ["don-2004", "Anonymous well-wisher", "", "", 5100, "cash", null, "2026-06-18", undefined, "Donor requested not to be named"],
  ["don-2005", "Deepak Sawant", "D", "204", 7500, "upi", null, "2026-07-08", "UPI/422208819933"],
];

type ExpenseSeed = [
  id: string,
  title: string,
  category: Expense["category"],
  amount: number,
  vendor: string,
  activityId: string | null,
  paidAt: string,
  method: Expense["method"],
  billNo?: string,
  note?: string,
];

const expenseSeeds: ExpenseSeed[] = [
  // ---- Janmashtami 2026 — advances paid so far ----
  ["exp-j01", "Dahi handi rigging, rope & matki set", "equipment-rental", 8500, "Krishna Mandap Services", "act-janmashtami-2026", "2026-08-12", "upi", "KMS/26/0228", "Includes the safety mattress hire"],
  ["exp-j02", "Govinda pathak booking advance", "rituals", 11000, "Jai Jawan Govinda Pathak, Kharghar", "act-janmashtami-2026", "2026-08-14", "bank-transfer", "JJGP/26/041", "Advance against ₹28,000 total"],
  ["exp-j03", "Krishna–Radha costumes for the children's desk", "prizes-and-gifts", 6400, "Natraj Costume House", "act-janmashtami-2026", "2026-08-16", "upi", "NCH/26/1177", "Twenty sets on hire"],
  ["exp-j04", "Sound system & mic for bhajan sandhya", "sound-and-lighting", 4500, "Balaji Sound & Light", "act-janmashtami-2026", "2026-08-17", "upi", "BSL/26/0782"],

  // ---- Ganesh Chaturthi 2026 — advances paid so far ----
  ["exp-101", "Idol booking advance", "rituals", 18000, "Shree Ganesh Murti Kala Kendra, Pen", "act-ganesh-2026", "2026-07-10", "bank-transfer", "SGM/26/0418", "50% advance; balance on delivery"],
  ["exp-102", "Mandap & stage decoration advance", "decoration", 25000, "Shubham Decorators", "act-ganesh-2026", "2026-07-24", "bank-transfer", "SD/2026/1142", "Advance against a total quote of ₹72,000"],
  ["exp-103", "Sound system booking advance", "sound-and-lighting", 10000, "Balaji Sound & Light", "act-ganesh-2026", "2026-08-08", "upi", "BSL/26/0771"],

  // ---- Navratri 2026 ----
  ["exp-201", "Lawn flooring & pandal advance", "equipment-rental", 15000, "Krishna Mandap Services", "act-navratri-2026", "2026-08-12", "bank-transfer", "KMS/26/0233"],

  // ---- Independence Day 2026 ----
  ["exp-401", "National flag & pole refurbishing", "equipment-rental", 4200, "Tricolour Flag House", "act-independence-2026", "2026-08-10", "upi", "TFH/1188"],
  ["exp-402", "Marigold garlands & rangoli colours", "decoration", 3600, "Sai Phool Bhandar", "act-independence-2026", "2026-08-14", "cash", "SPB/0912"],
  ["exp-403", "Sweets — 250 boxes", "catering", 11250, "Kandoi Sweets", "act-independence-2026", "2026-08-15", "upi", "KS/26/3341"],
  ["exp-404", "Mic & speaker rental", "sound-and-lighting", 2500, "Balaji Sound & Light", "act-independence-2026", "2026-08-15", "upi", "BSL/26/0768"],
  ["exp-405", "Prizes for the children's song performance", "prizes-and-gifts", 2200, "Archies Gift Gallery", "act-independence-2026", "2026-08-15", "cash", "AGG/2291"],

  // ---- Tree plantation 2026 ----
  ["exp-501", "60 saplings — neem, gulmohar, jamun", "maintenance", 9000, "Konkan Nursery", "act-tree-2026", "2026-07-08", "bank-transfer", "KN/26/0455"],
  ["exp-502", "Tree guards (60 nos.)", "equipment-rental", 4800, "Mahalaxmi Steel Works", "act-tree-2026", "2026-07-10", "upi", "MSW/1204"],
  ["exp-503", "Manure, tools & watering cans", "maintenance", 1900, "Krishi Kendra", "act-tree-2026", "2026-07-11", "cash", "KK/0338"],
  ["exp-504", "Refreshments for volunteers", "catering", 1100, "Gokul Snacks Corner", "act-tree-2026", "2026-07-12", "cash"],

  // ---- Summer camp 2026 ----
  ["exp-601", "Swimming coach — 3 weeks", "miscellaneous", 15000, "Coach Nitin Salunkhe", "act-summer-camp-2026", "2026-05-23", "bank-transfer", "NS/2026/07", "Fifteen sessions at ₹1,000 each"],
  ["exp-602", "Clay, craft & art material", "equipment-rental", 8400, "Kalakriti Art Supplies", "act-summer-camp-2026", "2026-05-02", "upi", "KAS/26/1190"],
  ["exp-603", "Skating equipment rental", "equipment-rental", 6000, "SpeedWheels Rentals", "act-summer-camp-2026", "2026-05-04", "upi", "SWR/0771"],
  ["exp-604", "Daily snacks & juice — 42 children", "catering", 8820, "Gokul Snacks Corner", "act-summer-camp-2026", "2026-05-23", "bank-transfer", "GSC/26/2214"],
  ["exp-605", "Talent show certificates & medals", "prizes-and-gifts", 3200, "Archies Gift Gallery", "act-summer-camp-2026", "2026-05-23", "cash", "AGG/2140"],

  // ---- Holi 2026 ----
  ["exp-701", "Organic gulal — 40 kg", "decoration", 12000, "Herbal Rang Bhandar", "act-holi-2026", "2026-03-01", "upi", "HRB/26/0088"],
  ["exp-702", "Rain dance sprinkler & water tanker", "equipment-rental", 14500, "Jal Seva Tankers", "act-holi-2026", "2026-03-03", "bank-transfer", "JST/26/0912", "Two tankers plus sprinkler setup"],
  ["exp-703", "DJ & sound for 5 hours", "sound-and-lighting", 12000, "Balaji Sound & Light", "act-holi-2026", "2026-03-03", "upi", "BSL/26/0301"],
  ["exp-704", "Thandai, puran poli & snacks — 300 plates", "catering", 16500, "Maharashtra Caterers", "act-holi-2026", "2026-03-03", "bank-transfer", "MC/26/0455"],
  ["exp-705", "Housekeeping & post-event cleaning", "maintenance", 3500, "Shine Facility Services", "act-holi-2026", "2026-03-04", "upi", "SFS/26/1120"],

  // ---- Sports Day 2026 ----
  ["exp-801", "Trophies, medals & certificates", "prizes-and-gifts", 18500, "Champion Sports Trophies", "act-sports-2026", "2026-02-20", "bank-transfer", "CST/26/0771"],
  ["exp-802", "Ground marking, nets & matting", "equipment-rental", 14200, "Sportsline Equipment", "act-sports-2026", "2026-02-06", "bank-transfer", "SE/26/0334"],
  ["exp-803", "Umpires & referees — 6 days", "miscellaneous", 12000, "Navi Mumbai Umpires Association", "act-sports-2026", "2026-02-22", "bank-transfer", "NMUA/26/041"],
  ["exp-804", "Prize distribution dinner — 180 plates", "catering", 21600, "Maharashtra Caterers", "act-sports-2026", "2026-02-22", "bank-transfer", "MC/26/0402"],
  ["exp-805", "T-shirts for participants (110 nos.)", "prizes-and-gifts", 8800, "Fabrico Printers", "act-sports-2026", "2026-02-07", "upi", "FP/26/1188"],
  ["exp-806", "Fixture boards & banner printing", "printing", 2400, "Sai Digital Prints", "act-sports-2026", "2026-02-05", "cash", "SDP/0991"],

  // ---- Republic Day 2026 ----
  ["exp-901", "Flag, buntings & tricolour decoration", "decoration", 4800, "Tricolour Flag House", "act-republic-2026", "2026-01-24", "upi", "TFH/1042"],
  ["exp-902", "Sweets & snacks distribution", "catering", 8900, "Kandoi Sweets", "act-republic-2026", "2026-01-26", "upi", "KS/26/0912"],
  ["exp-903", "Drawing competition material & prizes", "prizes-and-gifts", 3400, "Kalakriti Art Supplies", "act-republic-2026", "2026-01-26", "cash", "KAS/26/0221"],
  ["exp-904", "Mic & speaker rental", "sound-and-lighting", 1500, "Balaji Sound & Light", "act-republic-2026", "2026-01-26", "upi", "BSL/26/0140"],

  // ---- Ganesh Chaturthi 2025 ----
  ["exp-1001", "Ganesh idol — 5 ft eco-friendly", "rituals", 36000, "Shree Ganesh Murti Kala Kendra, Pen", "act-ganesh-2025", "2025-08-20", "bank-transfer", "SGM/25/0388"],
  ["exp-1002", "Mandap & full decoration", "decoration", 68000, "Shubham Decorators", "act-ganesh-2025", "2025-09-06", "bank-transfer", "SD/2025/0994"],
  ["exp-1003", "Sound & lighting — 10 days", "sound-and-lighting", 22000, "Balaji Sound & Light", "act-ganesh-2025", "2025-09-06", "bank-transfer", "BSL/25/0655"],
  ["exp-1004", "Pooja samagri & priest dakshina", "rituals", 14500, "Vedic Pooja Bhandar", "act-ganesh-2025", "2025-09-06", "cash", "VPB/25/0231"],
  ["exp-1005", "Prasad & mahaprasad — 10 days", "catering", 18600, "Maharashtra Caterers", "act-ganesh-2025", "2025-09-05", "bank-transfer", "MC/25/1120"],
  ["exp-1006", "Visarjan truck, dhol & escort", "transport", 9500, "Jai Malhar Transport", "act-ganesh-2025", "2025-09-06", "upi", "JMT/25/0771"],
  ["exp-1007", "Cultural programme prizes", "prizes-and-gifts", 6200, "Archies Gift Gallery", "act-ganesh-2025", "2025-09-04", "cash", "AGG/1902"],
  ["exp-1008", "Banner, invitation & receipt book printing", "printing", 3800, "Sai Digital Prints", "act-ganesh-2025", "2025-08-18", "upi", "SDP/0842"],
  ["exp-1009", "Post-visarjan cleaning", "maintenance", 3200, "Shine Facility Services", "act-ganesh-2025", "2025-09-07", "upi", "SFS/25/0904"],

  // ---- General society spending ----
  ["exp-2001", "Notice board & display stands for the lobby", "equipment-rental", 6500, "Mahalaxmi Steel Works", null, "2026-04-14", "upi", "MSW/1108"],
  ["exp-2002", "Annual report & audited accounts printing", "printing", 3200, "Sai Digital Prints", null, "2026-05-28", "upi", "SDP/1044"],
  ["exp-2003", "Receipt books & committee stationery", "printing", 1400, "Vidya Stationers", null, "2026-06-11", "cash", "VS/0771"],
  ["exp-2004", "First-aid box refill for the clubhouse", "maintenance", 1850, "Wellness Chemist", null, "2026-07-19", "upi", "WC/26/3390"],
];

type PhotoSeed = [caption: string];

/** Albums come with generated placeholder tiles; real uploads replace them. */
const albumSeeds: Array<{
  id: string;
  title: string;
  activityId: string | null;
  date: string;
  description: string;
  photos: PhotoSeed[];
}> = [
  {
    id: "alb-independence-2026",
    title: "Independence Day 2026",
    activityId: "act-independence-2026",
    date: "2026-08-15",
    description: "Flag hoisting at the main gate, followed by the children's patriotic song performance.",
    photos: [
      ["Flag hoisting by Mr. Shantaram Pawar, our senior-most resident"],
      ["Residents at the national anthem"],
      ["Children's patriotic song performance"],
      ["Wing A children with their tricolour badges"],
      ["Sweet distribution at the lobby"],
      ["The committee and volunteers"],
    ],
  },
  {
    id: "alb-tree-2026",
    title: "Monsoon Tree Plantation Drive",
    activityId: "act-tree-2026",
    date: "2026-07-12",
    description: "Sixty saplings along the compound wall, planted by residents across all four wings.",
    photos: [
      ["Volunteers assembling at 7:30 am"],
      ["First sapling going in near the D wing gate"],
      ["Children helping with the watering"],
      ["Tree guards being fixed along the compound wall"],
      ["The care roster families with their assigned saplings"],
    ],
  },
  {
    id: "alb-summer-camp-2026",
    title: "Summer Camp for Children",
    activityId: "act-summer-camp-2026",
    date: "2026-05-23",
    description: "Three weeks of swimming, chess, clay modelling and skating, closing with a talent show.",
    photos: [
      ["Swimming batch with Coach Nitin"],
      ["Clay modelling session in the clubhouse"],
      ["Chess finals in progress"],
      ["Skating practice on the podium"],
      ["Talent show — the dance group from B wing"],
      ["Certificate distribution on the closing day"],
    ],
  },
  {
    id: "alb-holi-2026",
    title: "Holi Celebration 2026",
    activityId: "act-holi-2026",
    date: "2026-03-03",
    description: "Organic colours, rain dance and a thandai counter on the central lawn.",
    photos: [
      ["The lawn just before the colours came out"],
      ["Rain dance under the sprinkler"],
      ["Organic gulal counter"],
      ["Thandai and puran poli stall"],
      ["The senior citizens' colour-free corner"],
      ["Children of C wing"],
      ["Group photo at the end of the morning"],
      ["Clean-up crew wrapping up"],
    ],
  },
  {
    id: "alb-sports-2026",
    title: "Annual Sports Day 2026",
    activityId: "act-sports-2026",
    date: "2026-02-22",
    description: "Three weekends of box cricket, badminton, carrom, chess and track events.",
    photos: [
      ["Box cricket final — A wing vs C wing"],
      ["Badminton doubles semi-final"],
      ["Carrom tournament in the clubhouse"],
      ["The 100 m dash for under-12s"],
      ["Chess round in progress"],
      ["Prize distribution dinner"],
      ["The overall champions from C wing"],
    ],
  },
  {
    id: "alb-republic-2026",
    title: "Republic Day 2026",
    activityId: "act-republic-2026",
    date: "2026-01-26",
    description: "Flag hoisting, a talk on the Constitution and a children's drawing competition.",
    photos: [
      ["Flag hoisting at 8 am"],
      ["Advocate Sujata Kadam speaking on the Constitution"],
      ["Drawing competition entries"],
      ["Prize winners of the drawing competition"],
      ["Tricolour decoration at the main gate"],
    ],
  },
  {
    id: "alb-ganesh-2025",
    title: "Ganesh Chaturthi 2025",
    activityId: "act-ganesh-2025",
    date: "2025-09-06",
    description: "Ten days of celebration, from the aagman procession to visarjan at Kharghar lake.",
    photos: [
      ["Aagman — welcoming the idol"],
      ["The completed mandap on day one"],
      ["Morning aarti"],
      ["Bhajan sandhya on day four"],
      ["Cultural programme — the children's dance"],
      ["Mahaprasad queue on day eight"],
      ["Decoration detail — the floral backdrop"],
      ["Visarjan procession leaving the society"],
      ["At Kharghar lake"],
    ],
  },
];

/**
 * The Janmashtami drive is the one currently running, so it shows the collector
 * workflow mid-flight: some entries already verified by the treasurer, some
 * still sitting with the volunteer who collected the cash.
 */
type DriveSeed = [
  id: string,
  donorName: string,
  wing: string,
  flat: string,
  amount: number,
  method: Donation["method"],
  receivedAt: string,
  collectedBy: string,
  status: Donation["status"],
  reference?: string,
];

const janmashtamiSeeds: DriveSeed[] = [
  // Verified — cash handed to the treasurer, or paid straight into the account.
  ["don-j01", "Rajesh Deshmukh", "A", "1204", 7500, "upi", "2026-08-09", ADMIN_TREASURER, "verified", "UPI/425108819021"],
  ["don-j02", "Meena Iyer", "B", "702", 7500, "upi", "2026-08-09", ADMIN_TREASURER, "verified", "UPI/425108819044"],
  ["don-j03", "Rohit Mehta", "C", "1405", 11000, "bank-transfer", "2026-08-10", ADMIN_TREASURER, "verified", "NEFT/AXIS0000912/2290", ],
  ["don-j04", "Farida Shaikh", "C", "1101", 2100, "cash", "2026-08-11", "mem-vikram", "verified"],
  ["don-j05", "Mohan Pillai", "C", "902", 3100, "cash", "2026-08-11", "mem-vikram", "verified"],
  ["don-j06", "Joseph Fernandes", "C", "608", 2100, "upi", "2026-08-11", "mem-vikram", "verified", "UPI/425308811902"],
  ["don-j07", "Neha Bhosale", "B", "1201", 2100, "cash", "2026-08-12", "mem-neha", "verified"],
  ["don-j08", "Anand Rao", "B", "406", 3100, "upi", "2026-08-12", "mem-neha", "verified", "UPI/425409934120"],
  ["don-j09", "Shalini Gupta", "B", "1104", 2100, "cash", "2026-08-12", "mem-neha", "verified"],
  ["don-j10", "Pooja Rane", "B", "504", 1100, "cash", "2026-08-13", "mem-neha", "verified"],
  ["don-j11", "Arif Khan", "A", "607", 7500, "upi", "2026-08-13", ADMIN_TREASURER, "verified", "UPI/425508844112"],
  ["don-j12", "Sunil Kulkarni", "A", "305", 2100, "upi", "2026-08-14", ADMIN_TREASURER, "verified", "UPI/425608819933"],
  ["don-j13", "Imran Qureshi", "D", "1503", 5100, "upi", "2026-08-14", "mem-joseph", "verified", "UPI/425611902288"],
  ["don-j14", "Priya Nair", "D", "802", 3100, "cash", "2026-08-15", "mem-joseph", "verified"],
  ["don-j15", "Sneha Patil", "D", "1102", 2100, "cash", "2026-08-15", "mem-joseph", "verified"],

  // Pending — collected door-to-door in the last two days, cash still with the
  // volunteer. Visible to everyone, but excluded from the balance until handover.
  ["don-j16", "Latha Subramanian", "A", "901", 3100, "cash", "2026-08-17", "mem-vikram", "pending"],
  ["don-j17", "Kavita Joshi", "A", "104", 1100, "cash", "2026-08-17", "mem-vikram", "pending"],
  ["don-j18", "Asha Kamble", "A", "402", 2100, "cash", "2026-08-17", "mem-vikram", "pending"],
  ["don-j19", "Ganesh Naik", "B", "308", 1100, "cash", "2026-08-18", "mem-neha", "pending"],
  ["don-j20", "Deepak Sawant", "D", "204", 3100, "cash", "2026-08-18", "mem-joseph", "pending"],
  ["don-j21", "Suresh Iyer", "D", "905", 2100, "cash", "2026-08-18", "mem-joseph", "pending"],
  ["don-j22", "Vikram Chauhan", "C", "204", 2100, "upi", "2026-08-18", "mem-vikram", "pending", "UPI/426008812201"],
];

function expandDrive(): Donation[] {
  return janmashtamiSeeds.map(
    (
      [id, donorName, wing, flat, amount, method, receivedAt, collectedBy, status, reference],
      i,
    ) => ({
      id,
      receiptNo: `WPC/2026-27/${String(i + 1).padStart(4, "0")}`,
      donorName,
      wing: wing || undefined,
      flat: flat || undefined,
      amount,
      method,
      activityId: "act-janmashtami-2026",
      receivedAt,
      reference,
      recordedBy: collectedBy,
      status,
      verifiedBy: status === "verified" ? ADMIN_TREASURER : undefined,
      verifiedAt: status === "verified" ? receivedAt : undefined,
      createdAt: receivedAt,
    }),
  );
}

function expandDonations(): Donation[] {
  const historic = donationSeeds.map(
    (
      [id, donorName, wing, flat, amount, method, activityId, receivedAt, reference, note],
      i,
    ) => ({
      id,
      // Historic entries carry the receipt series of their own financial year.
      receiptNo: `WPC/${financialYear(receivedAt)}/${String(i + 1).padStart(4, "0")}`,
      donorName,
      wing: wing || undefined,
      flat: flat || undefined,
      amount,
      method,
      activityId,
      receivedAt,
      reference,
      note,
      recordedBy: ADMIN_TREASURER,
      status: "verified" as const,
      verifiedBy: ADMIN_TREASURER,
      verifiedAt: receivedAt,
      createdAt: receivedAt,
    }),
  );
  return [...expandDrive(), ...historic];
}

function expandExpenses(): Expense[] {
  return expenseSeeds.map(
    ([id, title, category, amount, vendor, activityId, paidAt, method, billNo, note]) => ({
      id,
      title,
      category,
      amount,
      vendor,
      activityId,
      paidAt,
      method,
      billNo,
      note,
      recordedBy: ADMIN_TREASURER,
      createdAt: paidAt,
    }),
  );
}

function expandGallery(): { albums: Album[]; photos: Photo[] } {
  const albums: Album[] = [];
  const photos: Photo[] = [];
  for (const seed of albumSeeds) {
    albums.push({
      id: seed.id,
      title: seed.title,
      activityId: seed.activityId,
      date: seed.date,
      description: seed.description,
      createdAt: seed.date,
    });
    seed.photos.forEach(([caption], i) => {
      photos.push({
        id: `${seed.id}-p${String(i + 1).padStart(2, "0")}`,
        albumId: seed.id,
        caption,
        src: null,
        uploadedAt: seed.date,
      });
    });
  }
  return { albums, photos };
}

export function createSeedData(): SocietyData {
  const { albums, photos } = expandGallery();
  return {
    society: {
      name: "Wellington — Pride World City",
      address: "Pride World City, Charholi Budruk, Pune 412105",
      // Placeholder towers — set the real ones in Manage → Society details.
      wings: ["A", "B", "C", "D"],
      receiptPrefix: "WPC",
    },
    // Real societies upload the QR image their bank issued; the sample data has
    // none, so the app shows the "upload a QR" prompt.
    paymentQrs: [],
    members,
    activities,
    donations: expandDonations(),
    expenses: expandExpenses(),
    albums,
    photos,
  };
}
