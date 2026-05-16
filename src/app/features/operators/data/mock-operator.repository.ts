import { Injectable, inject } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { SimulatedDbService } from '@app/sim-db/simulated-db.service';
import { mergeOperatorNested } from '@features/operators/utils/operator-payload-defaults';
import { Operator } from '@shared/models/logistics.models';
import {
  CreateOperatorPayload,
  OperatorRepository,
} from './operator.repository';

function normalizeOperatorStrings(o: Operator): Operator {
  const pub = o.publicInsurance;
  const docs = Array.isArray(o.documents) ? o.documents : [];
  return mergeOperatorNested({
    ...o,
    companyHireDate: o.companyHireDate.trim(),
    employmentContractType: o.employmentContractType.trim(),
    documents: docs.map((d) => ({
      ...d,
      fileName: d.fileName.trim(),
    })),
    publicInsurance: {
      ...pub,
      nss: pub.nss.trim(),
      imssAltaDate: pub.imssAltaDate.trim(),
      notes: pub.notes.trim(),
      infonavitCreditNumber: pub.infonavitCreditNumber.trim(),
      fonacotCreditNumber: pub.fonacotCreditNumber.trim(),
    },
  }) as Operator;
}

@Injectable()
export class MockOperatorRepository extends OperatorRepository {
  private readonly db = inject(SimulatedDbService);

  override list(): Observable<Operator[]> {
    return of(
      this.db.listOperators().map((o) => mergeOperatorNested({ ...o })),
    ).pipe(delay(260));
  }

  override get(id: string): Observable<Operator | null> {
    const o = this.db.getOperator(id);
    return of(o ? mergeOperatorNested({ ...o }) : null).pipe(delay(120));
  }

  override create(payload: CreateOperatorPayload): Observable<Operator> {
    const id = `op-${Date.now().toString(36)}`;
    const created = normalizeOperatorStrings(
      mergeOperatorNested({
        ...payload,
        id,
        name: payload.name.trim(),
        licenseNumber: payload.licenseNumber.trim(),
        licenseExpiresOn: payload.licenseExpiresOn.trim(),
        phone: payload.phone.trim(),
        phoneSecondary: payload.phoneSecondary?.trim() ?? '',
        address: payload.address?.trim() ?? '',
        curp: payload.curp?.trim().toUpperCase() ?? '',
        rfc: payload.rfc?.trim().toUpperCase() ?? '',
        birthDate: payload.birthDate?.trim() ?? '',
        licenseEndorsements: payload.licenseEndorsements?.trim() ?? '',
        companyHireDate: payload.companyHireDate?.trim() ?? '',
        employmentContractType: payload.employmentContractType?.trim() ?? '',
      }) as Operator,
    );
    this.db.insertOperator(created);
    return of(mergeOperatorNested({ ...created })).pipe(delay(280));
  }

  override update(operator: Operator): Observable<Operator> {
    const next = normalizeOperatorStrings(
      mergeOperatorNested({
        ...operator,
        name: operator.name.trim(),
        licenseNumber: operator.licenseNumber.trim(),
        licenseExpiresOn: operator.licenseExpiresOn.trim(),
        phone: operator.phone.trim(),
        phoneSecondary: operator.phoneSecondary?.trim() ?? '',
        address: operator.address?.trim() ?? '',
        curp: operator.curp?.trim().toUpperCase() ?? '',
        rfc: operator.rfc?.trim().toUpperCase() ?? '',
        birthDate: operator.birthDate?.trim() ?? '',
        licenseEndorsements: operator.licenseEndorsements?.trim() ?? '',
        companyHireDate: operator.companyHireDate?.trim() ?? '',
        employmentContractType: operator.employmentContractType?.trim() ?? '',
      }) as Operator,
    );
    this.db.updateOperator(next);
    return of(mergeOperatorNested({ ...next })).pipe(delay(220));
  }
}
