import { buildClientApiWriteBody } from './client-payload';
import type { Client } from '@shared/models/client.models';

describe('buildClientApiWriteBody deliveries', () => {
  it('sends only the deliveries array', () => {
    const client: Client = {
      id: '1',
      name: 'Agencia',
      deliveries: [
        {
          postalCode: '77560',
          locality: 'Centro',
          cityMunicipality: 'Cancún, Quintana Roo',
          destinationRateId: 'rate-1',
        },
        {
          postalCode: '44100',
          locality: 'Americana',
          cityMunicipality: 'Guadalajara, Jalisco',
        },
      ],
    };
    const body = buildClientApiWriteBody(client);
    expect(body['deliveries']).toEqual([
      {
        postalCode: '77560',
        locality: 'Centro',
        cityMunicipality: 'Cancún, Quintana Roo',
      },
      {
        postalCode: '44100',
        locality: 'Americana',
        cityMunicipality: 'Guadalajara, Jalisco',
      },
    ]);
    expect(body['delivery']).toBeUndefined();
  });
});
