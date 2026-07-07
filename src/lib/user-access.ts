import { UserType } from '@/lib/auth';
import { Permission } from '@/lib/types';

export type ManagedUserRole = 'admin' | 'editor' | 'basic_user' | 'baptism_user' | 'user';
export type ManagedAccessProfile = 'admin' | 'editor' | 'basic' | 'baptism';
export type ManagedUserType = UserType | 'ADMIN_USER';
export type NavigationPermission = Extract<
  Permission,
  'dashboard' | 'presencadecadastrados' | 'reports' | 'scanner' | 'register' | 'baptism' | 'sedeEstadual' | 'letters' | 'config' | 'admin_users'
>;

export interface AccessProfileConfig {
  accessProfile: ManagedAccessProfile;
  label: string;
  shortLabel: string;
  description: string;
  userType: ManagedUserType;
  role: ManagedUserRole;
  permissions: NavigationPermission[];
  canEditAttendance: boolean;
  canRegister: boolean;
  canViewAttendance: boolean;
  canManageUsers: boolean;
  canAccessReports: boolean;
}

export interface PermissionOption {
  permission: NavigationPermission;
  label: string;
  description: string;
}

export const NAVIGATION_PERMISSION_OPTIONS: PermissionOption[] = [
  {
    permission: 'dashboard',
    label: 'Dashboard',
    description: 'Painel inicial e visão geral do sistema.',
  },
  {
    permission: 'presencadecadastrados',
    label: 'Presença de Cadastrados',
    description: 'Lista e acompanhamento dos cadastros já registrados.',
  },
  {
    permission: 'reports',
    label: 'Relatórios',
    description: 'Indicadores, totais e relatórios operacionais.',
  },
  {
    permission: 'scanner',
    label: 'Scanner QR Code',
    description: 'Tela de leitura e registro por QR Code.',
  },
  {
    permission: 'register',
    label: 'Cadastrar Membros',
    description: 'Formulário principal de cadastro de membros.',
  },
  {
    permission: 'baptism',
    label: 'Batismo',
    description: 'Dashboard e registros específicos de batismo.',
  },
  {
    permission: 'sedeEstadual',
    label: 'Sede Estadual',
    description: 'Cadastro de membros da Sede Estadual.',
  },
  {
    permission: 'letters',
    label: 'Cartas',
    description: 'Rotinas de carta de recomendação e documentos correlatos.',
  },
  {
    permission: 'config',
    label: 'Configurações',
    description: 'Acesso à área administrativa de configurações.',
  },
  {
    permission: 'admin_users',
    label: 'Gestão de Usuários',
    description: 'Gerenciamento avançado de contas administrativas.',
  },
];

const ACCESS_PROFILE_CONFIGS: Record<ManagedAccessProfile, AccessProfileConfig> = {
  admin: {
    accessProfile: 'admin',
    label: 'Administrador do Sistema',
    shortLabel: 'Administrador',
    description: 'Acesso completo ao dashboard, cadastros, relatórios e configurações administrativas.',
    userType: 'ADMIN_USER',
    role: 'admin',
    permissions: [
      'dashboard',
      'presencadecadastrados',
      'reports',
      'scanner',
      'register',
      'baptism',
      'sedeEstadual',
      'letters',
      'config',
      'admin_users',
    ],
    canEditAttendance: true,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: true,
    canAccessReports: true,
  },
  editor: {
    accessProfile: 'editor',
    label: 'Editor de Presença',
    shortLabel: 'Editor',
    description: 'Pode registrar, editar presenças e acessar relatórios operacionais.',
    userType: UserType.EDITOR_USER,
    role: 'editor',
    permissions: ['dashboard', 'presencadecadastrados', 'reports', 'scanner', 'register', 'baptism', 'sedeEstadual', 'letters'],
    canEditAttendance: true,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: false,
    canAccessReports: true,
  },
  basic: {
    accessProfile: 'basic',
    label: 'Usuário Operacional',
    shortLabel: 'Usuário',
    description: 'Pode registrar cadastros, consultar presença e emitir cartas.',
    userType: UserType.BASIC_USER,
    role: 'basic_user',
    permissions: ['dashboard', 'presencadecadastrados', 'scanner', 'register', 'baptism', 'letters'],
    canEditAttendance: false,
    canRegister: true,
    canViewAttendance: true,
    canManageUsers: false,
    canAccessReports: false,
  },
  baptism: {
    accessProfile: 'baptism',
    label: 'Operador de Batismo',
    shortLabel: 'Batismo',
    description: 'Acesso dedicado apenas ao dashboard e ao módulo de batismo.',
    userType: UserType.BAPTISM_USER,
    role: 'baptism_user',
    permissions: ['dashboard', 'baptism'],
    canEditAttendance: false,
    canRegister: false,
    canViewAttendance: false,
    canManageUsers: false,
    canAccessReports: false,
  },
};

const ROLE_TO_ACCESS_PROFILE: Record<ManagedUserRole, ManagedAccessProfile> = {
  admin: 'admin',
  editor: 'editor',
  basic_user: 'basic',
  baptism_user: 'baptism',
  user: 'basic',
};

export function getAccessProfileConfig(accessProfile: ManagedAccessProfile): AccessProfileConfig {
  return ACCESS_PROFILE_CONFIGS[accessProfile];
}

export function getAccessProfileOptions(): AccessProfileConfig[] {
  return Object.values(ACCESS_PROFILE_CONFIGS);
}

export function getAccessProfileFromRole(role?: string | null): ManagedAccessProfile {
  if (!role) {
    return 'basic';
  }

  return ROLE_TO_ACCESS_PROFILE[role as ManagedUserRole] ?? 'basic';
}

export function getRoleLabel(role?: string | null) {
  return getAccessProfileConfig(getAccessProfileFromRole(role)).shortLabel;
}

export function getRoleDescription(role?: string | null) {
  return getAccessProfileConfig(getAccessProfileFromRole(role)).description;
}

export function normalizeNavigationPermissions(permissions: string[] | undefined, accessProfile: ManagedAccessProfile) {
  const fallbackPermissions = getAccessProfileConfig(accessProfile).permissions;
  const filtered = Array.isArray(permissions)
    ? permissions.filter((permission): permission is NavigationPermission =>
        NAVIGATION_PERMISSION_OPTIONS.some((option) => option.permission === permission)
      )
    : [];

  const permissionSet = new Set<NavigationPermission>(filtered.length > 0 ? filtered : fallbackPermissions);
  permissionSet.add('dashboard');

  return NAVIGATION_PERMISSION_OPTIONS
    .map((option) => option.permission)
    .filter((permission) => permissionSet.has(permission));
}

export function hasCustomNavigationPermissions(
  permissions: string[] | undefined,
  accessProfile: ManagedAccessProfile
) {
  const normalized = normalizeNavigationPermissions(permissions, accessProfile);
  const base = getAccessProfileConfig(accessProfile).permissions;

  return normalized.length !== base.length || normalized.some((permission, index) => permission !== base[index]);
}

export function deriveCapabilityFlags(permissions: NavigationPermission[]) {
  const permissionSet = new Set(permissions);

  return {
    canEditAttendance: permissionSet.has('reports') || permissionSet.has('admin_users'),
    canRegister: permissionSet.has('register') || permissionSet.has('baptism') || permissionSet.has('scanner'),
    canViewAttendance: permissionSet.has('presencadecadastrados') || permissionSet.has('reports') || permissionSet.has('dashboard'),
    canManageUsers: permissionSet.has('config') || permissionSet.has('admin_users'),
    canAccessReports: permissionSet.has('reports'),
  };
}
