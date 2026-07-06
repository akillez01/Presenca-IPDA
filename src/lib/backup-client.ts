import { auth } from '@/lib/firebase';

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  recordCount: number;
  fileSize: number;
  compression: boolean;
  checksum: string;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  reason?: string;
  filePath?: string;
  storageLocation?: 'local' | 'firebase-storage' | 'external';
}

export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
  filePath?: string;
}

export interface BackupCreationOptions {
  reason?: string;
  safetyBackupOf?: string;
  skipCleanup?: boolean;
}

type RawBackupMetadata = Omit<BackupMetadata, 'timestamp'> & {
  timestamp: string | Date;
};

type BackupApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  metadata?: RawBackupMetadata;
  backups?: RawBackupMetadata[];
  filePath?: string;
};

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizeMetadata(metadata: RawBackupMetadata): BackupMetadata {
  return {
    ...metadata,
    timestamp:
      metadata.timestamp instanceof Date
        ? metadata.timestamp
        : new Date(metadata.timestamp),
  };
}

async function buildRequestHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return headers;
  }

  const token = await currentUser.getIdToken();
  headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function requestBackupApi(
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>
): Promise<BackupApiResponse> {
  const response = await fetch('/api/admin/backups', {
    method,
    cache: 'no-store',
    headers: await buildRequestHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload: BackupApiResponse = {};
  try {
    payload = (await response.json()) as BackupApiResponse;
  } catch {
    payload = {};
  }

  if (!response.ok || payload.success === false) {
    throw new Error(
      payload.message || payload.error || 'Falha na comunicacao com a API de backup.'
    );
  }

  return payload;
}

export const backupSystemClient = {
  async listBackups(): Promise<BackupMetadata[]> {
    const payload = await requestBackupApi('GET');
    const rawBackups = Array.isArray(payload.backups) ? payload.backups : [];
    return rawBackups.map(normalizeMetadata).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  },

  async createBackup(options: BackupCreationOptions = {}): Promise<BackupResult> {
    try {
      const payload = await requestBackupApi('POST', {
        action: 'create',
        options,
      });

      return {
        success: true,
        metadata: payload.metadata ? normalizeMetadata(payload.metadata) : undefined,
        filePath: payload.filePath,
      };
    } catch (error) {
      return {
        success: false,
        error: toErrorMessage(error, 'Erro ao criar backup.'),
      };
    }
  },

  async restoreFromBackup(backupId: string): Promise<boolean> {
    await requestBackupApi('POST', {
      action: 'restore',
      backupId,
    });
    return true;
  },

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      await requestBackupApi('DELETE', { backupId });
      return true;
    } catch {
      return false;
    }
  },
};

export async function createManualBackup(
  options: BackupCreationOptions = {}
): Promise<BackupResult> {
  return backupSystemClient.createBackup(options);
}
