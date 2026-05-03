export type ClientStatus = "Current" | "Due Soon" | "Overdue" | "Archived";
export type ClientType = "Corporation" | "LLC" | "S-Corp" | "Partnership" | "Trust";

export interface ClientRow {
  id: string;
  name: string;
  ein: string;
  type: ClientType;
  state: "WI" | "IL" | "MN" | "IA" | "MI";
  inc: string;
  fye: string;
  status: ClientStatus;
}

const seed: ClientRow[] = [
  { id: "abc-inc", name: "ABC Inc.", ein: "47-2938471", type: "Corporation", state: "WI", inc: "—", fye: "Dec 31", status: "Current" },
  { id: "abc-llc", name: "ABC, LLC", ein: "88-5512003", type: "LLC", state: "WI", inc: "01/01/2025", fye: "Dec 31", status: "Current" },
  { id: "acme-holdings", name: "Acme Holdings", ein: "32-1178892", type: "S-Corp", state: "IL", inc: "03/04/2019", fye: "Dec 31", status: "Due Soon" },
  { id: "birchwood-capital", name: "Birchwood Capital", ein: "56-7823910", type: "LLC", state: "MN", inc: "06/12/2021", fye: "Dec 31", status: "Current" },
  { id: "cedar-stone", name: "Cedar & Stone Co.", ein: "21-4490023", type: "Corporation", state: "WI", inc: "09/02/2017", fye: "Jun 30", status: "Overdue" },
  { id: "delta-ventures", name: "Delta Ventures", ein: "84-0029315", type: "LLC", state: "IL", inc: "02/18/2023", fye: "Dec 31", status: "Current" },
  { id: "everline-partners", name: "Everline Partners", ein: "13-7745220", type: "Partnership", state: "MN", inc: "11/05/2020", fye: "Dec 31", status: "Current" },
  { id: "foxglove-studios", name: "Foxglove Studios", ein: "67-3380094", type: "S-Corp", state: "WI", inc: "07/22/2018", fye: "Dec 31", status: "Current" },
  { id: "greystone-logistics", name: "Greystone Logistics", ein: "99-1245678", type: "Corporation", state: "IA", inc: "04/30/2015", fye: "Dec 31", status: "Current" },
  { id: "harborlight-trust", name: "Harborlight Trust", ein: "45-9911220", type: "Trust", state: "MI", inc: "08/14/2022", fye: "Dec 31", status: "Archived" },
];

