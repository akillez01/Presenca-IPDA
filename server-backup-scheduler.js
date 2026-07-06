import { mkdir, readdir, unlink, writeFile } from 'fs/promises';
import path from 'path';

import { Timestamp } from 'firebase-admin/firestore';

const BACKUP_DIRECTORY = 'backups';
const BACKUP_METADATA_PREFIX = 'backup-metadata-';
const DEFAULT_SCHEDULE = '0 2 * * *';
const DEFAULT_RETENTION_DAYS = 30;
const DEFAULT_TIMEZONE = 'America/Manaus';
const POLL_INTERVAL_MS = 30_000;

const COLLECTIONS = [
  { key: 'attendance', collectionName: 'attendance' },
  { key: 'members', collectionName: 'members' },
  { key: 'users', collectionName: 'users' },
  { key: 'config', collectionName: 'system-config' },
];

const weekdayMap = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const schedulerState = {
  enabled: false,
  running: false,
  schedule: DEFAULT_SCHEDULE,
  timezone: DEFAULT_TIMEZONE,
  retentionDays: DEFAULT_RETENTION_DAYS,
  startedAt: null,
  lastCheckKey: null,
  lastRunAt: null,
  lastBackupId: null,
  lastError: null,
};

function toBoolean(value, fallback = false) {
  if (value == null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getSchedulerConfig() {
  const retentionValue = Number.parseInt(process.env.BACKUP_RETENTION_DAYS || '', 10);

  return {
    enabled: toBoolean(process.env.BACKUP_ENABLED, true),
    schedule: process.env.BACKUP_SCHEDULE || DEFAULT_SCHEDULE,
    timezone: process.env.BACKUP_TIMEZONE || DEFAULT_TIMEZONE,
    retentionDays: Number.isFinite(retentionValue) && retentionValue > 0 ? retentionValue : DEFAULT_RETENTION_DAYS,
    runOnStartup: toBoolean(process.env.BACKUP_RUN_ON_STARTUP, false),
  };
}

function getTimeParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const lookup = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: weekdayMap[lookup.weekday.toLowerCase()] ?? 0,
  };
}

function buildRunKey(parts) {
  return [
    String(parts.year),
    String(parts.month).padStart(2, '0'),
    String(parts.day).padStart(2, '0'),
    String(parts.hour).padStart(2, '0'),
    String(parts.minute).padStart(2, '0'),
  ].join('-');
}

function matchesCronField(field, value, min, max) {
  if (field === '*') {
    return true;
  }

  return field.split(',').some((segment) => {
    const trimmed = segment.trim();
    if (!trimmed) {
      return false;
    }

    const [rangePart, stepPart] = trimmed.split('/');
    const step = stepPart ? Number.parseInt(stepPart, 10) : 1;
    if (!Number.isFinite(step) || step <= 0) {
      return false;
    }

    let rangeStart = min;
    let rangeEnd = max;

    if (rangePart !== '*') {
      if (rangePart.includes('-')) {
        const [startRaw, endRaw] = rangePart.split('-');
        rangeStart = Number.parseInt(startRaw, 10);
        rangeEnd = Number.parseInt(endRaw, 10);
      } else {
        const exact = Number.parseInt(rangePart, 10);
        if (!Number.isFinite(exact)) {
          return false;
        }
        rangeStart = exact;
        rangeEnd = exact;
      }
    }

    if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd)) {
      return false;
    }

    if (value < rangeStart || value > rangeEnd) {
      return false;
    }

    return ((value - rangeStart) % step) === 0;
  });
}

