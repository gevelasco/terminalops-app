import type {
  Operator,
  OperatorEmergencyContact,
  OperatorPrivateInsurance,
  OperatorPublicInsurance,
} from '@shared/models/logistics.models';

function pickEmergencyContact(
  contact: OperatorEmergencyContact | undefined,
): OperatorEmergencyContact | undefined {
  if (!contact) {
    return undefined;
  }
  return {
    name: contact.name,
    relationship: contact.relationship,
    phone: contact.phone,
    email: contact.email,
    authorizedMedicalInfo: contact.authorizedMedicalInfo === true,
  };
}

function pickPublicInsurance(
  insurance: OperatorPublicInsurance | undefined,
): OperatorPublicInsurance | undefined {
  if (!insurance) {
    return undefined;
  }
  return {
    nss: insurance.nss,
    imssAltaDate: insurance.imssAltaDate,
    infonavit: insurance.infonavit === true,
    infonavitCreditNumber: insurance.infonavitCreditNumber,
    fonacot: insurance.fonacot === true,
    fonacotCreditNumber: insurance.fonacotCreditNumber,
    notes: insurance.notes,
  };
}

function pickPrivateInsurance(
  insurance: OperatorPrivateInsurance | undefined,
): OperatorPrivateInsurance | undefined {
  if (!insurance) {
    return undefined;
  }
  return {
    carrier: insurance.carrier,
    policyNumber: insurance.policyNumber,
    validFrom: insurance.validFrom,
    validTo: insurance.validTo,
    premiumAmount: insurance.premiumAmount,
    premiumPeriod: insurance.premiumPeriod,
    deductibleNotes: insurance.deductibleNotes,
    planSummary: insurance.planSummary,
  };
}

/**
 * Campos escribibles del operador (alineado a CreateOperatorDto).
 * Omite `id`, `status`, `documents`, `hasPhoto` y agregados de lista.
 */
export function buildOperatorWritePayload(
  operator: Operator | Omit<Operator, 'id'>,
): Record<string, unknown> {
  return {
    name: operator.name,
    isActive: operator.isActive !== false,
    birthDate: operator.birthDate,
    curp: operator.curp,
    rfc: operator.rfc,
    licenseNumber: operator.licenseNumber,
    licenseExpiresOn: operator.licenseExpiresOn,
    licenseType: operator.licenseType,
    licenseEndorsements: operator.licenseEndorsements,
    phone: operator.phone,
    phoneSecondary: operator.phoneSecondary,
    address: operator.address,
    photoDataUrl: operator.photoDataUrl,
    companyHireDate: operator.companyHireDate,
    employmentContractType: operator.employmentContractType,
    paymentSchedule: operator.paymentSchedule,
    ...(operator.paymentSchedule === 'weekly'
      ? { weeklyPayDay: operator.weeklyPayDay?.trim() || 'fri' }
      : { weeklyPayDay: null }),
    paymentMethod: operator.paymentMethod,
    insuranceKind: operator.insuranceKind,
    emergencyContact: pickEmergencyContact(operator.emergencyContact),
    publicInsurance: pickPublicInsurance(operator.publicInsurance),
    privateInsurance: pickPrivateInsurance(operator.privateInsurance),
  };
}

/**
 * Body de alta: mismos campos del operador.
 * Los binarios se suben con POST /operators/:id/documents (no van en este JSON).
 */
export function buildOperatorCreatePayload(
  operator: Omit<Operator, 'id'>,
): Record<string, unknown> {
  return buildOperatorWritePayload(operator);
}

/**
 * PATCH operador: allowlist de campos escribibles
 * (sin `status`, `documents` ni métricas de listado).
 */
export function buildOperatorPatchPayload(
  operator: Operator,
): Record<string, unknown> {
  return buildOperatorWritePayload(operator);
}