const more: ClientRow[] = [
  { id: "ironwood-mfg", name: "Ironwood Manufacturing", ein: "27-3344521", type: "Corporation", state: "WI", inc: "05/11/2014", fye: "Dec 31", status: "Current" },
  { id: "juniper-realty", name: "Juniper Realty", ein: "55-8821093", type: "LLC", state: "IL", inc: "10/03/2016", fye: "Dec 31", status: "Current" },
  { id: "kestrel-group", name: "Kestrel Group", ein: "62-1190028", type: "S-Corp", state: "MN", inc: "01/22/2020", fye: "Mar 31", status: "Current" },
  { id: "linden-advisors", name: "Linden Advisors", ein: "71-4408815", type: "Partnership", state: "IA", inc: "07/09/2019", fye: "Dec 31", status: "Current" },
  { id: "marigold-co", name: "Marigold & Co.", ein: "39-6620041", type: "Corporation", state: "MI", inc: "12/14/2013", fye: "Dec 31", status: "Current" },
  { id: "northgate-llc", name: "Northgate Holdings", ein: "82-3091287", type: "LLC", state: "WI", inc: "03/30/2022", fye: "Dec 31", status: "Current" },
  { id: "oakridge-systems", name: "Oakridge Systems", ein: "44-7712234", type: "Corporation", state: "IL", inc: "08/19/2018", fye: "Dec 31", status: "Current" },
  { id: "pinecrest-trust", name: "Pinecrest Trust", ein: "31-2098874", type: "Trust", state: "MN", inc: "06/01/2017", fye: "Dec 31", status: "Current" },
  { id: "quail-hollow", name: "Quail Hollow LLC", ein: "59-4421900", type: "LLC", state: "IA", inc: "04/24/2021", fye: "Dec 31", status: "Current" },
  { id: "rivermark", name: "Rivermark Capital", ein: "16-3382207", type: "S-Corp", state: "MI", inc: "09/15/2016", fye: "Dec 31", status: "Current" },
  { id: "summit-co", name: "Summit Logistics Co.", ein: "73-5500988", type: "Corporation", state: "WI", inc: "02/02/2012", fye: "Dec 31", status: "Current" },
  { id: "tideline-llc", name: "Tideline LLC", ein: "41-7723114", type: "LLC", state: "IL", inc: "11/27/2020", fye: "Dec 31", status: "Current" },
  { id: "umber-partners", name: "Umber Partners", ein: "28-9912034", type: "Partnership", state: "MN", inc: "05/05/2015", fye: "Dec 31", status: "Current" },
  { id: "vellum-corp", name: "Vellum Corp", ein: "37-2230994", type: "Corporation", state: "IA", inc: "10/10/2010", fye: "Dec 31", status: "Current" },
  { id: "westfield-llc", name: "Westfield LLC", ein: "65-1190077", type: "LLC", state: "MI", inc: "01/15/2024", fye: "Dec 31", status: "Current" },
  { id: "yarrow-holdings", name: "Yarrow Holdings", ein: "92-4408190", type: "S-Corp", state: "WI", inc: "08/30/2019", fye: "Dec 31", status: "Current" },
  { id: "zephyr-trust", name: "Zephyr Trust", ein: "12-7700554", type: "Trust", state: "IL", inc: "12/22/2021", fye: "Dec 31", status: "Current" },
  { id: "ashford-co", name: "Ashford & Co.", ein: "48-3320019", type: "Corporation", state: "MN", inc: "03/14/2016", fye: "Dec 31", status: "Current" },
  { id: "brixton-llc", name: "Brixton LLC", ein: "53-8821190", type: "LLC", state: "IA", inc: "06/06/2022", fye: "Dec 31", status: "Current" },
  { id: "calder-partners", name: "Calder Partners", ein: "67-1129044", type: "Partnership", state: "MI", inc: "11/18/2017", fye: "Dec 31", status: "Current" },
  { id: "drexel-systems", name: "Drexel Systems", ein: "29-7740066", type: "Corporation", state: "WI", inc: "07/04/2013", fye: "Dec 31", status: "Current" },
  { id: "ember-co", name: "Ember Capital Co.", ein: "84-3382209", type: "S-Corp", state: "IL", inc: "02/28/2020", fye: "Dec 31", status: "Current" },
  { id: "fenway-llc", name: "Fenway LLC", ein: "76-2208891", type: "LLC", state: "MN", inc: "09/09/2018", fye: "Dec 31", status: "Current" },
  { id: "glenwood-trust", name: "Glenwood Trust", ein: "33-4490221", type: "Trust", state: "IA", inc: "05/22/2019", fye: "Dec 31", status: "Archived" },
  { id: "halcyon-corp", name: "Halcyon Corp", ein: "58-1190994", type: "Corporation", state: "MI", inc: "10/12/2014", fye: "Dec 31", status: "Current" },
  { id: "indigo-llc", name: "Indigo LLC", ein: "41-2280977", type: "LLC", state: "WI", inc: "01/30/2023", fye: "Dec 31", status: "Current" },
  { id: "juno-partners", name: "Juno Partners", ein: "26-7700228", type: "Partnership", state: "IL", inc: "08/14/2016", fye: "Dec 31", status: "Archived" },
  { id: "kiln-holdings", name: "Kiln Holdings", ein: "79-3308812", type: "S-Corp", state: "MN", inc: "04/18/2017", fye: "Dec 31", status: "Archived" },
  { id: "lyric-co", name: "Lyric Co.", ein: "62-4419028", type: "Corporation", state: "IA", inc: "11/01/2011", fye: "Dec 31", status: "Archived" },
  { id: "mosaic-llc", name: "Mosaic LLC", ein: "35-8800117", type: "LLC", state: "MI", inc: "12/05/2022", fye: "Dec 31", status: "Archived" },
];

export const v2Clients: ClientRow[] = [...seed, ...more];

export const v2Counts = {
  active: v2Clients.filter((c) => c.status !== "Archived").length,
  archived: v2Clients.filter((c) => c.status === "Archived").length,
  needAttention: v2Clients.filter((c) => c.status === "Overdue" || c.status === "Due Soon").length,
};
