import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DecodedIdToken, UpdateRequest, UserRecord } from 'firebase-admin/auth';
import { NextRequest, NextResponse } from 'next/server';

import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  deriveCapabilityFlags,
  getAccessProfileConfig,
  getAccessProfileFromRole,
  ManagedAccessProfile,
  ManagedUserRole,
  normalizeNavigationPermissions,
} from '@/lib/user-access';

const SUPER_USER_EMAILS = new Set(['admin@ipda.org.br', 'marciodesk@ipda.app.br']);

export interface ManagedUserRecord {
  uid: string;
  email: string;
  displayName: string;
  role: ManagedUserRole;
  accessProfile: ManagedAccessProfile;
  userType: string;
  permissions: string[];
  active: boolean;
  disabled: boolean;
  emailVerified: boolean;
  canEditAttendance: boolean;
  canRegister: boolean;
  canViewAttendance: boolean;
  canManageUsers: boolean;
  canAccessReports: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  syncStatus: 'synced' | 'auth_only' | 'firestore_only';
  isProtected: boolean;
}

export interface CreateManagedUserInput {
  email: string;
  password: string;
  displayName: string;
  accessProfile: ManagedAccessProfile;
  permissions?: string[];
}

export interface CreateManagedUserResult {
  uid: string;
  mode: 'created' | 'resynced';
  user: ManagedUserRecord;
}

export interface UpdateManagedUserInput {
  uid: string;
  email: string;
  displayName: string;
  accessProfile: ManagedAccessProfile;
  active: boolean;
  password?: string;
  permissions?: string[];
}

type AdminAccessContext = {
  uid: string;
  email: string;
  role?: string | null;
  permissions: string[];
};

type StoredUserProfile = {
  id?: string;
  email?: string;
  displayName?: string;
  nome?: string;
  role?: string;
  userType?: string;
  permissions?: unknown[];
  active?: boolean;
  emailVerified?: boolean;
  canEditAttendance?: boolean;
  canRegister?: boolean;
  canViewAttendance?: boolean;
  canManageUsers?: boolean;
  canAccessReports?: boolean;
  createdAt?: unknown;
  lastLoginAt?: unknown;
};

type StoredProfileEntry = {
  id: string;
  data: StoredUserProfile;
};

function normalizeDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}

function buildClaims(accessProfile: ManagedAccessProfile, permissions: string[] | undefined, active: boolean) {
  const config = getAccessProfileConfig(accessProfile);
  const normalizedPermissions = normalizeNavigationPermissions(permissions, accessProfile);
  const capabilities = deriveCapabilityFlags(normalizedPermissions);

  return {
    role: config.role,
    userType: config.userType,
    permissions: normalizedPermissions,
    canManageUsers: capabilities.canManageUsers,
    canAccessReports: capabilities.canAccessReports,
    canEditAttendance: capabilities.canEditAttendance,
    canRegister: capabilities.canRegister,
    canViewAttendance: capabilities.canViewAttendance,
    active,
  };
}

function buildFirestoreProfile(
  uid: string,
  email: string,
  displayName: string,
  accessProfile: ManagedAccessProfile,
  permissions: string[] | undefined,
  active: boolean,
  emailVerified: boolean,
  updatedBy: string,
  createdAt?: FieldValue | string
) {
  const config = getAccessProfileConfig(accessProfile);
  const normalizedPermissions = normalizeNavigationPermissions(permissions, accessProfile);
  const capabilities = deriveCapabilityFlags(normalizedPermissions);
  const now = new Date().toISOString();

  return {
    uid,
    email,
    displayName,
    nome: displayName,
    cargo: config.userType,
    userType: config.userType,
    role: config.role,
    permissions: normalizedPermissions,
    canEditAttendance: capabilities.canEditAttendance,
    canRegister: capabilities.canRegister,
    canViewAttendance: capabilities.canViewAttendance,
    canManageUsers: capabilities.canManageUsers,
    canAccessReports: capabilities.canAccessReports,
    createdAt: createdAt ?? now,
    updatedAt: now,
    lastUpdated: now,
    updatedBy,
    active,
    isActive: active,
    emailVerified,
    lastLoginAt: null,
  };
}

