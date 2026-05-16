import type {
  Client,
  ClientCommercialHealth,
} from '@shared/models/client.models';

function pay(
  hasCredit: boolean,
  days: number | undefined,
  amount: string | undefined,
  commercialHealth: ClientCommercialHealth,
): NonNullable<Client['payment']> {
  return {
    hasCredit,
    ...(hasCredit && days != null ? { creditDays: days } : {}),
    ...(amount ? { approximateCreditAmount: amount } : {}),
    commercialHealth,
  };
}

/** Tabla `clients` (demo), alineada con `trips.clientId` / `trips.clientName`. */
export const SIM_DB_CLIENTS: Client[] = [
  {
    id: 'cli-coca',
    name: 'Coca-Cola FEMSA',
    rfc: 'CCC010101ABC',
    relationshipStartedOn: '2018-03-12',
    notes: 'Cliente estratégico bebidas.',
    billing: {
      invoiceLegalName: 'Coca-Cola FEMSA, S.A.B. de C.V.',
      taxRegime: '601',
      fiscalZip: '66265',
      cfdiUse: 'G03',
      billingEmail: 'facturacion@coca-cola.com.mx',
      billingPhone: '818328-5000',
    },
    contacts: [
      {
        id: 'ct-coca-1',
        name: 'Mariana López',
        role: 'Cuentas por pagar',
        phone: '818328-5100',
        email: 'm.lopez@coca-cola.com.mx',
      },
    ],
    payment: pay(true, 45, '15 MMXN', 'good_standing'),
  },
  {
    id: 'cli-femsa',
    name: 'FEMSA Logística',
    rfc: 'FEM020202XYZ',
    relationshipStartedOn: '2019-07-01',
    billing: {
      taxRegime: '601',
      fiscalZip: '66260',
      cfdiUse: 'G03',
      billingEmail: 'facturas@femsa.com',
    },
    contacts: [
      {
        id: 'ct-femsa-1',
        name: 'Operaciones tráfico',
        role: 'Coordinación nacional',
        phone: '818328-6000',
      },
    ],
    payment: pay(true, 30, '8 MMXN', 'good_standing'),
  },
  {
    id: 'cli-bachoco',
    name: 'Industrias Bachoco',
    rfc: 'BAC030303HIJ',
    relationshipStartedOn: '2020-01-20',
    billing: { fiscalZip: '27000', cfdiUse: 'G03' },
    contacts: [],
    payment: pay(false, undefined, undefined, 'not_evaluated'),
  },
  {
    id: 'cli-kc',
    name: 'Kimberly-Clark',
    rfc: 'KCC040404LMN',
    relationshipStartedOn: '2017-11-05',
    billing: { fiscalZip: '54060', cfdiUse: 'G03' },
    contacts: [
      {
        id: 'ct-kc-1',
        name: 'Compras nacionales',
        email: 'compras.mx@kimberly-clark.com',
      },
    ],
    payment: pay(true, 60, '12 MMXN', 'watch_list'),
  },
  {
    id: 'cli-liverpool',
    name: 'Liverpool',
    rfc: 'LIV050505OPQ',
    relationshipStartedOn: '2016-05-15',
    billing: { fiscalZip: '06600', cfdiUse: 'G03' },
    contacts: [],
    payment: pay(true, 90, '25 MMXN', 'good_standing'),
  },
  {
    id: 'cli-modelo',
    name: 'Grupo Modelo',
    rfc: 'MOD060606RST',
    relationshipStartedOn: '2021-02-28',
    billing: {},
    contacts: [],
    payment: pay(true, 30, '10 MMXN', 'good_standing'),
  },
  {
    id: 'cli-penoles',
    name: 'Peñoles',
    rfc: 'PEN070707UVW',
    relationshipStartedOn: '2015-09-10',
    billing: {},
    contacts: [],
    payment: pay(false, undefined, undefined, 'not_evaluated'),
  },
  {
    id: 'cli-sigma',
    name: 'Sigma Alimentos',
    rfc: 'SIG080808YZA',
    relationshipStartedOn: '2019-04-22',
    billing: {},
    contacts: [],
    payment: pay(true, 21, '5 MMXN', 'good_standing'),
  },
  {
    id: 'cli-soriana',
    name: 'Organización Soriana',
    rfc: 'SOR090909BCD',
    relationshipStartedOn: '2014-01-08',
    billing: {},
    contacts: [],
    payment: pay(true, 45, '20 MMXN', 'restricted'),
  },
  {
    id: 'cli-walmart',
    name: 'Walmart de México',
    rfc: 'WAL101010EFG',
    relationshipStartedOn: '2013-06-01',
    billing: {},
    contacts: [],
    payment: pay(true, 60, '40 MMXN', 'good_standing'),
  },
];
