/**
 * useLogisticsCalculator — Pure cost calculation hook for logistics mobilisation & installation estimates.
 *
 * All formulas here are deterministic: same inputs → same outputs.
 * No side-effects, no API calls, no store mutations.
 */

export interface LogisticsInputs {
  // Route
  distance: number;          // km
  travelTime: number;        // hours (from map or manual)
  trafficFactor: number;     // 0 – 0.30 (e.g. 0.15 = 15% slower/more fuel)

  // Fuel / Diesel
  fuelPricePerLitre: number; // ₦
  fuelEfficiency: number;    // km per litre

  // Driver
  driverWagePerHour: number; // ₦
  travelSpeed: number;       // km/h (average, used if travelTime not available)

  // Maintenance
  maintenanceCostPerKm: number; // ₦

  // Tolls, Admin & Insurance
  tolls: number;             // ₦ (manual flat)
  insurance: number;         // ₦ (manual flat)
  securityEscorts: number;   // ₦ (manual flat)
  communityLevies: number;   // ₦ (manual flat)

  // Equipment Handling
  equipmentHandlingCost: number; // ₦ (Loading/unloading, crane, forklift)

  // Accommodation
  accommodationRequired: boolean;
  perDiemRate: number;       // ₦ per person per day
  crewSize: number;

  // Installation
  headersToInstall: number;
  headersPerDay: number;     // productivity rate
  selectedTechnicians: { id: string; name: string; dailyRate: number }[];
  installationFuelCost: number; // ₦ fuel used specifically for the installation operation
  installationOtherExpenses: number; // ₦ any other installation-related expenses

  // Equipment
  equipmentRentalPerDay: number; // ₦
  equipmentRentalDays: number;

  // Contingency
  contingencyPercent: number; // 0 – 30

  // Trip Configuration
  numberOfVehicles: number;
  tripType: 'one_way' | 'mobilisation_only' | 'full_lifecycle';
}

export interface LogisticsEstimate {
  // Route
  distance: number;
  travelTimeHours: number;
  trafficFactor: number;

  // Transport totals (for UI display of fuel/driver/maint lines)
  fuelCost: number;
  driverCost: number;
  maintenanceCost: number;
  tollsInsuranceAdmin: number;
  equipmentHandlingCost: number;

  // Subtotals
  mobilisationSubtotal: number;
  demobilisationSubtotal: number;

  // Installation breakdown
  installDays: number;
  laborCost: number;
  equipmentCost: number;
  accommodationCost: number;
  installationFuelCost: number;
  installationOtherExpenses: number;
  installationSubtotal: number;

  // Totals
  contingencyAmount: number;
  grandTotal: number;

  // Trip Config
  tripMultiplier: number; // Total legs (1, 2, or 4)
  numberOfVehicles: number;
}

const DEFAULTS: LogisticsInputs = {
  distance: 0,
  travelTime: 0,
  trafficFactor: 0.10,
  fuelPricePerLitre: 800,
  fuelEfficiency: 10,
  driverWagePerHour: 3000,
  travelSpeed: 50,
  maintenanceCostPerKm: 50,
  tolls: 0,
  insurance: 0,
  securityEscorts: 0,
  communityLevies: 0,
  equipmentHandlingCost: 0,
  accommodationRequired: false,
  perDiemRate: 15000,
  crewSize: 2,
  headersToInstall: 0,
  headersPerDay: 4,
  selectedTechnicians: [],
  installationFuelCost: 0,
  installationOtherExpenses: 0,
  equipmentRentalPerDay: 0,
  equipmentRentalDays: 0,
  contingencyPercent: 10,
  numberOfVehicles: 1,
  tripType: 'mobilisation_only',
};

export function getDefaults(): LogisticsInputs {
  return { ...DEFAULTS };
}

