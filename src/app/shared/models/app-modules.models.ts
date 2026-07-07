export const APP_MODULE_CODES = {
  DASHBOARD: 'dashboard',
  TRIPS: 'trips',
  FLEET: 'fleet',
  OPERATORS: 'operators',
  CLIENTS: 'clients',
  EXPENSES: 'expenses',
  REPORTS: 'reports',
  CUENTA: 'cuenta',
  USUARIOS: 'usuarios',
} as const;

export type AppModuleCode =
  (typeof APP_MODULE_CODES)[keyof typeof APP_MODULE_CODES];

export const STAFF_GRANTABLE_MODULE_CODES = [
  APP_MODULE_CODES.TRIPS,
  APP_MODULE_CODES.FLEET,
  APP_MODULE_CODES.OPERATORS,
  APP_MODULE_CODES.CLIENTS,
  APP_MODULE_CODES.EXPENSES,
  APP_MODULE_CODES.REPORTS,
] as const satisfies readonly AppModuleCode[];

export type StaffGrantableModuleCode =
  (typeof STAFF_GRANTABLE_MODULE_CODES)[number];

/** Módulos con permisos Lectura / Escritura. */
export const STAFF_RBAC_MODULE_CODES = [
  APP_MODULE_CODES.TRIPS,
  APP_MODULE_CODES.FLEET,
  APP_MODULE_CODES.OPERATORS,
  APP_MODULE_CODES.CLIENTS,
  APP_MODULE_CODES.EXPENSES,
  APP_MODULE_CODES.REPORTS,
] as const satisfies readonly StaffGrantableModuleCode[];

export type StaffRbacModuleCode = (typeof STAFF_RBAC_MODULE_CODES)[number];

export type ModuleAccessLevel = 'read' | 'write';

export interface StaffModuleGrant {
  module: StaffGrantableModuleCode;
  level: ModuleAccessLevel;
}

export const MODULE_ACCESS_LEVEL_LABELS: Record<ModuleAccessLevel, string> = {
  read: 'Lectura',
  write: 'Escritura',
};

export const STAFF_MODULE_OPTIONS: readonly {
  code: StaffGrantableModuleCode;
  label: string;
}[] = [
  { code: APP_MODULE_CODES.TRIPS, label: 'Maniobras' },
  { code: APP_MODULE_CODES.FLEET, label: 'Flota' },
  { code: APP_MODULE_CODES.OPERATORS, label: 'Operadores' },
  { code: APP_MODULE_CODES.CLIENTS, label: 'Comercial' },
  { code: APP_MODULE_CODES.EXPENSES, label: 'Gastos' },
  { code: APP_MODULE_CODES.REPORTS, label: 'Reportes' },
];

export const STAFF_RBAC_MODULE_OPTIONS = STAFF_MODULE_OPTIONS.filter((option) =>
  (STAFF_RBAC_MODULE_CODES as readonly string[]).includes(option.code),
);

export interface AppNavItem {
  path: string;
  label: string;
  module: AppModuleCode;
  placement: 'main' | 'bottom';
}

export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { path: '/dashboard', label: 'Dashboard', module: APP_MODULE_CODES.DASHBOARD, placement: 'main' },
  { path: '/trips', label: 'Maniobras', module: APP_MODULE_CODES.TRIPS, placement: 'main' },
  { path: '/fleet', label: 'Flota', module: APP_MODULE_CODES.FLEET, placement: 'main' },
  { path: '/operators', label: 'Operadores', module: APP_MODULE_CODES.OPERATORS, placement: 'main' },
  { path: '/clients', label: 'Comercial', module: APP_MODULE_CODES.CLIENTS, placement: 'main' },
  { path: '/expenses', label: 'Gastos', module: APP_MODULE_CODES.EXPENSES, placement: 'main' },
  { path: '/reports', label: 'Reportes', module: APP_MODULE_CODES.REPORTS, placement: 'main' },
  { path: '/cuenta', label: 'Cuenta', module: APP_MODULE_CODES.CUENTA, placement: 'bottom' },
  { path: '/usuarios', label: 'Usuarios', module: APP_MODULE_CODES.USUARIOS, placement: 'bottom' },
] as const;
