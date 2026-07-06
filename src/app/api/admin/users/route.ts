import { NextRequest, NextResponse } from 'next/server';

import {
  createManagedUser,
  CreateManagedUserResult,
  deleteManagedUser,
  listManagedUsers,
  requireAdminRequest,
  updateManagedUser,
} from '@/lib/admin-user-management';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getErrorMessage(error: unknown) {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

  switch (errorCode) {
    case 'auth/email-already-exists':
      return 'Este email já está cadastrado no Firebase Authentication.';
    case 'auth/invalid-email':
      return 'O email informado é inválido.';
    case 'auth/invalid-password':
      return 'A senha deve conter pelo menos 6 caracteres.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado no Firebase Authentication.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Ocorreu um erro ao processar a solicitação de usuários.';
  }
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdminRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const users = await listManagedUsers();
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdminRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    const result: CreateManagedUserResult = await createManagedUser(
      {
        email: String(body.email || ''),
        password: String(body.password || ''),
        displayName: String(body.displayName || ''),
        accessProfile: body.accessProfile || 'basic',
        permissions: Array.isArray(body.permissions) ? body.permissions : undefined,
      },
      authResult.access
    );

    return NextResponse.json({
      success: true,
      message:
        result.mode === 'resynced'
          ? 'Usuário localizado e sincronizado com sucesso no Firebase.'
          : 'Usuário criado com sucesso e sincronizado com o Firebase.',
      uid: result.uid,
      mode: result.mode,
      user: result.user,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAdminRequest(request);
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();
    await updateManagedUser(
      {
        uid: String(body.uid || ''),
        email: String(body.email || ''),
        displayName: String(body.displayName || ''),
        accessProfile: body.accessProfile || 'basic',
        active: body.active !== false,
        password: body.password ? String(body.password) : undefined,
        permissions: Array.isArray(body.permissions) ? body.permissions : undefined,
      },
      authResult.access
    );

    return NextResponse.json({
      success: true,
      message: 'Usuário atualizado com sucesso.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: getErrorMessage(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
      { success: false, message: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
