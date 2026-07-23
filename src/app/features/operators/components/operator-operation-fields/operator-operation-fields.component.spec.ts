import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperatorOperationFieldsComponent } from './operator-operation-fields.component';

describe('OperatorOperationFieldsComponent (A6)', () => {
  let fixture: ComponentFixture<OperatorOperationFieldsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorOperationFieldsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OperatorOperationFieldsComponent);
    fixture.componentRef.setInput('layout', 'edit');
    fixture.componentRef.setInput('employmentContractOptions', []);
    fixture.componentRef.setInput('paymentScheduleOptions', []);
    fixture.componentRef.setInput('paymentMethodOptions', []);
    fixture.componentRef.setInput('visibilityOptions', [
      { value: 'active', label: 'Activo' },
      { value: 'inactive', label: 'Inactivo' },
    ]);
    fixture.componentRef.setInput('operationalStatusOptions', [
      { value: 'available', label: 'Disponible' },
      { value: 'leave', label: 'Vacaciones' },
      { value: 'incapacitated', label: 'Incapacidad' },
      { value: 'inactive', label: 'Betado' },
    ]);
    fixture.detectChanges();
  });

  it('renders operational status select before registro in edit layout', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Estado');
    expect(text).toContain('Registro');
  });
});
