import { NextRequest, NextResponse } from 'next/server';

import { requireAttendanceManagementRequest } from '@/lib/admin-attendance';
import { getAdminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toIsoDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const parsed = (value as { toDate?: () => Date }).toDate?.();
    if (parsed instanceof Date && !Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  return null;
}

function normalizeCpf(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value : fallback;
  return raw.replace(/\D/g, '');
}

export async function GET(request: NextRequest) {
  const authResult = await requireAttendanceManagementRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const snapshot = await getAdminDb().collection('members').get();

    const members = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        cpf: normalizeCpf(data.cpf, doc.id),
        fullName: typeof data.fullName === 'string' ? data.fullName : '',
        birthday: typeof data.birthday === 'string' ? data.birthday : '',
        reclassification: typeof data.reclassification === 'string' ? data.reclassification : '',
        pastorName: typeof data.pastorName === 'string' ? data.pastorName : '',
        region: typeof data.region === 'string' ? data.region : '',
        churchPosition: typeof data.churchPosition === 'string' ? data.churchPosition : '',
        city: typeof data.city === 'string' ? data.city : '',
        shift: typeof data.shift === 'string' ? data.shift : '',
        totvs: typeof data.totvs === 'string' ? data.totvs : '',
        etda: typeof data.etda === 'string' ? data.etda : '',
        status: typeof data.status === 'string' ? data.status : 'Ausente',
        photoUrl: typeof data.photoUrl === 'string' ? data.photoUrl : null,
        absentReason: typeof data.absentReason === 'string' ? data.absentReason : '',
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
        lastPresenceAt: toIsoDate(data.lastPresenceAt),
        sourceCollection: 'members',
      };
    });

    return NextResponse.json({
      success: true,
      members,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao listar membros.',
      },
      { status: 500 }
    );
  }
}
