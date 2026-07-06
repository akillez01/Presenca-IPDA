import { NextRequest, NextResponse } from 'next/server';

import { deleteManagedUser, requireAdminRequest } from '@/lib/admin-user-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authResult = await requireAdminRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    await deleteManagedUser(String(body.uid || ''), authResult.access);

    return NextResponse.json({
      success: true,
      message: 'Usuário excluído com sucesso.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao excluir usuário.',
      },
      { status: 400 }
    );
  }
}
