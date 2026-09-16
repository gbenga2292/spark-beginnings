export type VatMode = 'Yes' | 'No' | 'Add';
export type VatScope = 'overall' | 'per_section';
export type PartPaymentMethod = 'prorated' | 'vat_first' | 'principal_first';

export interface VatableSectionFlags {
  equipment: boolean;
  technicians: boolean;
  diesel: boolean;
  mobDemob: boolean;
  installation: boolean;
  damages: boolean;
}

export interface VatCalculatorParams {
  // Metadata & Context
  clientName: string;
  siteName: string;
  invoiceNumber: string;

  // Tax Setup
  vatMode: VatMode;
  vatRate: number; // e.g. 7.5
  vatScope: VatScope;
  vatableSections: VatableSectionFlags;

  // WHT Setup
  applyWht: boolean;
  whtRate: number; // e.g. 5 or 10

  // Input Mode
  useDetailedBreakdown: boolean;
  manualGrossAmount: number; // Single amount when not using breakdown

  // Equipment Breakdown
  noOfMachine: number;
  dailyRentalCost: number;
  equipmentDuration: number;
  equipmentRental: number;

  // Technicians Breakdown
  noOfTechnician: number;
  technicianDailyRate: number;
  technicianDuration: number;
  techniciansCost: number;

  // Diesel Breakdown
  dailyDieselUsage: number;
  dieselCostPerLtr: number;
  dieselDuration: number;
  dieselCost: number;

  // Other line items & auxiliary
  auxiliaryCost: number;
  mobDemob: number;
  installation: number;
  damages: number;
  discount: number;

  // Part Payment simulation
  paymentAmount: number;
  paymentMethod: PartPaymentMethod;
  paymentDamages: number;
  paymentWhtDeducted: number;
}

export interface SectionBreakdownItem {
  id: keyof VatableSectionFlags;
  label: string;
  grossAmount: number;
  discountAllocated: number;
  netAmount: number;
  isVatable: boolean;
  vatAmount: number;
}

export interface InvoiceVatComputationResult {
  subtotalCost: number;
  discount: number;
  netTotalCost: number;
  
  grossVatable: number;
  grossNonVatable: number;
  
  netVatableAmount: number;
  netNonVatableAmount: number;

  vat: number;
  totalCharge: number;
  effectiveVatRate: number;

  whtAmount: number;
  netReceivableAfterWht: number;

  sections: SectionBreakdownItem[];
}

export interface PartPaymentComputationResult {
  paymentAmount: number;
  paymentDamages: number;
  basePaymentAmount: number;
  paymentMethod: PartPaymentMethod;
  
  paymentVat: number;
  paymentVatableBase: number;
  paymentPrincipal: number;
  paymentEffectiveVatRate: number;

  paymentPercentageOfInvoice: number;
  remainingInvoiceBalance: number;
  remainingVatLiability: number;
  remainingPrincipal: number;

  isPaidInFull: boolean;
  isPartiallyPaid: boolean;
}

export const DEFAULT_VATABLE_SECTIONS: VatableSectionFlags = {
  equipment: true,
  technicians: false,
  diesel: true,
  mobDemob: true,
  installation: true,
  damages: false,
};


/**
 * Calculates the full invoice VAT, net receivable, and itemized sections
 */
