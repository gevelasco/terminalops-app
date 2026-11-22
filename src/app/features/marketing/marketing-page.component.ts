import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ToIconComponent } from '@shared/ui/to-icon/to-icon.component';
import type { ToIconName } from '@shared/ui/to-icon/to-icon-paths';

type FeatureCard = {
  icon: ToIconName;
  title: string;
  description: string;
};

type PlanCard = {
  name: string;
  audience: string;
  highlight: string;
};

@Component({
  selector: 'app-marketing-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ToIconComponent],
  templateUrl: './marketing-page.component.html',
  styleUrl: './marketing-page.component.scss',
})
export class MarketingPageComponent {
  protected readonly currentYear = new Date().getFullYear();

  protected readonly operationStates = [
    {
      src: '/mkt-como-va-tu-operacion-1.png',
      width: 409,
      height: 622,
      label: 'Improvisada',
      alt: 'Camión con lona improvisada, inestable y sin luces.',
    },
    {
      src: '/mkt-como-va-tu-operacion-2.png',
      width: 392,
      height: 628,
      label: 'Aparentando orden',
      alt: 'Contenedor con apariencia de orden, inclinado y con placa deteriorada.',
    },
    {
      src: '/mkt-como-va-tu-operacion-3.png',
      width: 412,
      height: 639,
      label: 'Controlada y segura',
      alt: 'Contenedor controlado y seguro, con placa Terminal y luces en buen estado.',
    },
  ] as const;

  /** Seis capacidades clave (sin repetir lo que ya desarrollan otras secciones). */
  protected readonly features: FeatureCard[] = [
    {
      icon: 'grid',
      title: 'Dashboards rápidos',
      description: 'Una vista clara de la operación para decidir al momento.',
    },
    {
      icon: 'tracking',
      title: 'Diésel y kilómetros',
      description: 'Consumo y kilometraje con trazabilidad automática por viaje y unidad.',
    },
    {
      icon: 'unit',
      title: 'Administración de flota',
      description: 'Disponibilidad, mantenimiento y estado operativo en un solo panel.',
    },
    {
      icon: 'groups',
      title: 'Operadores y equipos',
      description: 'Asigna, coordina y mide a tu gente sin perder el control.',
    },
    {
      icon: 'settlement',
      title: 'Gastos avanzados',
      description: 'Clasifica, aprueba y audita egresos con el detalle que exige tu operación.',
    },
    {
      icon: 'enterprise',
      title: 'Clientes y cartera',
      description: 'Administra relaciones comerciales con la flexibilidad que tu negocio necesita.',
    },
  ];

  protected readonly operationPoints = [
    'Señales de consumo y costo de combustible con contexto de viaje',
    'Kilometraje consolidado para mantenimiento y rendimiento',
    'Estado de flota listo para anticipar, no solo para reportar',
  ];

  protected readonly businessPoints = [
    'Seguimiento comercial de rutas y cuentas clave',
    'Cartera adaptable a cada cliente y condición de servicio',
    'Reportes claros para dirección y operación',
  ];

  protected readonly mobilePoints = [
    'Monitorea flota y viajes en tiempo real',
    'Coordina operadores aunque estés en ruta',
    'Mantén continuidad operativa fuera de oficina',
  ];

  protected readonly evidencePoints = [
    {
      icon: 'document' as const,
      title: 'Evidencia por operación',
      description: 'Documentos ligados a viajes, gastos y clientes — listos cuando haya que demostrar.',
    },
    {
      icon: 'checkCircle' as const,
      title: 'Protección ante el cliente',
      description: 'Respaldas acuerdos y entregas con historial claro, no con capturas sueltas.',
    },
    {
      icon: 'save' as const,
      title: 'Acceso controlado',
      description: 'Tu equipo ve lo operativo; el cliente solo lo que tú autorizas compartir.',
    },
  ];

  protected readonly plans: PlanCard[] = [
    {
      name: 'Operación esencial',
      audience: 'Flotas en crecimiento',
      highlight: 'Control diario de viajes, unidades y costos básicos.',
    },
    {
      name: 'Terminal avanzada',
      audience: 'Operaciones multi-cliente',
      highlight: 'Cartera, reportes y gobernanza para escalar con orden.',
    },
    {
      name: 'Enterprise',
      audience: 'Redes complejas',
      highlight: 'Equipos, permisos y profundidad analítica a escala.',
    },
  ];
}
