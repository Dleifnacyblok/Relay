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

export function getAssignedReps(row) {
  if (Array.isArray(row.assignedReps)) return row.assignedReps;
  if (row.assignedRep) return [row.assignedRep];
  return [];
}