export function computeInvoiceVat(params: VatCalculatorParams): InvoiceVatComputationResult {
  const {
    vatMode,
    vatRate,
    vatScope,
    vatableSections,
    applyWht,
    whtRate,
    useDetailedBreakdown,
    manualGrossAmount,
    noOfMachine,
    dailyRentalCost,
    equipmentDuration,
    equipmentRental,
    noOfTechnician,
    technicianDailyRate,
    technicianDuration,
    techniciansCost,
    dailyDieselUsage,
    dieselCostPerLtr,
    dieselDuration,
    dieselCost,
    auxiliaryCost,
    mobDemob,
    installation,
    damages,
    discount,
  } = params;

  if (!useDetailedBreakdown) {
    // Single manual gross entry mode
    const netTotalCost = Math.max(0, manualGrossAmount);
    let vat = 0;
    let netVatableAmount = 0;
    let netNonVatableAmount = 0;
    let totalCharge = netTotalCost;

    if (vatMode === 'Yes') {
      vat = Math.round(((netTotalCost / (100 + vatRate)) * vatRate) * 100) / 100;
      netVatableAmount = netTotalCost;
      totalCharge = netTotalCost;
    } else if (vatMode === 'Add') {
      vat = Math.round((netTotalCost * (vatRate / 100)) * 100) / 100;
      netVatableAmount = netTotalCost;
      totalCharge = netTotalCost + vat;
    } else {
      vat = 0;
      netVatableAmount = 0;
      netNonVatableAmount = netTotalCost;
      totalCharge = netTotalCost;
    }

    const effectiveVatRate = totalCharge > 0 ? Math.round((vat / totalCharge) * 10000) / 100 : 0;
    const whtAmount = applyWht ? Math.round((netVatableAmount * (whtRate / 100)) * 100) / 100 : 0;
    const netReceivableAfterWht = Math.max(0, totalCharge - whtAmount);

    return {
      subtotalCost: manualGrossAmount,
      discount: 0,
      netTotalCost,
      grossVatable: netVatableAmount,
      grossNonVatable: netNonVatableAmount,
      netVatableAmount,
      netNonVatableAmount,
      vat,
      totalCharge,
      effectiveVatRate,
      whtAmount,
      netReceivableAfterWht,
      sections: [],
    };
  }

  // Detailed breakdown mode - resolve duration product if values provided, else direct cost
  const effectiveRental = (noOfMachine > 0 && dailyRentalCost > 0 && equipmentDuration > 0)
    ? noOfMachine * dailyRentalCost * equipmentDuration
    : (equipmentRental || 0);

  const effectiveTechnicians = (noOfTechnician > 0 && technicianDailyRate > 0 && technicianDuration > 0)
    ? noOfTechnician * technicianDailyRate * technicianDuration
    : (techniciansCost || 0);

  const effectiveDiesel = (dailyDieselUsage > 0 && dieselCostPerLtr > 0 && dieselDuration > 0)
    ? dailyDieselUsage * dieselCostPerLtr * dieselDuration
    : (dieselCost || 0);

  const totalEquipment = effectiveRental + (auxiliaryCost || 0);
  const subtotalCost =
    totalEquipment +
    effectiveDiesel +
    effectiveTechnicians +
    (mobDemob || 0) +
    (installation || 0) +
    (damages || 0);

  const safeDiscount = Math.min(discount || 0, subtotalCost);
  const netTotalCost = Math.max(0, subtotalCost - safeDiscount);

  let vat = 0;
  let grossVatable = 0;
  let grossNonVatable = 0;
  let netVatableAmount = 0;
  let netNonVatableAmount = 0;
  let totalCharge = netTotalCost;

  const sectionRaw: { id: keyof VatableSectionFlags; label: string; amount: number; isVatable: boolean }[] = [
    { id: 'equipment', label: 'Equipment & Auxiliary Rental', amount: totalEquipment, isVatable: vatScope === 'overall' ? true : !!vatableSections.equipment },
    { id: 'technicians', label: 'Technicians Crew & Welfare', amount: effectiveTechnicians, isVatable: vatScope === 'overall' ? true : !!vatableSections.technicians },
    { id: 'diesel', label: 'Diesel Fuel Consumption', amount: effectiveDiesel, isVatable: vatScope === 'overall' ? true : !!vatableSections.diesel },
    { id: 'mobDemob', label: 'Mobilization & Demobilization', amount: mobDemob || 0, isVatable: vatScope === 'overall' ? true : !!vatableSections.mobDemob },
    { id: 'installation', label: 'Site Installation Services', amount: installation || 0, isVatable: vatScope === 'overall' ? true : !!vatableSections.installation },
    { id: 'damages', label: 'Damages & Repair Charges', amount: damages || 0, isVatable: vatScope === 'overall' ? false : !!vatableSections.damages },
  ];

  grossVatable = sectionRaw.filter((s) => s.isVatable).reduce((acc, s) => acc + s.amount, 0);
  grossNonVatable = Math.max(0, subtotalCost - grossVatable);

  if (vatMode === 'No') {
    vat = 0;
    netVatableAmount = 0;
    netNonVatableAmount = netTotalCost;
    totalCharge = netTotalCost;
  } else if (vatScope === 'overall') {
    netVatableAmount = netTotalCost;
    netNonVatableAmount = 0;
    if (vatMode === 'Yes') {
      vat = Math.round(((netTotalCost / (100 + vatRate)) * vatRate) * 100) / 100;
      totalCharge = netTotalCost;
    } else {
      // Add
      vat = Math.round((netTotalCost * (vatRate / 100)) * 100) / 100;
      totalCharge = netTotalCost + vat;
    }
  } else {
    // per_section
    let netVatable = grossVatable;
    let netNonVatable = grossNonVatable;

    if (safeDiscount > 0 && subtotalCost > 0) {
      const vatableRatio = grossVatable / subtotalCost;
      const vatableDiscount = safeDiscount * vatableRatio;
      const nonVatableDiscount = safeDiscount - vatableDiscount;
      netVatable = Math.max(0, grossVatable - vatableDiscount);
      netNonVatable = Math.max(0, grossNonVatable - nonVatableDiscount);
    }

    netVatableAmount = Math.round(netVatable * 100) / 100;
    netNonVatableAmount = Math.round(netNonVatable * 100) / 100;

    if (vatMode === 'Yes') {
      vat = Math.round(((netVatable / (100 + vatRate)) * vatRate) * 100) / 100;
      totalCharge = netTotalCost;
    } else {
      // Add
      vat = Math.round((netVatable * (vatRate / 100)) * 100) / 100;
      totalCharge = netTotalCost + vat;
    }
  }

  // Section itemized breakdown with pro-rated discount and VAT
  const sections: SectionBreakdownItem[] = sectionRaw.map((s) => {
    const ratio = subtotalCost > 0 ? s.amount / subtotalCost : 0;
    const secDiscount = safeDiscount * ratio;
    const netAmount = Math.max(0, s.amount - secDiscount);
    let secVat = 0;

    if (s.isVatable && vatMode !== 'No') {
      if (vatMode === 'Yes') {
        secVat = Math.round(((netAmount / (100 + vatRate)) * vatRate) * 100) / 100;
      } else {
        secVat = Math.round((netAmount * (vatRate / 100)) * 100) / 100;
      }
    }

    return {
      id: s.id,
      label: s.label,
      grossAmount: s.amount,
      discountAllocated: Math.round(secDiscount * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      isVatable: s.isVatable,
      vatAmount: secVat,
    };
  });

  const effectiveVatRate = totalCharge > 0 ? Math.round((vat / totalCharge) * 10000) / 100 : 0;
  const whtAmount = applyWht ? Math.round((netVatableAmount * (whtRate / 100)) * 100) / 100 : 0;
  const netReceivableAfterWht = Math.max(0, totalCharge - whtAmount);

  return {
    subtotalCost,
    discount: safeDiscount,
    netTotalCost,
    grossVatable,
    grossNonVatable,
    netVatableAmount,
    netNonVatableAmount,
    vat,
    totalCharge,
    effectiveVatRate,
    whtAmount,
    netReceivableAfterWht,
    sections,
  };
}

/**
 * Computes part-payment VAT allocation, remaining balance, and principal
 */
export function computePartPaymentVat(
  invoiceResult: InvoiceVatComputationResult,
  paymentAmount: number,
  method: PartPaymentMethod,
  paymentDamages: number = 0
): PartPaymentComputationResult {
  const basePaymentAmount = Math.max(0, paymentAmount - (paymentDamages || 0));
  const totalCharge = invoiceResult.totalCharge;
  const totalVat = invoiceResult.vat;
  const vatableAmount = invoiceResult.netVatableAmount;
  const principal = Math.max(0, totalCharge - totalVat);

  let paymentVat = 0;
  let paymentVatableBase = 0;
  let paymentPrincipal = 0;

  if (basePaymentAmount <= 0 || totalCharge <= 0 || totalVat <= 0) {
    paymentVat = 0;
    paymentVatableBase = 0;
    paymentPrincipal = basePaymentAmount;
  } else if (method === 'prorated') {
    // Pro-rated standard allocation (DCEL audited formula)
    const ratio = totalVat / totalCharge;
    paymentVat = Math.min(totalVat, Math.round((basePaymentAmount * ratio) * 100) / 100);
    const vatableRatio = vatableAmount / totalCharge;
    paymentVatableBase = Math.min(vatableAmount, Math.round((basePaymentAmount * vatableRatio) * 100) / 100);
    paymentPrincipal = Math.max(0, basePaymentAmount - paymentVat);
  } else if (method === 'vat_first') {
    // Cash received covers VAT obligation first
    paymentVat = Math.min(basePaymentAmount, totalVat);
    paymentPrincipal = Math.max(0, basePaymentAmount - paymentVat);
    if (totalVat > 0) {
      paymentVatableBase = Math.min(vatableAmount, Math.round(((paymentVat / totalVat) * vatableAmount) * 100) / 100);
    } else {
      paymentVatableBase = 0;
    }
  } else if (method === 'principal_first') {
    // Cash received covers Principal / Net service first
    if (basePaymentAmount <= principal) {
      paymentPrincipal = basePaymentAmount;
      paymentVat = 0;
      paymentVatableBase = 0;
    } else {
      paymentPrincipal = principal;
      paymentVat = Math.min(basePaymentAmount - principal, totalVat);
      if (totalVat > 0) {
        paymentVatableBase = Math.min(vatableAmount, Math.round(((paymentVat / totalVat) * vatableAmount) * 100) / 100);
      } else {
        paymentVatableBase = 0;
      }
    }
  }

  paymentVat = Math.round(paymentVat * 100) / 100;
  paymentVatableBase = Math.round(paymentVatableBase * 100) / 100;
  paymentPrincipal = Math.round(paymentPrincipal * 100) / 100;

  const paymentPercentageOfInvoice = totalCharge > 0
    ? Math.min(100, Math.round((paymentAmount / totalCharge) * 10000) / 100)
    : 0;

  const remainingInvoiceBalance = Math.max(0, Math.round((totalCharge - paymentAmount) * 100) / 100);
  const remainingVatLiability = Math.max(0, Math.round((totalVat - paymentVat) * 100) / 100);
  const remainingPrincipal = Math.max(0, Math.round((principal - paymentPrincipal) * 100) / 100);

  const paymentEffectiveVatRate = basePaymentAmount > 0
    ? Math.round((paymentVat / basePaymentAmount) * 10000) / 100
    : 0;

  return {
    paymentAmount,
    paymentDamages: paymentDamages || 0,
    basePaymentAmount,
    paymentMethod: method,
    paymentVat,
    paymentVatableBase,
    paymentPrincipal,
    paymentEffectiveVatRate,
    paymentPercentageOfInvoice,
    remainingInvoiceBalance,
    remainingVatLiability,
    remainingPrincipal,
    isPaidInFull: remainingInvoiceBalance <= 0 && paymentAmount > 0,
    isPartiallyPaid: paymentAmount > 0 && remainingInvoiceBalance > 0,
  };
}
