import {
  equipmentTypeDisplayLabel,
  isPlanaEquipment,
} from '@features/fleet/utils/unit-hitched-equipment';
import type { OperationConfigurationResolver } from '@shared/services/operation-configuration-resolver.types';
import type { Equipment } from '@shared/models/logistics.models';
import {
  operationConfigBadgeClass,
  operationConfigBadgeTone,
  operationConfigChartFillClass,
  operationConfigSuggestsPlataformaConvoy,
  operationConfigUserFacingLabel,
  resolveOperationConfiguration,
  resolveUnitConvoyFromEquipment,
  type UnitConvoyDisplay,
} from '@shared/utils/operation-configuration-display.utils';

const EMPTY_CATALOG: readonly never[] = [];

function convoyDisplayFromEquipment(equipment: readonly Equipment[]): UnitConvoyDisplay {
  const base = resolveUnitConvoyFromEquipment(
    [...equipment],
    EMPTY_CATALOG,
    isPlanaEquipment,
  );
  if (base.label !== 'Configuración desconocida' || equipment.length === 0) {
    return base;
  }
  if (equipment.length >= 2) {
    const label = 'Doble articulado';
    return {
      ...base,
      kind: 'multi',
      label,
      badgeClass: operationConfigBadgeClass(label),
    };
  }
  const label = equipmentTypeDisplayLabel(equipment[0]!);
  return {
    ...base,
    label,
    badgeClass: operationConfigBadgeClass(label),
  };
}

function engineParams(
  ctx: Parameters<OperationConfigurationResolver['resolveLabel']>[0],
) {
  return { ...ctx, catalog: EMPTY_CATALOG, activeCatalog: EMPTY_CATALOG };
}

/**
 * Resolver operativo local de Flota — sin catálogo remoto.
 * Deriva convoy y etiquetas solo desde equipos enganchados.
 */
export const FLEET_OPERATION_RESOLVER: OperationConfigurationResolver = {
  contextFromTrip: (trip) => ({
    operationConfigurationId: trip.operationConfigurationId,
    code: trip.operationType,
    nameSnapshot: trip.operationConfigurationNameSnapshot,
    versionSnapshot: trip.operationConfigurationVersionSnapshot,
    maxEquipmentCountOverride: trip.operationConfigurationMaxEquipmentCountSnapshot,
  }),

  contextFromRatePrice: (price) => ({
    operationConfigurationId: price.operationConfigurationId,
    code: price.operationConfigurationCode,
    nameSnapshot: price.operationConfigurationName,
  }),

  contextFromTableRow: (row, codeField = 'operationType') => ({
    operationConfigurationId:
      typeof row['operationConfigurationId'] === 'string'
        ? row['operationConfigurationId']
        : undefined,
    code: String(row[codeField] ?? ''),
    nameSnapshot:
      typeof row['operationConfigurationNameSnapshot'] === 'string'
        ? row['operationConfigurationNameSnapshot']
        : undefined,
  }),

  resolveLabel(ctx) {
    const snap = ctx.nameSnapshot?.trim();
    if (snap) {
      return operationConfigUserFacingLabel(snap, ctx.code);
    }
    return resolveOperationConfiguration(engineParams(ctx)).label;
  },

  resolveColor(ctx) {
    return resolveOperationConfiguration(engineParams(ctx)).chartColor;
  },

  resolveBadge(ctx) {
    return resolveOperationConfiguration(engineParams(ctx)).badgeClass;
  },

  resolveGroupingKey(ctx) {
    return resolveOperationConfiguration(engineParams(ctx)).groupingKey;
  },

  resolveMaxEquipment(ctx) {
    if (ctx.maxEquipmentCountOverride != null) {
      return Math.max(1, ctx.maxEquipmentCountOverride);
    }
    return 1;
  },

  usesMultipleEquipment(ctx) {
    if (ctx.maxEquipmentCountOverride != null) {
      return ctx.maxEquipmentCountOverride >= 2;
    }
    return false;
  },

  resolveConvoyMode(equipment, configCtx) {
    return this.resolveConvoyDisplay([...equipment], configCtx).kind;
  },

  resolveConvoyDisplay(equipment, configCtx) {
    const convoy = convoyDisplayFromEquipment(equipment);
    const snap = configCtx?.nameSnapshot?.trim();
    const configCode = configCtx?.code?.trim();
    if (snap && configCode) {
      const label = operationConfigUserFacingLabel(snap, configCode);
      return {
        ...convoy,
        code: configCode,
        label,
        badgeClass: operationConfigBadgeClass(label),
      };
    }
    return convoy;
  },

  resolveTripDisplay(trip) {
    return resolveOperationConfiguration(engineParams(this.contextFromTrip(trip)));
  },

  resolveCellDisplay(code, row) {
    const ctx = row
      ? this.contextFromTableRow({ ...row, operationType: code })
      : { code: String(code ?? '') };
    return resolveOperationConfiguration(engineParams(ctx));
  },

  resolveChartTone: operationConfigBadgeTone,

  resolveChartFillClass: operationConfigChartFillClass,

  resolveSuggestsPlataformaConvoy(ctx) {
    return operationConfigSuggestsPlataformaConvoy(
      ctx.code,
      EMPTY_CATALOG,
      EMPTY_CATALOG,
    );
  },
};
