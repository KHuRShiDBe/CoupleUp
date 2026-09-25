// BOND is a display/denomination layer over the points ledger -- never a
// separate balance. points-per-BOND is the only variable (the weekly rate);
// BOND itself is always displayed at a fixed 1 BOND ~= $1 peg.
export const DEFAULT_POINTS_PER_BOND = 100;

export const pointsToBond = (points: number, pointsPerBond: number = DEFAULT_POINTS_PER_BOND): number =>
  points / pointsPerBond;

export const bondToPoints = (bond: number, pointsPerBond: number = DEFAULT_POINTS_PER_BOND): number =>
  bond * pointsPerBond;

export const formatBond = (bond: number): string => bond.toFixed(2);

// 1 BOND ~= $1 -- USD equivalent is just the BOND amount, currency-formatted.
export const formatUsd = (bond: number): string => `$${bond.toFixed(2)}`;

export const BOND_DENOMINATIONS = [1, 5, 10, 20, 50, 100] as const;
