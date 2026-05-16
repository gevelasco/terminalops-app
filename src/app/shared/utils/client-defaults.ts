import type { ClientBilling, ClientPaymentTerms } from '@shared/models/client.models';

export function defaultClientBilling(): ClientBilling {
  return {};
}

export function defaultClientPayment(): ClientPaymentTerms {
  return {
    hasCredit: false,
    commercialHealth: 'not_evaluated',
  };
}
