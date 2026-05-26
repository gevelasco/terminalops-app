import type {
  Operator,
  OperatorEmergencyContact,
  OperatorPrivateInsurance,
  OperatorPublicInsurance,
} from '@shared/models/logistics.models';

export const EMPTY_EMERGENCY: OperatorEmergencyContact = {
  name: '',
  relationship: '',
  phone: '',
  email: '',
  authorizedMedicalInfo: false,
};

export const EMPTY_PUBLIC: OperatorPublicInsurance = {
  nss: '',
  imssAltaDate: '',
  infonavit: false,
  infonavitCreditNumber: '',
  fonacot: false,
  fonacotCreditNumber: '',
  notes: '',
};

export const EMPTY_PRIVATE: OperatorPrivateInsurance = {
  carrier: '',
  policyNumber: '',
  validFrom: '',
  validTo: '',
  premiumAmount: '',
  premiumPeriod: '',
  deductibleNotes: '',
  planSummary: '',
};

/** Une anidados con valores por defecto (mock / formularios). */
export function mergeOperatorNested<
  T extends {
    emergencyContact?: OperatorEmergencyContact;
    publicInsurance?: OperatorPublicInsurance;
    privateInsurance?: OperatorPrivateInsurance;
  },
>(p: T): T {
  return {
    ...p,
    emergencyContact: {
      ...EMPTY_EMERGENCY,
      ...p.emergencyContact,
    },
    publicInsurance: {
      ...EMPTY_PUBLIC,
      ...p.publicInsurance,
    },
    privateInsurance: {
      ...EMPTY_PRIVATE,
      ...p.privateInsurance,
    },
  };
}

export function defaultOperatorShell(
  core: Pick<
    Operator,
    | 'id'
    | 'name'
    | 'licenseNumber'
    | 'licenseExpiresOn'
    | 'phone'
    | 'status'
  > &
    Partial<Omit<Operator, 'id' | 'name' | 'licenseNumber' | 'licenseExpiresOn' | 'phone' | 'status'>>,
): Operator {
  const {
    emergencyContact: ec,
    publicInsurance: pub,
    privateInsurance: priv,
    documents: docs,
    ...rest
  } = core;
  return {
    birthDate: '',
    curp: '',
    rfc: '',
    licenseType: 'unspecified',
    licenseEndorsements: '',
    phoneSecondary: '',
    address: '',
    companyHireDate: '',
    employmentContractType: '',
    insuranceKind: 'none',
    photoDataUrl: '',
    ...rest,
    documents: Array.isArray(docs) ? docs.map((d) => ({ ...d })) : [],
    emergencyContact: { ...EMPTY_EMERGENCY, ...ec },
    publicInsurance: { ...EMPTY_PUBLIC, ...pub },
    privateInsurance: { ...EMPTY_PRIVATE, ...priv },
  };
}
