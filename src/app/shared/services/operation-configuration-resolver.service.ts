import { Injectable, inject } from '@angular/core';
import { OperationConfigurationsFeatureService } from '@features/clients/services/operation-configurations.service';
import { isPlanaEquipment } from '@features/fleet/utils/unit-hitched-equipment';
import type { Equipment, Trip } from '@shared/models/logistics.models';
import {
  catalogFromOperationConfigurations,
  configMaxEquipmentCount,
  configUsesMultipleEquipment,
  operationConfigBadgeTone,
  operationConfigChartFillClass,
  operationConfigSuggestsPlataformaConvoy,
  resolveOperationConfiguration,
  resolveUnitConvoyFromEquipment,
  type UnitConvoyDisplay,
  type UnitConvoyKind,
} from '@shared/utils/operation-configuration-display.utils';
import type {
  OperationConfigurationContext,
  OperationConfigurationDisplay,
  OperationConfigurationResolver,
} from './operation-configuration-resolver.types';

export type {
  OperationConfigurationContext,
  OperationConfigurationDisplay,
  OperationConfigurationResolver,
} from './operation-configuration-resolver.types';

/**
 * Único traductor operativo de UI (One Resolver Rule).
 * Solo semántica visual — sin diesel, costos ni agrupación analítica.
 */
@Injectable()
export class OperationConfigurationResolverService implements OperationConfigurationResolver {
  private readonly operationConfigs = inject(OperationConfigurationsFeatureService, {
    optional: true,
  });

  private fullCatalog() {
    return catalogFromOperationConfigurations(this.operationConfigs?.configurations() ?? []);
  }

  private activeCatalog() {
    return catalogFromOperationConfigurations(
      this.operationConfigs?.activeConfigurations() ?? [],
    );
  }

  private engineParams(ctx: OperationConfigurationContext) {
    return {
      ...ctx,
      catalog: this.fullCatalog(),
      activeCatalog: this.activeCatalog(),
    };
  }

  contextFromTrip(
    trip: Pick<Trip, 'operationType' | 'operationConfigurationId'>,
  ): OperationConfigurationContext {
    return {
      operationConfigurationId: trip.operationConfigurationId,
      code: trip.operationType,
    };
  }

  contextFromRatePrice(price: {
    operationConfigurationId?: string;
    operationConfigurationCode?: string;
    operationConfigurationName?: string;
  }): OperationConfigurationContext {
    return {
      operationConfigurationId: price.operationConfigurationId,
      code: price.operationConfigurationCode,
      nameSnapshot: price.operationConfigurationName,
    };
  }

  contextFromTableRow(
    row: Record<string, unknown>,
    codeField = 'operationType',
  ): OperationConfigurationContext {
    return {
      operationConfigurationId:
        typeof row['operationConfigurationId'] === 'string'
          ? row['operationConfigurationId']
          : undefined,
      code: String(row[codeField] ?? ''),
    };
  }

  resolveLabel(ctx: OperationConfigurationContext): string {
    return resolveOperationConfiguration(this.engineParams(ctx)).label;
  }

  resolveColor(ctx: OperationConfigurationContext): string {
    return resolveOperationConfiguration(this.engineParams(ctx)).chartColor;
  }

  resolveBadge(ctx: OperationConfigurationContext): string {
    return resolveOperationConfiguration(this.engineParams(ctx)).badgeClass;
  }

  resolveGroupingKey(ctx: OperationConfigurationContext): string {
    return resolveOperationConfiguration(this.engineParams(ctx)).groupingKey;
  }

  resolveMaxEquipment(ctx: OperationConfigurationContext): number {
    return configMaxEquipmentCount(this.engineParams(ctx));
  }

  usesMultipleEquipment(ctx: OperationConfigurationContext): boolean {
    return configUsesMultipleEquipment(this.engineParams(ctx));
  }

  resolveConvoyMode(
    equipment: readonly Equipment[],
    configCtx?: OperationConfigurationContext,
  ): UnitConvoyKind {
    return this.resolveConvoyDisplay([...equipment], configCtx).kind;
  }

  resolveConvoyDisplay(
    equipment: readonly Equipment[],
    configCtx?: OperationConfigurationContext,
  ): UnitConvoyDisplay {
    const catalog = this.fullCatalog();
    const convoy = resolveUnitConvoyFromEquipment([...equipment], catalog, isPlanaEquipment);
    if (!configCtx) {
      return convoy;
    }
    const configCode = this.engineParams(configCtx).code?.trim();
    if (configCode && !convoy.code) {
      const display = resolveOperationConfiguration({
        ...this.engineParams(configCtx),
        code: configCode,
      });
      return {
        ...convoy,
        code: configCode,
        label: display.label,
        badgeClass: display.badgeClass,
      };
    }
    return convoy;
  }

  resolveTripDisplay(
    trip: Pick<Trip, 'operationType' | 'operationConfigurationId'>,
  ): OperationConfigurationDisplay {
    return resolveOperationConfiguration(this.engineParams(this.contextFromTrip(trip)));
  }

  resolveCellDisplay(
    code: unknown,
    row?: Record<string, unknown>,
  ): OperationConfigurationDisplay {
    const ctx = row
      ? this.contextFromTableRow({ ...row, operationType: code })
      : { code: String(code ?? '') };
    return resolveOperationConfiguration(this.engineParams(ctx));
  }

  resolveChartTone(groupingKey: string): number {
    return operationConfigBadgeTone(groupingKey);
  }

  resolveChartFillClass(tone: number, scope: 'dash' | 'reports'): string {
    return operationConfigChartFillClass(tone, scope);
  }

  resolveSuggestsPlataformaConvoy(ctx: OperationConfigurationContext): boolean {
    const params = this.engineParams(ctx);
    return operationConfigSuggestsPlataformaConvoy(
      params.code,
      params.catalog,
      params.activeCatalog,
    );
  }
}
