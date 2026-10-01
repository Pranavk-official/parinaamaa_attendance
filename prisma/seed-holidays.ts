import { prisma } from "./seed-common";

// Kerala government public holidays 2026: GAD notification G.O.(P) No. 15/2025/GAD
// (Gazette Ext. No. 3846, 31 Oct 2025), plus later orders (Bakrid 2nd day,
// Muharram moved to 26 Jun) and the general holidays outside the NI Act list.
// Sunday entries are kept so they still show on the calendar.
// Add the 2027 list here once the government notifies it (usually Oct-Nov).
const KERALA_2026: [string, string][] = [
  ["2026-01-02", "Mannam Jayanthi"],
  ["2026-01-26", "Republic Day"],
  ["2026-02-15", "Maha Shivaratri"],
  ["2026-03-20", "Id-ul-Fitr (Ramzan)"],
  ["2026-04-02", "Maundy Thursday"],
  ["2026-04-03", "Good Friday"],
  ["2026-04-05", "Easter"],
  ["2026-04-09", "Assembly Election (polling day)"],
  ["2026-04-14", "Dr. B. R. Ambedkar Jayanthi"],
  ["2026-04-15", "Vishu"],
  ["2026-05-01", "May Day"],
  ["2026-05-27", "Id-ul-Adha (Bakrid)"],
  ["2026-05-28", "Id-ul-Adha (Bakrid), additional day"],
  ["2026-06-26", "Muharram"],
  ["2026-08-12", "Karkidaka Vavu"],
  ["2026-08-15", "Independence Day"],
  ["2026-08-25", "First Onam / Milad-i-Sherif"],
  ["2026-08-26", "Thiruvonam"],
  ["2026-08-27", "Third Onam"],
  ["2026-08-28", "Fourth Onam / Sree Narayana Guru Jayanthi / Ayyankali Jayanthi"],
  ["2026-09-04", "Sreekrishna Jayanthi"],
  ["2026-09-21", "Sree Narayana Guru Samadhi"],
  ["2026-10-02", "Gandhi Jayanthi"],
  ["2026-10-20", "Mahanavami"],
  ["2026-10-21", "Vijayadasami"],
  ["2026-11-08", "Deepavali"],
  ["2026-12-25", "Christmas"],
];

const MARKER = "seed:keralaHolidays2026";

/** Once ever, per list: a holiday an admin later deletes stays deleted. */
export async function seedHolidays() {
  if (await prisma.setting.findUnique({ where: { key: MARKER } })) return;
  const { count } = await prisma.companyHoliday.createMany({
    data: KERALA_2026.map(([d, name]) => ({ date: new Date(`${d}T00:00:00Z`), name })),
    skipDuplicates: true, // dates an admin already set keep their name
  });
  await prisma.setting.create({ data: { key: MARKER, value: new Date().toISOString() } });
  console.log(`Kerala holidays seeded (${count} new)`);
}
