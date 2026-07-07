import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OperatorOperationFieldsComponent } from './operator-operation-fields.component';

describe('OperatorOperationFieldsComponent (A6)', () => {
  let fixture: ComponentFixture<OperatorOperationFieldsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorOperationFieldsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(OperatorOperationFieldsComponent);
    fixture.componentRef.setInput('employmentContractOptions', []);
    fixture.componentRef.setInput('paymentScheduleOptions', []);
    fixture.componentRef.setInput('paymentMethodOptions', []);
    fixture.detectChanges();
  });

  it('does not render operational status select', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Estado operativo');
  });
});