function matchesSchedule(date, schedule, timeZone) {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron inválido: "${schedule}". Use o formato "min hora dia mes diaSemana".`);
  }

  const [minuteField, hourField, dayField, monthField, weekdayField] = fields;
  const parts = getTimeParts(date, timeZone);

  return (
    matchesCronField(minuteField, parts.minute, 0, 59) &&
    matchesCronField(hourField, parts.hour, 0, 23) &&
    matchesCronField(dayField, parts.day, 1, 31) &&
    matchesCronField(monthField, parts.month, 1, 12) &&
    matchesCronField(weekdayField, parts.weekday, 0, 6)
  );
}

function generateBackupId(date, timeZone) {
  const parts = getTimeParts(date, timeZone);
  const datePart = `${parts.year}${String(parts.month).padStart(2, '0')}${String(parts.day).padStart(2, '0')}`;
  const timePart = `${String(parts.hour).padStart(2, '0')}${String(parts.minute).padStart(2, '0')}${String(parts.second).padStart(2, '0')}`;
  return `backup-${datePart}-${timePart}`;
}

function generateChecksum(data) {
  let hash = 0;
  for (let index = 0; index < data.length; index += 1) {
    const char = data.charCodeAt(index);
    hash = ((hash << 5) - hash) + char;
    hash &= hash;
  }

  return Math.abs(hash).toString(16);
}

function serializeValue(value) {
  if (value == null) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [key, serializeValue(nestedValue)])
    );
  }

  return value;
}

async function fetchCollectionData(adminDb, collectionName) {
  const snapshot = await adminDb.collection(collectionName).get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...serializeValue(document.data()),
  }));
}

async function ensureBackupDirectory(backupDir) {
  await mkdir(backupDir, { recursive: true });
}

async function cleanupOldBackups(backupDir, retentionDays, logger) {
  try {
    const files = await readdir(backupDir);
    const backupIds = files
      .filter((fileName) => /^backup-\d{8}-\d{6}\.json$/.test(fileName))
      .map((fileName) => fileName.replace(/\.json$/, ''))
      .sort()
      .reverse();

    const idsToRemove = backupIds.slice(retentionDays);

    await Promise.all(
      idsToRemove.flatMap((backupId) => [
        unlink(path.join(backupDir, `${backupId}.json`)).catch(() => undefined),
        unlink(path.join(backupDir, `${BACKUP_METADATA_PREFIX}${backupId}.json`)).catch(() => undefined),
      ])
    );

    if (idsToRemove.length > 0) {
      logger.info(`🧹 Backup automático removeu ${idsToRemove.length} backups antigos.`);
    }
  } catch (error) {
    logger.warn('Aviso: falha ao limpar backups antigos automáticos:', error);
  }
}

async function logAuditEvent(adminDb, payload) {
  try {
    await adminDb.collection('audit_logs').add({
      ...payload,
      timestamp: Timestamp.now(),
    });
  } catch (error) {
    console.warn('Aviso: não foi possível registrar auditoria do backup automático:', error);
  }
}

export async function createServerBackup(adminDb, options = {}) {
  const config = getSchedulerConfig();
  const now = options.now instanceof Date ? options.now : new Date();
  const backupId = generateBackupId(now, config.timezone);
  const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
  const startedAt = Date.now();

  await ensureBackupDirectory(backupDir);

  const [attendance, members, users, systemConfig] = await Promise.all([
    fetchCollectionData(adminDb, 'attendance'),
    fetchCollectionData(adminDb, 'members'),
    fetchCollectionData(adminDb, 'users'),
    fetchCollectionData(adminDb, 'system-config'),
  ]);

  const payload = {
    metadata: {
      timestamp: now.toISOString(),
      version: '1.0',
      source: 'firebase-admin-server-scheduler',
      timezone: config.timezone,
      reason: options.reason || 'backup_agendado',
    },
    attendance,
    members,
    users,
    config: systemConfig,
    statistics: {
      totalRecords: attendance.length,
      totalMembers: members.length,
      totalDocuments: attendance.length + members.length + users.length + systemConfig.length,
      createdAt: now.toISOString(),
    },
  };

  const raw = JSON.stringify(payload);
  const backupFilePath = path.join(backupDir, `${backupId}.json`);
  const metadataFilePath = path.join(backupDir, `${BACKUP_METADATA_PREFIX}${backupId}.json`);
  const checksum = generateChecksum(raw);
  const metadata = {
    id: backupId,
    timestamp: now.toISOString(),
    recordCount: payload.statistics.totalDocuments,
    fileSize: raw.length,
    compression: true,
    checksum,
    status: 'success',
    reason: options.reason || 'backup_agendado',
    filePath: backupFilePath,
    storageLocation: 'local',
  };

  await writeFile(backupFilePath, raw, 'utf8');
  await writeFile(metadataFilePath, JSON.stringify(metadata, null, 2), 'utf8');

  await cleanupOldBackups(backupDir, config.retentionDays, options.logger || console);

  await logAuditEvent(adminDb, {
    eventType: 'BACKUP_CREATED',
    severity: 'MEDIUM',
    userId: 'system',
    action: 'create_backup',
    resourceType: 'backup',
    resourceId: backupId,
    description: `Backup automático ${backupId} criado com sucesso`,
    metadata: {
      mode: 'scheduled',
      durationMs: Date.now() - startedAt,
      fileSize: metadata.fileSize,
      recordCount: metadata.recordCount,
      reason: metadata.reason,
    },
  });

  return {
    success: true,
    metadata,
    filePath: backupFilePath,
  };
}

export function getBackupSchedulerStatus() {
  return { ...schedulerState };
}

export function startBackupScheduler(adminDb, options = {}) {
  const logger = options.logger || console;
  const config = getSchedulerConfig();

  schedulerState.enabled = config.enabled;
  schedulerState.schedule = config.schedule;
  schedulerState.timezone = config.timezone;
  schedulerState.retentionDays = config.retentionDays;
  schedulerState.startedAt = new Date().toISOString();
  schedulerState.lastError = null;

  if (!config.enabled) {
    logger.info('📴 Backup automático desativado por configuração.');
    return () => undefined;
  }

  let running = false;
  let intervalId = null;

  const runScheduledBackup = async (reason) => {
    if (running) {
      logger.warn('⏳ Backup automático já está em execução. Nova execução ignorada.');
      return;
    }

    running = true;
    schedulerState.running = true;
    schedulerState.lastError = null;

    try {
      const result = await createServerBackup(adminDb, { reason, logger });
      schedulerState.lastBackupId = result.metadata.id;
      schedulerState.lastRunAt = new Date().toISOString();
      logger.info(`✅ Backup automático criado: ${result.metadata.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      schedulerState.lastError = message;
      logger.error('❌ Falha no backup automático:', error);
    } finally {
      running = false;
      schedulerState.running = false;
    }
  };

  const tick = async () => {
    try {
      const now = new Date();
      if (!matchesSchedule(now, config.schedule, config.timezone)) {
        return;
      }

      const runKey = buildRunKey(getTimeParts(now, config.timezone));
      if (schedulerState.lastCheckKey === runKey) {
        return;
      }

      schedulerState.lastCheckKey = runKey;
      await runScheduledBackup('backup_agendado');
    } catch (error) {
      schedulerState.lastError = error instanceof Error ? error.message : 'Erro desconhecido';
      logger.error('❌ Erro no agendador de backup:', error);
    }
  };

  if (config.runOnStartup) {
    void runScheduledBackup('backup_ao_iniciar_servidor');
  }

  intervalId = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);

  logger.info(`📅 Backup automático ativado. Agenda: "${config.schedule}" (${config.timezone})`);
  void tick();

  return () => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  };
}
