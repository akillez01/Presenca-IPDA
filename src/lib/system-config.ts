import type { SystemConfig } from '@/lib/types';

export const DEFAULT_SYSTEM_CONFIG: Omit<SystemConfig, 'lastUpdated' | 'updatedBy'> = {
  reclassificationOptions: ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'],
  regionOptions: ['Norte', 'Sul', 'Leste', 'Oeste', 'Central'],
  churchPositionOptions: [
    'Conselheiro(a)',
    'Financeiro(a)',
    'Pastor',
    'Presbítero',
    'Diácono',
    'Cooperador(a)',
    'Líder Reação',
    'Líder Simplifique',
    'Líder Creative',
    'Líder Discipulus',
    'Líder Adore',
    'Auxiliar Expansão (a)',
    'Etda Professor(a)',
    'Coordenador Etda (a)',
    'Líder Galileu (a)',
    'Líder Adote uma alma (a)',
    'Membro',
    'Outro',
  ],
  cursoCFOOptions: ['Sim', 'Não'],
  shiftOptions: ['Manhã', 'Tarde', 'Noite'],
  statusOptions: ['Presente', 'Ausente', 'Justificado'],
};

function ensureArray(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? value : fallback;
}

export function normalizeSystemConfig(
  rawConfig: Partial<SystemConfig> | Record<string, unknown> | null | undefined,
  updatedByFallback: string
): SystemConfig {
  const data = rawConfig ?? {};

  return {
    reclassificationOptions: ensureArray(data.reclassificationOptions, DEFAULT_SYSTEM_CONFIG.reclassificationOptions),
    regionOptions: ensureArray(data.regionOptions, DEFAULT_SYSTEM_CONFIG.regionOptions),
    churchPositionOptions: ensureArray(data.churchPositionOptions, DEFAULT_SYSTEM_CONFIG.churchPositionOptions),
    cursoCFOOptions: ensureArray(data.cursoCFOOptions, DEFAULT_SYSTEM_CONFIG.cursoCFOOptions || ['Sim', 'Não']),
    shiftOptions: ensureArray(data.shiftOptions, DEFAULT_SYSTEM_CONFIG.shiftOptions),
    statusOptions: ensureArray(data.statusOptions, DEFAULT_SYSTEM_CONFIG.statusOptions),
    lastUpdated:
      typeof data.lastUpdated === 'object' &&
      data.lastUpdated !== null &&
      'toDate' in data.lastUpdated &&
      typeof (data.lastUpdated as { toDate?: () => Date }).toDate === 'function'
        ? (data.lastUpdated as { toDate: () => Date }).toDate()
        : data.lastUpdated instanceof Date
          ? data.lastUpdated
          : typeof data.lastUpdated === 'string' || typeof data.lastUpdated === 'number'
            ? new Date(data.lastUpdated)
            : new Date(),
    updatedBy: typeof data.updatedBy === 'string' && data.updatedBy ? data.updatedBy : updatedByFallback,
  };
}