export function calculateLogistics(input: LogisticsInputs): LogisticsEstimate {
  let tripMultiplier = 2; // mobilisation_only
  if (input.tripType === 'one_way') tripMultiplier = 1;
  else if (input.tripType === 'full_lifecycle') tripMultiplier = 4;

  const d = Math.max(0, input.distance);
  const tf = Math.min(0.5, Math.max(0, input.trafficFactor));
  const vehicles = Math.max(1, input.numberOfVehicles);

  // ── Transport (Per Leg) ──────────────────────────────────────
  const effectiveEfficiency = Math.max(0.1, input.fuelEfficiency * (1 - tf));
  const litresPerLeg = d / effectiveEfficiency;
  const fuelPerLeg = litresPerLeg * Math.max(0, input.fuelPricePerLitre) * vehicles;

  let hoursPerLeg: number;
  if (input.travelTime > 0) {
    hoursPerLeg = input.travelTime * (1 + tf);
  } else {
    const effectiveSpeed = Math.max(1, input.travelSpeed * (1 - tf));
    hoursPerLeg = d / effectiveSpeed;
  }
  const driverPerLeg = hoursPerLeg * Math.max(0, input.driverWagePerHour) * vehicles;

  const maintPerLeg = d * Math.max(0, input.maintenanceCostPerKm) * (1 + tf * 0.05) * vehicles;

  // ── Admin & Handling (Per Event) ──────────────────────────
  const adminPerEvent = Math.max(0, input.tolls) + Math.max(0, input.insurance) + Math.max(0, input.securityEscorts) + Math.max(0, input.communityLevies);
  const handlingPerEvent = Math.max(0, input.equipmentHandlingCost);

  // ── Mobilisation vs Demobilisation Subtotals ──────────────
  const legsMob = input.tripType === 'one_way' ? 1 : 2;
  const legsDemob = input.tripType === 'full_lifecycle' ? 2 : 0;
  const numEvents = input.tripType === 'full_lifecycle' ? 2 : 1;

  const mobTransport = (fuelPerLeg + driverPerLeg + maintPerLeg) * legsMob;
  const mobilisationSubtotal = mobTransport + adminPerEvent + handlingPerEvent;

  let demobilisationSubtotal = 0;
  if (input.tripType === 'full_lifecycle') {
     const demobTransport = (fuelPerLeg + driverPerLeg + maintPerLeg) * legsDemob;
     demobilisationSubtotal = demobTransport + adminPerEvent + handlingPerEvent;
  }

  // ── Installation ──────────────────────────────────────
  const hpd = Math.max(1, input.headersPerDay);
  const installDays = input.headersToInstall > 0
    ? Math.ceil(input.headersToInstall / hpd)
    : 0;

  const totalDailyRate = input.selectedTechnicians.reduce((sum, tech) => sum + Math.max(0, tech.dailyRate), 0);
  const laborCost = totalDailyRate * installDays;

  const equipmentCost = Math.max(0, input.equipmentRentalPerDay) *
    Math.max(0, input.equipmentRentalDays);

  const accommodationCost = input.accommodationRequired
    ? Math.max(0, input.perDiemRate) * Math.max(0, input.crewSize) * Math.max(installDays, 1)
    : 0;

  const installationFuelCost = Math.max(0, input.installationFuelCost);
  const installationOtherExpenses = Math.max(0, input.installationOtherExpenses);

  const installationSubtotal = laborCost + equipmentCost + accommodationCost + installationFuelCost + installationOtherExpenses;

  // ── Contingency ───────────────────────────────────────
  const cp = Math.min(100, Math.max(0, input.contingencyPercent)) / 100;
  const contingencyAmount = (mobilisationSubtotal + demobilisationSubtotal + installationSubtotal) * cp;

  const grandTotal = mobilisationSubtotal + demobilisationSubtotal + installationSubtotal + contingencyAmount;

  return {
    distance: d * tripMultiplier,
    travelTimeHours: hoursPerLeg * tripMultiplier,
    trafficFactor: tf,
    fuelCost: fuelPerLeg * tripMultiplier,
    driverCost: driverPerLeg * tripMultiplier,
    maintenanceCost: maintPerLeg * tripMultiplier,
    tollsInsuranceAdmin: adminPerEvent * numEvents,
    equipmentHandlingCost: handlingPerEvent * numEvents,
    mobilisationSubtotal,
    demobilisationSubtotal,
    installDays,
    laborCost,
    equipmentCost,
    accommodationCost,
    installationFuelCost,
    installationOtherExpenses,
    installationSubtotal,
    contingencyAmount,
    grandTotal,
    tripMultiplier,
    numberOfVehicles: vehicles,
  };
}
