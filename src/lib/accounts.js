const SUFFIX_MAP = {
  GB: ["Graham Brown"],
  JR: ["Joshua Raptis"],
  SM: ["Sara Marion"],
  RB: ["Reid Butcher"],
  RB1: ["Reid Butcher", "Grant Ellis", "Zachary Kuta", "Preston Swigart", "Madison Raak"],
  JD: ["John DeLeon"],
  EM1: ["Hunter Mills"],
};

export function getSuffix(name = "") {
  const m = name.match(/[-–]\s*([A-Z0-9]+)\s*$/);
  return m ? m[1].toUpperCase() : null;
}

export function autoMatchReps(accountName, userNames) {
  const suffix = getSuffix(accountName);
  if (!suffix || !SUFFIX_MAP[suffix]) return [];
  return SUFFIX_MAP[suffix].filter((n) => userNames.includes(n));
}

export const REP_PLACEHOLDER_PREFIX = "__rep_placeholder__";
export const HIDDEN_REP_PREFIX = "__hidden_rep__";

export function getHiddenReps(assignments = []) {
  return assignments
    .filter((a) => a.accountName?.startsWith(HIDDEN_REP_PREFIX))
    .map((a) => a.accountName.slice(HIDDEN_REP_PREFIX.length));
}

export function getAssignedReps(row) {
  if (Array.isArray(row.assignedReps)) return row.assignedReps;
  if (row.assignedRep) return [row.assignedRep];
  return [];
}