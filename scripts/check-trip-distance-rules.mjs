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

/** Campos droppeados del create / fuel-estimate de trips. */
const FORBIDDEN_CREATE_FIELDS = [
  {
    id: 'no-create-isRoundTrip',
    re: /\bisRoundTrip\s*:/,
    files: [
      'features/trips/components/trips-new-drawer/trips-new-drawer.component.ts',
      'features/trips/utils/trips-fuel-estimate.ts',
    ],
    message: 'No enviar isRoundTrip en create ni fuel-estimate (siempre roundtrip).',
  },
  {
    id: 'no-create-dieselPrice',
    re: /\bdieselPricePerLiterAtCreation\b/,
    files: [
      'features/trips/components/trips-new-drawer/trips-new-drawer.component.ts',
      'shared/models/api/api-trips.model.ts',
    ],
    message: 'No enviar dieselPricePerLiterAtCreation; derivar amount/liters en UI.',
  },
  {
    id: 'no-create-tollMode',
    re: /\btollCalculationMode\b/,
    files: [
      'features/trips/components/trips-new-drawer/trips-new-drawer.component.ts',
      'shared/models/api/api-trips.model.ts',
    ],
    message: 'No enviar tollCalculationMode en create.',
  },
];

const REQUIRED_SNIPPETS = [
  {
    file: 'features/trips/utils/trip-operational-km.ts',
    includes: ['* 2', 'routeDistanceKm'],
    message: 'tripOperationalKm debe calcular routeDistanceKm × 2.',
  },
  {
    file: 'features/reports/utils/reports-trip-helpers.ts',
    includes: ['tripOperationalKm'],
    message: 'tripKm() en reportes debe delegar a tripOperationalKm.',
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

function checkForbiddenCreateFields() {
  const violations = [];
  const root = path.join(__dirname, '..');
  for (const rule of FORBIDDEN_CREATE_FIELDS) {
    for (const relFile of rule.files) {
      const file = path.join(root, 'src/app', relFile);
      if (!fs.existsSync(file)) {
        continue;
      }
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.includes('check-trip-distance-rules')) {
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
  // Touch scan dirs so unused-import tooling keeps them discoverable.
  void SCAN_DIRS;
  const violations = [
    ...checkForbiddenCreateFields(),
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
