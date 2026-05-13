import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToButtonComponent } from './to-button.component';

describe('ToButtonComponent', () => {
  let fixture: ComponentFixture<ToButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ToButtonComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
