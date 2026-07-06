import { NextRequest, NextResponse } from 'next/server';

import {
  deleteManagedAttendance,
  requireAttendanceManagementRequest,
} from '@/lib/admin-attendance';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: NextRequest) {
  const authResult = await requireAttendanceManagementRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const result = await deleteManagedAttendance(String(body.id || ''), authResult.access);

    return NextResponse.json({
      success: true,
      message: `Registro de ${result.fullName} excluido com sucesso.`,
      photoUrl: result.photoUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao excluir registro de presenca.',
      },
      { status: 400 }
    );
  }
}
