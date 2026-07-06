import type { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const SUPER_USER_EMAILS = new Set(['admin@ipda.org.br', 'marciodesk@ipda.app.br']);
const ATTENDANCE_ALLOWED_EMAILS = new Set([
  'presente@ipda.app.br',
  'secretaria@ipda.org.br',
  'auxiliar@ipda.org.br',
  'cadastro@ipda.app.br',
  'registro1@ipda.app.br',
  'registro2@ipda.app.br',
  'registro3@ipda.app.br',
  'registro4@ipda.app.br',
]);
const ATTENDANCE_ALLOWED_ROLES = new Set(['basic_user', 'user', 'editor', 'admin', 'super']);
const ATTENDANCE_ALLOWED_USER_TYPES = new Set(['BASIC_USER', 'EDITOR_USER', 'ADMIN_USER', 'SUPER_USER']);
const ATTENDANCE_ALLOWED_PERMISSIONS = new Set([
  'presencadecadastrados',
  'edit_attendance',
  'reports',
  'admin_users',
]);

type AttendanceAccessContext = {
  uid: string;
  email: string;
  role?: string | null;
  userType?: string | null;
  permissions: string[];
};

function normalizePermissions(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((value): value is string => typeof value === 'string');
}

function resolveAttendanceAccess(
  decodedToken: DecodedIdToken,
  profile: Record<string, unknown>
): AttendanceAccessContext | null {
  const email = decodedToken.email || '';
  const tokenRole = typeof decodedToken.role === 'string' ? decodedToken.role : null;
  const tokenUserType = typeof decodedToken.userType === 'string' ? decodedToken.userType : null;
  const tokenPermissions = normalizePermissions(decodedToken.permissions);
  const profilePermissions = normalizePermissions(profile.permissions);
  const permissions = Array.from(new Set([...tokenPermissions, ...profilePermissions]));
  const role = typeof profile.role === 'string' ? profile.role : tokenRole;
  const userType = typeof profile.userType === 'string' ? profile.userType : tokenUserType;

  const canManageAttendance =
    SUPER_USER_EMAILS.has(email) ||
    ATTENDANCE_ALLOWED_EMAILS.has(email) ||
    profile.canEditAttendance === true ||
    profile.canViewAttendance === true ||
    profile.canManageUsers === true ||
    Boolean(role && ATTENDANCE_ALLOWED_ROLES.has(role)) ||
    Boolean(userType && ATTENDANCE_ALLOWED_USER_TYPES.has(userType)) ||
    permissions.some((permission) => ATTENDANCE_ALLOWED_PERMISSIONS.has(permission));

  if (!canManageAttendance) {
    return null;
  }

  return {
    uid: decodedToken.uid,
    email,
    role,
    userType,
    permissions,
  };
}

export async function requireAttendanceManagementRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Sessao invalida. Faca login novamente para continuar.' },
        { status: 401 }
      ),
    };
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const profileSnap = await getAdminDb().collection('users').doc(decodedToken.uid).get();
    const profile = profileSnap.exists ? (profileSnap.data() as Record<string, unknown>) : {};
    const access = resolveAttendanceAccess(decodedToken, profile);

    if (!access) {
      return {
        error: NextResponse.json(
          { success: false, message: 'Acesso negado para excluir registros de presenca.' },
          { status: 403 }
        ),
      };
    }

    return { access };
  } catch {
    return {
      error: NextResponse.json(
        { success: false, message: 'Nao foi possivel validar a sessao do usuario.' },
        { status: 401 }
      ),
    };
  }
}

export async function deleteManagedAttendance(id: string, access: AttendanceAccessContext) {
  if (!id) {
    throw new Error('ID do registro nao informado.');
  }

  const adminDb = getAdminDb();
  const docRef = adminDb.collection('attendance').doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new Error('Registro de presenca nao encontrado.');
  }

  const data = docSnap.data() || {};
  const fullName = typeof data.fullName === 'string' && data.fullName ? data.fullName : 'registro';
  const cpf = typeof data.cpf === 'string' ? data.cpf : null;
  const photoUrl = typeof data.photoUrl === 'string' ? data.photoUrl : null;

  await docRef.delete();

  await adminDb.collection('audit_logs').add({
    event: 'ATTENDANCE_RECORD_DELETED',
    timestamp: new Date(),
    data: {
      attendanceId: id,
      fullName,
      cpf,
      deletedBy: access.email,
      deletedByUid: access.uid,
      role: access.role || null,
      userType: access.userType || null,
    },
  });

  return {
    fullName,
    photoUrl,
  };
}
