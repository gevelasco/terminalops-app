#!/usr/bin/env node
/**
 * Guardrails de arquitectura — distancias Trips/Fleet/Reports.
 * Ejecutar: npm run check:trip-distance
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, '../src/app');

const SCAN_DIRS = [
  'features/trips',
  'features/fleet',
  'features/reports',
  'features/clients',
  'features/operators',
  'shared',
  'core/services/api',
];

/** Patrones prohibidos en frontend (no duplicar ida/vuelta en cliente). */
const FORBIDDEN_PATTERNS = [
  {
    id: 'no-route-times-two',
    re: /\brouteDistanceKm\b[^;\n]*\*\s*2\b/,
    message: 'No multiplicar routeDistanceKm × 2 en frontend; usar operationalDistanceKm del API.',
  },
  {
    id: 'no-routeKm-times-two',
    re: /\brouteKm\s*\(\s*\)[^;\n]*\*\s*2\b/,
    message: 'No multiplicar routeKm() × 2; usar operationalDistanceKmFromApi / fuel-estimate.',
  },
  {
    id: 'no-distanceKm-times-two',
    re: /\bdistanceKm\b[^;\n]*\*\s*2\b/,
    message: 'No multiplicar distanceKm × 2 en frontend; el backend calcula operationalDistanceKm.',
  },
];

/** routeDistanceKm solo para UI OSRM / payload ida — no para métricas operativas. */
const FORBIDDEN_ROUTE_IN_AGGREGATION = [
  {
    id: 'reports-no-route-for-km',
    re: /\btrip\.routeDistanceKm\b/,
    dirs: ['features/reports'],
    message: 'Reportes deben usar tripOperationalKm / tripKm(), no trip.routeDistanceKm.',
  },
  {
    id: 'fleet-stats-no-route-sum',
    re: /\bt\.routeDistanceKm\b|\btrip\.routeDistanceKm\b/,
    dirs: ['features/fleet/utils/unit-completed-trip-stats.ts'],
    message: 'Estadísticas de flota deben sumar operationalDistanceKm vía tripOperationalKm.',
  },
];

const REQUIRED_SNIPPETS = [
  {
    file: 'features/trips/utils/trip-operational-km.ts',
    includes: ['trip.operationalDistanceKm'],
    message: 'tripOperationalKm debe leer solo operationalDistanceKm.',
  },
  {
    file: 'features/reports/utils/reports-trip-helpers.ts',
    includes: ['tripOperationalKm'],
    message: 'tripKm() en reportes debe delegar a tripOperationalKm.',
  },
  {
    file: 'features/trips/utils/trips-fuel-estimate.ts',
    includes: ['isRoundTrip: true'],
    message: 'Fuel estimate debe enviar isRoundTrip: true explícitamente.',
  },
  {
    file: 'features/trips/components/trips-new-drawer/trips-new-drawer.component.ts',
    includes: ['isRoundTrip: true'],
    message: 'Crear maniobra debe enviar isRoundTrip: true explícitamente.',
  },
];

function walkTsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function rel(p) {
  return path.relative(path.join(__dirname, '..'), p);
}

function checkForbiddenPatterns(files) {
  const violations = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    for (const rule of FORBIDDEN_PATTERNS) {
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.includes('check-trip-distance-rules')) {
          return;
        }
        if (rule.re.test(line)) {
          violations.push({
            file: rel(file),
            line: i + 1,
            rule: rule.id,
            message: rule.message,
            text: line.trim(),
          });
        }
      });
    }
  }
  return violations;
}

function checkRouteInAggregation() {
  const violations = [];
  for (const rule of FORBIDDEN_ROUTE_IN_AGGREGATION) {
    for (const dir of rule.dirs) {
      const target = dir.endsWith('.ts')
        ? path.join(appRoot, dir)
        : path.join(appRoot, dir);
      const files = dir.endsWith('.ts') ? [target] : walkTsFiles(target);
      for (const file of files) {
        if (!fs.existsSync(file)) {
          continue;
        }
        const content = fs.readFileSync(file, 'utf8');
        if (rule.re.test(content)) {
          violations.push({
            file: rel(file),
            rule: rule.id,
            message: rule.message,
          });
        }
      }
    }
  }
  return violations;
}

function checkRequiredSnippets() {
  const violations = [];
  const root = path.join(__dirname, '..');
  for (const req of REQUIRED_SNIPPETS) {
    const file = path.join(root, 'src/app', req.file);
    if (!fs.existsSync(file)) {
      violations.push({ file: req.file, message: `Archivo requerido no encontrado: ${req.message}` });
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    for (const snippet of req.includes) {
      if (!content.includes(snippet)) {
        violations.push({
          file: req.file,
          message: `Falta «${snippet}»: ${req.message}`,
        });
      }
    }
  }
  return violations;
}

function main() {
  const files = SCAN_DIRS.flatMap((d) => walkTsFiles(path.join(appRoot, d)));
  const violations = [
    ...checkForbiddenPatterns(files),
    ...checkRouteInAggregation(),
    ...checkRequiredSnippets(),
  ];

  if (violations.length === 0) {
    console.log('check:trip-distance OK — sin violaciones de arquitectura.');
    process.exit(0);
  }

  console.error('check:trip-distance FALLÓ:\n');
  for (const v of violations) {
    const loc = v.line ? `${v.file}:${v.line}` : v.file;
    console.error(`  [${v.rule ?? 'required'}] ${loc}`);
    console.error(`    ${v.message}`);
    if (v.text) {
      console.error(`    → ${v.text}`);
    }
  }
  process.exit(1);
}

main();