function isProtectedUser(email?: string | null) {
  return Boolean(email && SUPER_USER_EMAILS.has(email));
}

function isImmutableAdminRole(role?: string | null) {
  return role === 'admin' || role === 'super';
}

function isImmutableAdminAccount(params: {
  email?: string | null;
  role?: string | null;
  accessProfile?: ManagedAccessProfile;
  userType?: string | null;
}) {
  return (
    isProtectedUser(params.email) ||
    isImmutableAdminRole(params.role) ||
    params.accessProfile === 'admin' ||
    params.userType === 'ADMIN_USER'
  );
}

function buildManagedUserRecord(params: {
  uid: string;
  authUser?: UserRecord | null;
  profile?: StoredUserProfile | null;
}): ManagedUserRecord {
  const { uid, authUser, profile } = params;
  const claimRole =
    typeof authUser?.customClaims?.role === 'string'
      ? (authUser.customClaims.role as ManagedUserRole)
      : undefined;
  const role = (typeof profile?.role === 'string' ? (profile.role as ManagedUserRole) : claimRole) || 'basic_user';
  const accessProfile = getAccessProfileFromRole(role);
  const userType =
    (typeof profile?.userType === 'string' && profile.userType) ||
    (typeof authUser?.customClaims?.userType === 'string' ? authUser.customClaims.userType : undefined) ||
    getAccessProfileConfig(accessProfile).userType;
  const storedPermissions = Array.isArray(profile?.permissions)
    ? profile.permissions.filter((value): value is string => typeof value === 'string')
    : Array.isArray(authUser?.customClaims?.permissions)
      ? authUser.customClaims.permissions.filter((value): value is string => typeof value === 'string')
      : undefined;
  const permissions = normalizeNavigationPermissions(storedPermissions, accessProfile);
  const capabilities = deriveCapabilityFlags(permissions);
  const active = authUser ? profile?.active !== false && authUser.disabled !== true : profile?.active !== false;

  return {
    uid,
    email:
      authUser?.email ||
      (typeof profile?.email === 'string' ? profile.email : ''),
    displayName:
      authUser?.displayName ||
      (typeof profile?.displayName === 'string' && profile.displayName) ||
      (typeof profile?.nome === 'string' && profile.nome) ||
      'Usuário',
    role,
    accessProfile,
    userType,
    permissions,
    active,
    disabled: authUser?.disabled === true,
    emailVerified: authUser?.emailVerified === true || profile?.emailVerified === true,
    canEditAttendance: capabilities.canEditAttendance,
    canRegister: capabilities.canRegister,
    canViewAttendance: capabilities.canViewAttendance,
    canManageUsers: capabilities.canManageUsers,
    canAccessReports: capabilities.canAccessReports,
    createdAt: normalizeDate(profile?.createdAt) || authUser?.metadata.creationTime || null,
    lastLoginAt: normalizeDate(profile?.lastLoginAt) || authUser?.metadata.lastSignInTime || null,
    syncStatus: authUser && profile ? 'synced' : authUser ? 'auth_only' : 'firestore_only',
    isProtected: isImmutableAdminAccount({
      email: authUser?.email || (typeof profile?.email === 'string' ? profile.email : undefined),
      role,
      accessProfile,
      userType,
    }),
  };
}

async function findStoredProfilesByEmail(email: string): Promise<StoredProfileEntry[]> {
  const snapshot = await getAdminDb().collection('users').where('email', '==', email).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    data: {
      id: doc.id,
      ...(doc.data() as StoredUserProfile),
    },
  }));
}

