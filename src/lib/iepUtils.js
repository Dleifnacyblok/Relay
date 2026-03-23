// IEP Set IDs from the official tracking list image
// These are the Set IDs (left column) from the IEP tracking spreadsheet
const IEP_SET_IDS = new Set([
  // Globus
  "9124.9001", "984.907", "9128.9021", "9136.9002", "9136.9007",
  "965.902", "965.952", "9119.9001", "9119.901", "9120.9014",
  "9192.92", "9134.9001", "9146.9001", "9120.9001", "9122.9001",
  "9211.9001", "9212.9001", "9135.9003", "9149.9001", "9194.906",
  "924.902", "985.902", "993.905", "993.919", "9172.9003",
  // Nuvasive (alphanumeric)
  "ACPINS", "BENDCAMERA", "COHERCRVIMP2", "COHERETLIFOCOREINS",
  "COHEREXL10", "ALPMODEXPLINS", "MDLUSALIFIMP3828", "MDLUSCRVINS",
  "MDLUSTLIFACOREINS", "MDLUSTLIFOCOREINS", "MDLUSXL10", "NVM5MULTI",
  "RELMASCORIMP", "RELMASFENCOREIN", "RELMASMOD", "RELMASREDMOD",
  "RELMASREDIMP", "RELCOREIMPP", "RELTRACCOREIMP", "RELCCOREINS1",
  "SIMPNUVAINS", "TLX20IMP",
]);

// Also match by prefix — loaner setIds like "RELNAVSPOLYLN" contain "RELNAV"
// We use startsWith against the IEP prefixes
const IEP_PREFIXES = [
  "9124.", "984.", "9128.", "9136.", "965.", "9119.", "9120.", "9192.",
  "9134.", "9146.", "9122.", "9211.", "9212.", "9135.", "9149.", "9194.",
  "924.", "985.", "993.", "9172.",
  "ACPINS", "BENDCAM", "COHERCRV", "COHERETLIF", "COHEREXL", "ALPMODEX",
  "MDLUSALIF", "MDLUSCRV", "MDLUSTLIFA", "MDLUSTLIFO", "MDLUSXL",
  "NVM5", "RELMASC", "RELMASFEN", "RELMASMOD", "RELMASRED", "RELCOREIMP",
  "RELTRAC", "RELCCORE", "SIMPNUVA", "TLX20",
];

/**
 * Returns true if the loaner's setId matches an IEP-tracked set.
 * Matches exact Set ID OR starts with a known IEP prefix.
 */
export function isIEPLoaner(loaner) {
  const sid = (loaner?.setId || "").trim().toUpperCase();
  if (!sid) return false;
  if (IEP_SET_IDS.has(sid)) return true;
  return IEP_PREFIXES.some(prefix => sid.startsWith(prefix.toUpperCase()));
}