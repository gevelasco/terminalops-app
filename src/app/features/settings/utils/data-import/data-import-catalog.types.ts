/** Índices normalizados del catálogo actual (tenant) para detectar duplicados en importación. */
export type DataImportCatalogSnapshot = {
  clientNames: Set<string>;
  clientRfcs: Set<string>;
  operatorNames: Set<string>;
  operatorCurps: Set<string>;
  operatorRfcs: Set<string>;
  operatorLicenses: Set<string>;
  unitPlates: Set<string>;
  unitSerials: Set<string>;
  unitMotors: Set<string>;
  equipmentPlates: Set<string>;
  equipmentSerials: Set<string>;
  /** Placas activas en unidades + equipos. */
  allPlates: Set<string>;
  /** Series en unidades + equipos. */
  allSerials: Set<string>;
};