async function upsertManagedUserProfile(params: {
  uid: string;
  email: string;
  displayName: string;
  accessProfile: ManagedAccessProfile;
  permissions?: string[];
  active: boolean;
  emailVerified: boolean;
  updatedBy: string;
  createdAt?: string;
}) {
  const adminDb = getAdminDb();
  const duplicateProfiles = await findStoredProfilesByEmail(params.email);
  const currentProfileSnap = await adminDb.collection('users').doc(params.uid).get();
  const currentProfile = currentProfileSnap.exists ? (currentProfileSnap.data() as StoredUserProfile) : null;
  const legacyProfile = duplicateProfiles.find((profile) => profile.id !== params.uid)?.data;
  const preservedCreatedAt =
    params.createdAt ||
    normalizeDate(currentProfile?.createdAt) ||
    normalizeDate(legacyProfile?.createdAt) ||
    new Date().toISOString();
  const preservedLastLoginAt = currentProfile?.lastLoginAt ?? legacyProfile?.lastLoginAt ?? null;

  await adminDb
    .collection('users')
    .doc(params.uid)
    .set(
      {
        ...buildFirestoreProfile(
          params.uid,
          params.email,
          params.displayName,
          params.accessProfile,
          params.permissions,
          params.active,
          params.emailVerified,
          params.updatedBy,
          preservedCreatedAt
        ),
        lastLoginAt: preservedLastLoginAt,
      },
      { merge: true }
    );

  await Promise.all(
    duplicateProfiles
      .filter((profile) => profile.id !== params.uid)
      .map((profile) => adminDb.collection('users').doc(profile.id).delete())
  );
}

export async function getManagedUserRecord(uid: string): Promise<ManagedUserRecord | null> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();

  let authUser: UserRecord | null = null;

  try {
    authUser = await adminAuth.getUser(uid);
  } catch (error) {
    authUser = null;
  }

  const profileSnap = await adminDb.collection('users').doc(uid).get();
  const profile = profileSnap.exists ? (profileSnap.data() as StoredUserProfile) : null;

  if (!authUser && !profile) {
    return null;
  }

  return buildManagedUserRecord({ uid, authUser, profile });
}

async function resolveAdminAccess(decodedToken: DecodedIdToken): Promise<AdminAccessContext | null> {
  const email = decodedToken.email || '';
  const tokenPermissions = Array.isArray(decodedToken.permissions)
    ? decodedToken.permissions.filter((value): value is string => typeof value === 'string')
    : [];

  if (isProtectedUser(email)) {
    return {
      uid: decodedToken.uid,
      email,
      role: 'super',
      permissions: tokenPermissions,
    };
  }

  const profileSnap = await getAdminDb().collection('users').doc(decodedToken.uid).get();

  if (!profileSnap.exists) {
    return null;
  }

  const profile = profileSnap.data() || {};
  const profilePermissions = Array.isArray(profile.permissions)
    ? profile.permissions.filter((value): value is string => typeof value === 'string')
    : [];
  const permissions = Array.from(new Set([...tokenPermissions, ...profilePermissions]));
  const hasAdminAccess =
    profile.role === 'admin' ||
    profile.canManageUsers === true ||
    permissions.includes('config') ||
    permissions.includes('admin_users') ||
    permissions.includes('user_management') ||
    permissions.includes('settings');

  if (!hasAdminAccess) {
    return null;
  }

  return {
    uid: decodedToken.uid,
    email,
    role: typeof profile.role === 'string' ? profile.role : null,
    permissions,
  };
}

export async function requireAdminRequest(request: NextRequest) {
  const authorization = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Sessão inválida. Faça login novamente para continuar.' },
        { status: 401 }
      ),
    };
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const access = await resolveAdminAccess(decodedToken);

    if (!access) {
      return {
        error: NextResponse.json(
          { success: false, message: 'Acesso negado para gerenciamento de usuários.' },
          { status: 403 }
        ),
      };
    }

    return { access };
  } catch (error) {
    return {
      error: NextResponse.json(
        { success: false, message: 'Não foi possível validar a sessão administrativa.' },
        { status: 401 }
      ),
    };
  }
}

export async function listManagedUsers(): Promise<ManagedUserRecord[]> {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const authUsers: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    authUsers.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);

  const profileSnap = await adminDb.collection('users').get();
  const profileMap = new Map<string, StoredUserProfile>(
    profileSnap.docs.map((doc) => [
      doc.id,
      {
        id: doc.id,
        ...(doc.data() as StoredUserProfile),
      },
    ])
  );

  const managedUsers: ManagedUserRecord[] = authUsers.map((authUser) =>
    buildManagedUserRecord({
      uid: authUser.uid,
      authUser,
      profile: profileMap.get(authUser.uid) || null,
    })
  );

  for (const [uid, profile] of profileMap.entries()) {
    if (authUsers.some((authUser) => authUser.uid === uid)) {
      continue;
    }

    managedUsers.push(
      buildManagedUserRecord({
        uid,
        profile,
      })
    );
  }

  return managedUsers.sort((left, right) =>
    `${left.displayName} ${left.email}`.localeCompare(`${right.displayName} ${right.email}`, 'pt-BR', {
      sensitivity: 'base',
    })
  );
}

