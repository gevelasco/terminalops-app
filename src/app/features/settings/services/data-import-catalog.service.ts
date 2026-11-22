import { Injectable, inject } from '@angular/core';
import { forkJoin, map, type Observable } from 'rxjs';
import { ClientsService } from '@core/services/api/clients';
import { EquipmentService } from '@core/services/api/equipment';
import { OperatorsService } from '@core/services/api/operators';
import { UnitsService } from '@core/services/api/units';
import type { DataImportCatalogSnapshot } from '@features/settings/utils/data-import/data-import-catalog.types';
import {
  normIdKey,
  normNameKey,
} from '@features/settings/utils/data-import/data-import-uniqueness.util';

@Injectable({ providedIn: 'root' })
export class DataImportCatalogService {
  private readonly clientsApi = inject(ClientsService);
  private readonly operatorsApi = inject(OperatorsService);
  private readonly unitsApi = inject(UnitsService);
  private readonly equipmentApi = inject(EquipmentService);

  loadSnapshot(): Observable<DataImportCatalogSnapshot> {
    return forkJoin({
      clients: this.clientsApi.getClientsList(),
      operators: this.operatorsApi.getOperatorsList(),
      units: this.unitsApi.getUnitsList(),
      equipment: this.equipmentApi.getEquipmentList(),
    }).pipe(
      map(({ clients, operators, units, equipment }) => {
        const clientNames = new Set<string>();
        const clientRfcs = new Set<string>();
        for (const c of clients) {
          if (c.isActive === false) {
            continue;
          }
          const name = normNameKey(c.name);
          if (name) {
            clientNames.add(name);
          }
          const rfc = normIdKey(c.rfc);
          if (rfc) {
            clientRfcs.add(rfc);
          }
        }

        const operatorNames = new Set<string>();
        const operatorCurps = new Set<string>();
        const operatorRfcs = new Set<string>();
        const operatorLicenses = new Set<string>();
        for (const o of operators) {
          if (o.isActive === false) {
            continue;
          }
          const name = normNameKey(o.name);
          if (name) {
            operatorNames.add(name);
          }
          const curp = normIdKey(o.curp);
          if (curp) {
            operatorCurps.add(curp);
          }
          const rfc = normIdKey(o.rfc);
          if (rfc) {
            operatorRfcs.add(rfc);
          }
          const lic = normIdKey(o.licenseNumber);
          if (lic) {
            operatorLicenses.add(lic);
          }
        }

        const unitPlates = new Set<string>();
        const unitSerials = new Set<string>();
        const unitMotors = new Set<string>();
        for (const u of units) {
          if (u.isActive === false) {
            continue;
          }
          const plate = normIdKey(u.plate);
          if (plate) {
            unitPlates.add(plate);
          }
          const serial = normIdKey(u.serialNumber);
          if (serial) {
            unitSerials.add(serial);
          }
          const motor = normIdKey(u.motorNumber);
          if (motor) {
            unitMotors.add(motor);
          }
        }

        const equipmentPlates = new Set<string>();
        const equipmentSerials = new Set<string>();
        for (const e of equipment) {
          if (e.isActive === false) {
            continue;
          }
          const plate = normIdKey(e.plate);
          if (plate) {
            equipmentPlates.add(plate);
          }
          const serial = normIdKey(e.serialNumber);
          if (serial) {
            equipmentSerials.add(serial);
          }
        }

        const allPlates = new Set<string>([...unitPlates, ...equipmentPlates]);
        const allSerials = new Set<string>([...unitSerials, ...equipmentSerials]);

        return {
          clientNames,
          clientRfcs,
          operatorNames,
          operatorCurps,
          operatorRfcs,
          operatorLicenses,
          unitPlates,
          unitSerials,
          unitMotors,
          equipmentPlates,
          equipmentSerials,
          allPlates,
          allSerials,
        };
      }),
    );
  }
}