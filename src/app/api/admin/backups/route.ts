import { NextRequest, NextResponse } from 'next/server';

import { requireAttendanceManagementRequest } from '@/lib/admin-attendance';
import { backupSystem } from '@/lib/backup-system';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BackupAction = 'create' | 'restore';

type BackupCreationOptions = {
  reason?: string;
  safetyBackupOf?: string;
  skipCleanup?: boolean;
};

function normalizeMetadata(metadata: any) {
  if (!metadata) {
    return metadata;
  }

  return {
    ...metadata,
    timestamp:
      metadata.timestamp instanceof Date
        ? metadata.timestamp.toISOString()
        : String(metadata.timestamp || ''),
  };
}

export async function GET(request: NextRequest) {
  const authResult = await requireAttendanceManagementRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const backups = await backupSystem.listBackups();
    return NextResponse.json({
      success: true,
      backups: backups.map((backup) => normalizeMetadata(backup)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Erro ao listar backups.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAttendanceManagementRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'create') as BackupAction;

    if (action === 'create') {
      const rawOptions = body.options;
      const options: BackupCreationOptions =
        rawOptions && typeof rawOptions === 'object'
          ? {
              reason:
                typeof rawOptions.reason === 'string'
                  ? rawOptions.reason
                  : undefined,
              safetyBackupOf:
                typeof rawOptions.safetyBackupOf === 'string'
                  ? rawOptions.safetyBackupOf
                  : undefined,
              skipCleanup:
                typeof rawOptions.skipCleanup === 'boolean'
                  ? rawOptions.skipCleanup
                  : undefined,
            }
          : {};

      const result = await backupSystem.createBackup(options);
      return NextResponse.json({
        ...result,
        metadata: normalizeMetadata(result.metadata),
      });
    }

    if (action === 'restore') {
      const backupId = String(body.backupId || '');
      if (!backupId) {
        return NextResponse.json(
          { success: false, message: 'backupId nao informado.' },
          { status: 400 }
        );
      }

      const restored = await backupSystem.restoreFromBackup(backupId);
      return NextResponse.json({ success: restored });
    }

    return NextResponse.json(
      { success: false, message: 'Acao de backup invalida.' },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Erro ao executar acao de backup.',
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAttendanceManagementRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json().catch(() => ({}));
    const backupId = String(body.backupId || '');

    if (!backupId) {
      return NextResponse.json(
        { success: false, message: 'backupId nao informado.' },
        { status: 400 }
      );
    }

    const deleted = await backupSystem.deleteBackup(backupId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: 'Nao foi possivel excluir o backup.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : 'Erro ao excluir backup.',
      },
      { status: 400 }
    );
  }
}