export async function createManagedUser(
  input: CreateManagedUserInput,
  adminAccess: AdminAccessContext
): Promise<CreateManagedUserResult> {
  const adminAuth = getAdminAuth();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password.trim();

  if (!email || !password || !displayName) {
    throw new Error('Preencha nome, email e senha para criar o usuário.');
  }

  if (input.accessProfile === 'admin') {
    throw new Error('O perfil Administrador nao pode ser criado por este painel.');
  }

  let existingAuthUser: UserRecord | null = null;

  try {
    existingAuthUser = await adminAuth.getUserByEmail(email);
  } catch (error) {
    existingAuthUser = null;
  }

  if (existingAuthUser) {
    const existingManagedUser = await getManagedUserRecord(existingAuthUser.uid);

    if (
      existingManagedUser &&
      isImmutableAdminAccount({
        email: existingManagedUser.email,
        role: existingManagedUser.role,
        accessProfile: existingManagedUser.accessProfile,
        userType: existingManagedUser.userType,
      })
    ) {
      throw new Error('Contas administrativas nao podem ser alteradas por este painel.');
    }

    await adminAuth.updateUser(existingAuthUser.uid, {
      email,
      password,
      displayName,
      disabled: false,
    });
    await adminAuth.setCustomUserClaims(
      existingAuthUser.uid,
      buildClaims(input.accessProfile, input.permissions, true)
    );
    await upsertManagedUserProfile({
      uid: existingAuthUser.uid,
      email,
      displayName,
      accessProfile: input.accessProfile,
      permissions: input.permissions,
      active: true,
      emailVerified: existingAuthUser.emailVerified === true,
      updatedBy: adminAccess.email,
      createdAt: existingManagedUser?.createdAt || undefined,
    });

    const syncedUser = await getManagedUserRecord(existingAuthUser.uid);

    if (!syncedUser || syncedUser.syncStatus !== 'synced') {
      throw new Error('O usuario foi localizado, mas nao foi possivel sincronizar Authentication e Firestore.');
    }

    return {
      uid: existingAuthUser.uid,
      mode: 'resynced',
      user: syncedUser,
    };
  }

  let createdUid: string | null = null;

  try {
    const createdUser = await adminAuth.createUser({
      email,
      password,
      displayName,
      disabled: false,
      emailVerified: false,
    });

    createdUid = createdUser.uid;
    await adminAuth.setCustomUserClaims(createdUser.uid, buildClaims(input.accessProfile, input.permissions, true));
    await upsertManagedUserProfile({
      uid: createdUser.uid,
      email,
      displayName,
      accessProfile: input.accessProfile,
      permissions: input.permissions,
      active: true,
      emailVerified: false,
      updatedBy: adminAccess.email,
      createdAt: new Date().toISOString(),
    });

    const syncedUser = await getManagedUserRecord(createdUser.uid);

    if (!syncedUser || syncedUser.syncStatus !== 'synced') {
      throw new Error('O usuario foi criado, mas a sincronizacao com o Firestore nao foi confirmada.');
    }

    return {
      uid: createdUser.uid,
      mode: 'created',
      user: syncedUser,
    };
  } catch (error) {
    if (createdUid) {
      await adminAuth.deleteUser(createdUid).catch(() => undefined);
    }

    throw error;
  }
}

export async function updateManagedUser(input: UpdateManagedUserInput, adminAccess: AdminAccessContext) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const password = input.password?.trim();

  if (!input.uid || !email || !displayName) {
    throw new Error('Os campos nome, email e perfil são obrigatórios para atualizar.');
  }

  let authUser = null;

  try {
    authUser = await adminAuth.getUser(input.uid);
  } catch (error) {
    authUser = null;
  }

  const profileSnap = await adminDb.collection('users').doc(input.uid).get();
  const existingProfile = profileSnap.data() || {};
  const targetEmail = authUser?.email || email;
  const existingRole =
    typeof authUser?.customClaims?.role === 'string'
      ? authUser.customClaims.role
      : typeof existingProfile.role === 'string'
        ? existingProfile.role
        : null;
  const existingUserType =
    typeof authUser?.customClaims?.userType === 'string'
      ? authUser.customClaims.userType
      : typeof existingProfile.userType === 'string'
        ? existingProfile.userType
        : null;

  if (
    isImmutableAdminAccount({
      email: targetEmail,
      role: existingRole,
      accessProfile: input.accessProfile,
      userType: existingUserType,
    })
  ) {
    throw new Error('Contas administrativas nao podem ser alteradas por este painel.');
  }

  if (adminAccess.uid === input.uid && !input.active) {
    throw new Error('Você não pode desativar a própria conta administrativa.');
  }

  if (authUser) {
    const updatePayload: UpdateRequest = {
      email,
      displayName,
      disabled: !input.active,
    };

    if (password) {
      updatePayload.password = password;
    }

    await adminAuth.updateUser(input.uid, updatePayload);
    await adminAuth.setCustomUserClaims(
      input.uid,
      buildClaims(input.accessProfile, input.permissions, input.active)
    );
  }

  const emailVerified = authUser?.emailVerified === true || existingProfile.emailVerified === true;

  await adminDb
    .collection('users')
    .doc(input.uid)
    .set(
      {
        ...buildFirestoreProfile(
          input.uid,
          email,
          displayName,
          input.accessProfile,
          input.permissions,
          input.active,
          emailVerified,
          adminAccess.email,
          normalizeDate(existingProfile.createdAt) || new Date().toISOString()
        ),
        lastLoginAt: existingProfile.lastLoginAt ?? null,
      },
      { merge: true }
    );
}

export async function deleteManagedUser(uid: string, adminAccess: AdminAccessContext) {
  const adminAuth = getAdminAuth();
  const profileRef = getAdminDb().collection('users').doc(uid);

  if (!uid) {
    throw new Error('UID do usuário não informado.');
  }

  if (adminAccess.uid === uid) {
    throw new Error('Você não pode excluir a própria conta administrativa.');
  }

  let authEmail: string | undefined;
  let authRole: string | undefined;
  let authUserType: string | undefined;
  const profileSnap = await profileRef.get();
  const profile = profileSnap.exists ? profileSnap.data() || {} : {};

  try {
    const authUser = await adminAuth.getUser(uid);
    authEmail = authUser.email || undefined;
    authRole = typeof authUser.customClaims?.role === 'string' ? authUser.customClaims.role : undefined;
    authUserType =
      typeof authUser.customClaims?.userType === 'string' ? authUser.customClaims.userType : undefined;

    if (
      isImmutableAdminAccount({
        email: authEmail,
        role: authRole || (typeof profile.role === 'string' ? profile.role : undefined),
        accessProfile: getAccessProfileFromRole(
          typeof profile.role === 'string' ? profile.role : authRole
        ),
        userType: authUserType || (typeof profile.userType === 'string' ? profile.userType : undefined),
      })
    ) {
      throw new Error('Contas administrativas nao podem ser excluidas por este painel.');
    }

    await adminAuth.deleteUser(uid);
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

    if (errorCode !== 'auth/user-not-found') {
      throw error;
    }
  }

  if (profileSnap.exists) {
    if (
      isImmutableAdminAccount({
        email: typeof profile.email === 'string' ? profile.email : authEmail,
        role: typeof profile.role === 'string' ? profile.role : authRole,
        accessProfile: getAccessProfileFromRole(
          typeof profile.role === 'string' ? profile.role : authRole
        ),
        userType: typeof profile.userType === 'string' ? profile.userType : authUserType,
      })
    ) {
      throw new Error('Contas administrativas nao podem ser excluidas por este painel.');
    }
  }

  await profileRef.delete();
}
