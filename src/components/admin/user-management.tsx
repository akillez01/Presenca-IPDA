'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import {
  deriveCapabilityFlags,
  getAccessProfileConfig,
  getAccessProfileFromRole,
  getAccessProfileOptions,
  hasCustomNavigationPermissions,
  ManagedAccessProfile,
  NAVIGATION_PERMISSION_OPTIONS,
  NavigationPermission,
  normalizeNavigationPermissions,
} from '@/lib/user-access';
import {
  AlertTriangle,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react';

interface ManagedUser {
  uid: string;
  email: string;
  displayName: string;
  role: string;
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

interface CreateManagedUserResponse {
  uid: string;
  mode: 'created' | 'resynced';
  user: ManagedUser;
  message: string;
}

interface UserManagementProps {
  embedded?: boolean;
}

interface UserFormState {
  uid?: string;
  email: string;
  displayName: string;
  password: string;
  accessProfile: ManagedAccessProfile;
  permissions: NavigationPermission[];
  active: boolean;
}

type RoleFilterValue = 'all' | ManagedAccessProfile;

type TemplatePreset = {
  templateLabel: string;
  email: string;
  displayName: string;
  password: string;
  accessProfile: ManagedAccessProfile;
};

type ManagementMode = 'api' | 'firestore-readonly';

const PROTECTED_EMAILS = new Set(['admin@ipda.org.br', 'marciodesk@ipda.app.br']);

function normalizeStoredDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
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

function mapFirestoreUser(uid: string, data: Record<string, unknown>): ManagedUser {
  const role = typeof data.role === 'string' ? data.role : 'basic_user';
  const accessProfile = getAccessProfileFromRole(role);
  const permissions = normalizeNavigationPermissions(
    Array.isArray(data.permissions) ? data.permissions.filter((value): value is string => typeof value === 'string') : undefined,
    accessProfile
  );
  const capabilities = deriveCapabilityFlags(permissions);
  const active = data.active !== false && data.isActive !== false;
  const userType =
    typeof data.userType === 'string' && data.userType
      ? data.userType
      : getAccessProfileConfig(accessProfile).userType;
  const email = typeof data.email === 'string' ? data.email : '';

  return {
    uid,
    email,
    displayName:
      (typeof data.displayName === 'string' && data.displayName) ||
      (typeof data.nome === 'string' && data.nome) ||
      'Usuário',
    role,
    accessProfile,
    userType,
    permissions,
    active,
    disabled: !active,
    emailVerified: data.emailVerified === true,
    canEditAttendance:
      typeof data.canEditAttendance === 'boolean' ? data.canEditAttendance : capabilities.canEditAttendance,
    canRegister: typeof data.canRegister === 'boolean' ? data.canRegister : capabilities.canRegister,
    canViewAttendance:
      typeof data.canViewAttendance === 'boolean' ? data.canViewAttendance : capabilities.canViewAttendance,
    canManageUsers:
      typeof data.canManageUsers === 'boolean' ? data.canManageUsers : capabilities.canManageUsers,
    canAccessReports:
      typeof data.canAccessReports === 'boolean' ? data.canAccessReports : capabilities.canAccessReports,
    createdAt: normalizeStoredDate(data.createdAt) || normalizeStoredDate(data.updatedAt),
    lastLoginAt: normalizeStoredDate(data.lastLoginAt),
    syncStatus: 'synced',
    isProtected:
      PROTECTED_EMAILS.has(email) ||
      accessProfile === 'admin' ||
      role === 'admin' ||
      role === 'super' ||
      userType === 'ADMIN_USER',
  };
}

function buildFormState(
  accessProfile: ManagedAccessProfile,
  overrides: Omit<Partial<UserFormState>, 'permissions'> & { permissions?: string[] } = {}
): UserFormState {
  return {
    uid: overrides.uid,
    email: overrides.email ?? '',
    displayName: overrides.displayName ?? '',
    password: overrides.password ?? '',
    accessProfile,
    permissions: normalizeNavigationPermissions(overrides.permissions, accessProfile),
    active: overrides.active ?? true,
  };
}

const EMPTY_CREATE_FORM: UserFormState = buildFormState('basic');

const TEMPLATE_PRESETS: Record<string, TemplatePreset> = {
  secretaria: {
    templateLabel: 'Secretaria IPDA',
    email: 'secretaria@ipda.org.br',
    displayName: 'Secretaria IPDA',
    password: '',
    accessProfile: 'basic',
  },
  auxiliar: {
    templateLabel: 'Auxiliar IPDA',
    email: 'auxiliar@ipda.org.br',
    displayName: 'Auxiliar IPDA',
    password: '',
    accessProfile: 'basic',
  },
  cadastro: {
    templateLabel: 'Cadastro IPDA',
    email: 'cadastro@ipda.app.br',
    displayName: 'Cadastro IPDA',
    password: '',
    accessProfile: 'editor',
  },
  presente: {
    templateLabel: 'Controle de Presenca',
    email: 'presente@ipda.app.br',
    displayName: 'Controle de Presenca IPDA',
    password: '',
    accessProfile: 'editor',
  },
  batismo: {
    templateLabel: 'Operador de Batismo',
    email: 'batismo@ipda.app.br',
    displayName: 'Operador de Batismo IPDA',
    password: '',
    accessProfile: 'baptism',
  },
};

function formatDateTime(value: string | null) {
  if (!value) {
    return 'Nunca';
  }

  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
}

function getSyncBadge(syncStatus: ManagedUser['syncStatus']) {
  switch (syncStatus) {
    case 'synced':
      return {
        label: 'Sincronizado',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
      };
    case 'auth_only':
      return {
        label: 'Sem perfil',
        className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50',
      };
    case 'firestore_only':
      return {
        label: 'Sem auth',
        className: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50',
      };
    default:
      return {
        label: 'Indefinido',
        className: '',
      };
  }
}

function getRoleBadge(accessProfile: ManagedAccessProfile) {
  switch (accessProfile) {
    case 'admin':
      return 'bg-slate-900 text-white hover:bg-slate-900';
    case 'editor':
      return 'bg-blue-600 text-white hover:bg-blue-600';
    case 'baptism':
      return 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50';
    default:
      return 'bg-muted text-foreground hover:bg-muted';
  }
}

function getPermissionLabel(permission: string) {
  return (
    NAVIGATION_PERMISSION_OPTIONS.find((option) => option.permission === permission)?.label ?? permission
  );
}

function summarizePermissions(permissions: string[]) {
  return permissions.map((permission) => getPermissionLabel(permission));
}

export function UserManagement({ embedded = false }: UserManagementProps) {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingUid, setTogglingUid] = useState<string | null>(null);
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [managementMode, setManagementMode] = useState<ManagementMode>('api');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>('all');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('manual');
  const [createForm, setCreateForm] = useState<UserFormState>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<UserFormState>(EMPTY_CREATE_FORM);

  const accessProfileOptions = getAccessProfileOptions().filter(
    (profile) => profile.accessProfile !== 'admin'
  );

  const isReadOnlyMode = managementMode === 'firestore-readonly';

  const requestApi = async <T,>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, unknown>) => {
    if (!currentUser) {
      throw new Error('Sessao administrativa nao encontrada. Entre novamente no sistema.');
    }

    const authUser =
      typeof currentUser.getIdToken === 'function' ? currentUser : auth.currentUser;

    if (!authUser || typeof authUser.getIdToken !== 'function') {
      throw new Error('Sessao administrativa invalida. Atualize a pagina e tente novamente.');
    }

    const token = await authUser.getIdToken();
    const endpoint = process.env.NEXT_PUBLIC_ADMIN_USERS_API_URL || '/api/admin/users';
    const response = await fetch(endpoint, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload.success) {
      const error = new Error(
        payload?.message ||
          (response.status === 404
            ? 'A API administrativa não está disponível neste deploy.'
            : 'Falha ao comunicar com a API administrativa.')
      ) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    return payload as T;
  };

  const loadUsersFromFirestore = async () => {
    const snapshot = await getDocs(collection(db, 'users'));
    const firestoreUsers = snapshot.docs
      .map((doc) => mapFirestoreUser(doc.id, doc.data() as Record<string, unknown>))
      .sort((left, right) =>
        `${left.displayName} ${left.email}`.localeCompare(`${right.displayName} ${right.email}`, 'pt-BR', {
          sensitivity: 'base',
        })
      );

    setUsers(firestoreUsers);
    setManagementMode('firestore-readonly');
    setError(null);
  };

  const loadUsers = async (background = false) => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      setError(null);
      const payload = await requestApi<{ users: ManagedUser[] }>('GET');
      setUsers(payload.users);
      setManagementMode('api');
    } catch (loadError) {
      const status = loadError instanceof Error && 'status' in loadError ? (loadError as Error & { status?: number }).status : undefined;

      if (status === 404) {
        try {
          await loadUsersFromFirestore();
        } catch (fallbackError) {
          const message =
            fallbackError instanceof Error
              ? fallbackError.message
              : 'Nao foi possivel carregar os usuarios do Firestore.';
          setError(message);
        }
      } else {
        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Nao foi possivel carregar os usuarios administrativos.';
        setError(message);
      }
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadUsers();
    }
  }, [currentUser]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((managedUser) => {
      const matchesSearch =
        !normalizedSearch ||
        managedUser.email.toLowerCase().includes(normalizedSearch) ||
        managedUser.displayName.toLowerCase().includes(normalizedSearch);
      const matchesRole = roleFilter === 'all' || managedUser.accessProfile === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((managedUser) => managedUser.active).length;
    const admins = users.filter((managedUser) => managedUser.accessProfile === 'admin').length;
    const inconsistencies = users.filter((managedUser) => managedUser.syncStatus !== 'synced').length;

    return { total, active, admins, inconsistencies };
  }, [users]);
  const visibleUsersCount = filteredUsers.length;

  const createProfilePreview = getAccessProfileConfig(createForm.accessProfile);
  const editProfilePreview = getAccessProfileConfig(editForm.accessProfile);
  const createSelectedPermissions = normalizeNavigationPermissions(
    createForm.permissions,
    createForm.accessProfile
  );
  const editSelectedPermissions = normalizeNavigationPermissions(editForm.permissions, editForm.accessProfile);
  const createHasCustomPermissions = hasCustomNavigationPermissions(
    createForm.permissions,
    createForm.accessProfile
  );
  const editHasCustomPermissions = hasCustomNavigationPermissions(editForm.permissions, editForm.accessProfile);

  const resetCreateDialog = () => {
    setSelectedTemplate('manual');
    setCreateForm(buildFormState('basic'));
    setCreateDialogOpen(false);
  };

  const applyTemplate = (templateKey: string) => {
    setSelectedTemplate(templateKey);

    if (templateKey === 'manual') {
      setCreateForm(buildFormState('basic'));
      return;
    }

    const template = TEMPLATE_PRESETS[templateKey];

    if (!template) {
      return;
    }

    setCreateForm(
      buildFormState(template.accessProfile, {
        email: template.email,
        displayName: template.displayName,
        password: template.password,
        active: true,
      })
    );
  };

  const handleAccessProfileChange = (
    accessProfile: ManagedAccessProfile,
    setter: React.Dispatch<React.SetStateAction<UserFormState>>
  ) => {
    setter((currentForm) => ({
      ...currentForm,
      accessProfile,
      permissions: [...getAccessProfileConfig(accessProfile).permissions],
    }));
  };

  const handlePermissionToggle = (
    permission: NavigationPermission,
    checked: boolean,
    setter: React.Dispatch<React.SetStateAction<UserFormState>>
  ) => {
    if (permission === 'dashboard') {
      return;
    }

    setter((currentForm) => {
      const permissionSet = new Set(
        normalizeNavigationPermissions(currentForm.permissions, currentForm.accessProfile)
      );

      if (checked) {
        permissionSet.add(permission);
      } else {
        permissionSet.delete(permission);
      }

      return {
        ...currentForm,
        permissions: normalizeNavigationPermissions(Array.from(permissionSet), currentForm.accessProfile),
      };
    });
  };

  const resetPermissionsToProfile = (
    accessProfile: ManagedAccessProfile,
    setter: React.Dispatch<React.SetStateAction<UserFormState>>
  ) => {
    setter((currentForm) => ({
      ...currentForm,
      permissions: [...getAccessProfileConfig(accessProfile).permissions],
    }));
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isReadOnlyMode) {
      toast({
        title: 'Modo somente leitura',
        description: 'Neste deploy estático, a criação de usuários exige a API administrativa em ambiente Node.js.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const payload = await requestApi<CreateManagedUserResponse>('POST', {
        email: createForm.email,
        displayName: createForm.displayName,
        password: createForm.password,
        accessProfile: createForm.accessProfile,
        permissions: createSelectedPermissions,
      });

      setUsers((currentUsers) => {
        const remainingUsers = currentUsers.filter((managedUser) => managedUser.uid !== payload.user.uid);
        return [...remainingUsers, payload.user].sort((left, right) =>
          `${left.displayName} ${left.email}`.localeCompare(`${right.displayName} ${right.email}`, 'pt-BR', {
            sensitivity: 'base',
          })
        );
      });

      toast({
        title: payload.mode === 'resynced' ? 'Usuario sincronizado' : 'Usuario criado',
        description:
          payload.mode === 'resynced'
            ? `${createForm.displayName} foi sincronizado no Firebase Authentication e no Firestore.`
            : `${createForm.displayName} agora pode acessar o aplicativo com o perfil ${createProfilePreview.shortLabel}.`,
      });

      resetCreateDialog();
      await loadUsers(true);
    } catch (submitError) {
      toast({
        title: 'Erro ao criar usuario',
        description:
          submitError instanceof Error ? submitError.message : 'Nao foi possivel criar o usuario.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEditDialog = (managedUser: ManagedUser) => {
    setEditForm(
      buildFormState(managedUser.accessProfile, {
        uid: managedUser.uid,
        email: managedUser.email,
        displayName: managedUser.displayName,
        password: '',
        permissions: managedUser.permissions,
        active: managedUser.active,
      })
    );
    setEditDialogOpen(true);
  };

  const handleEditUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editForm.uid) {
      return;
    }

    if (isReadOnlyMode) {
      toast({
        title: 'Modo somente leitura',
        description: 'Neste deploy estático, a edição de usuários exige a API administrativa em ambiente Node.js.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      await requestApi('PATCH', {
        uid: editForm.uid,
        email: editForm.email,
        displayName: editForm.displayName,
        password: editForm.password || undefined,
        accessProfile: editForm.accessProfile,
        active: editForm.active,
        permissions: editSelectedPermissions,
      });

      toast({
        title: 'Usuario atualizado',
        description: `${editForm.displayName} foi atualizado com o perfil ${editProfilePreview.shortLabel}.`,
      });

      setEditDialogOpen(false);
      await loadUsers(true);
    } catch (submitError) {
      toast({
        title: 'Erro ao atualizar usuario',
        description:
          submitError instanceof Error ? submitError.message : 'Nao foi possivel atualizar o usuario.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (managedUser: ManagedUser, nextActive: boolean) => {
    if (isReadOnlyMode) {
      toast({
        title: 'Modo somente leitura',
        description: 'Neste deploy estático, a alteração de status exige a API administrativa em ambiente Node.js.',
        variant: 'destructive',
      });
      return;
    }

    setTogglingUid(managedUser.uid);

    try {
      await requestApi('PATCH', {
        uid: managedUser.uid,
        email: managedUser.email,
        displayName: managedUser.displayName,
        accessProfile: managedUser.accessProfile,
        active: nextActive,
        permissions: managedUser.permissions,
      });

      setUsers((currentUsers) =>
        currentUsers.map((currentManagedUser) =>
          currentManagedUser.uid === managedUser.uid
            ? {
                ...currentManagedUser,
                active: nextActive,
                disabled: !nextActive,
              }
            : currentManagedUser
        )
      );

      toast({
        title: nextActive ? 'Usuario ativado' : 'Usuario desativado',
        description: `${managedUser.displayName} foi ${nextActive ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (toggleError) {
      toast({
        title: 'Erro ao alterar status',
        description:
          toggleError instanceof Error ? toggleError.message : 'Nao foi possivel alterar o status do usuario.',
        variant: 'destructive',
      });
    } finally {
      setTogglingUid(null);
    }
  };

  const handleDeleteUser = async (managedUser: ManagedUser) => {
    if (isReadOnlyMode) {
      toast({
        title: 'Modo somente leitura',
        description: 'Neste deploy estático, a exclusão de usuários exige a API administrativa em ambiente Node.js.',
        variant: 'destructive',
      });
      return;
    }

    setDeletingUid(managedUser.uid);

    try {
      await requestApi('DELETE', { uid: managedUser.uid });
      setUsers((currentUsers) => currentUsers.filter((user) => user.uid !== managedUser.uid));

      toast({
        title: 'Usuario excluido',
        description: `${managedUser.displayName} foi removido do Firebase e do painel.`,
      });
    } catch (deleteError) {
      toast({
        title: 'Erro ao excluir usuario',
        description:
          deleteError instanceof Error ? deleteError.message : 'Nao foi possivel excluir o usuario.',
        variant: 'destructive',
      });
    } finally {
      setDeletingUid(null);
    }
  };

  const renderPermissionSelector = (
    form: UserFormState,
    selectedPermissions: NavigationPermission[],
    hasCustomPermissions: boolean,
    setter: React.Dispatch<React.SetStateAction<UserFormState>>
  ) => (
    <div className="space-y-4 rounded-xl border border-dashed border-slate-300 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="font-medium text-slate-900">Abas e módulos liberados</p>
          <p className="text-sm text-muted-foreground">
            Marque somente o que este usuário pode visualizar no aplicativo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{selectedPermissions.length} acesso(s)</Badge>
          {hasCustomPermissions && (
            <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
              Personalizado
            </Badge>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!hasCustomPermissions || submitting}
            onClick={() => resetPermissionsToProfile(form.accessProfile, setter)}
          >
            Restaurar perfil
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {NAVIGATION_PERMISSION_OPTIONS.map((option) => {
          const checked = selectedPermissions.includes(option.permission);
          const locked = option.permission === 'dashboard';

          return (
            <label
              key={option.permission}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                checked ? 'border-blue-200 bg-blue-50/70' : 'border-slate-200 bg-white'
              } ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <Checkbox
                checked={checked}
                disabled={locked || submitting}
                onCheckedChange={(value) => handlePermissionToggle(option.permission, value === true, setter)}
                className="mt-1"
              />
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-900">{option.label}</span>
                  {locked && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      Obrigatório
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-3 py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Carregando usuarios administrativos...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {embedded && (
        <Card className="border-blue-200 bg-gradient-to-r from-blue-50 via-white to-slate-50 shadow-sm">
          <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <Badge className="w-fit bg-blue-600 text-white hover:bg-blue-600">Usuarios e acessos</Badge>
              <div>
                <p className="text-xl font-semibold text-slate-900">Adicionar usuario pelo painel</p>
                <p className="max-w-2xl text-sm text-muted-foreground">
                  Crie contas direto em Configuracoes e escolha exatamente quais abas cada operador pode ver.
                </p>
              </div>
            </div>

            <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto" disabled={isReadOnlyMode}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar usuario
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className={embedded ? 'border-border/60 shadow-sm' : 'shadow-sm'}>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            {!embedded && (
              <Badge variant="outline" className="w-fit border-slate-300 bg-slate-50 text-slate-700">
                Administracao de acesso
              </Badge>
            )}
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <UserCog className="h-5 w-5" />
                {embedded ? 'Usuarios e permissoes' : 'Gerenciamento de Usuarios'}
              </CardTitle>
              <CardDescription className="max-w-3xl pt-1">
                Crie contas, ajuste perfis de acesso, selecione abas liberadas e mantenha o Firebase
                Authentication sincronizado com o Firestore.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => loadUsers(true)} disabled={refreshing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Dialog open={createDialogOpen} onOpenChange={(open) => (!open ? resetCreateDialog() : setCreateDialogOpen(open))}>
            <DialogTrigger asChild>
                <Button disabled={isReadOnlyMode}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar usuario
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Novo usuario do sistema</DialogTitle>
                  <DialogDescription>
                    Crie o usuario diretamente no Firebase e salve o perfil operacional no painel.
                  </DialogDescription>
                </DialogHeader>

                <form className="space-y-5" onSubmit={handleCreateUser}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Template rapido</Label>
                      <Select value={selectedTemplate} onValueChange={applyTemplate}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um template IPDA" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Preenchimento manual</SelectItem>
                          <SelectItem value="secretaria">Secretaria IPDA</SelectItem>
                          <SelectItem value="auxiliar">Auxiliar IPDA</SelectItem>
                          <SelectItem value="cadastro">Cadastro IPDA</SelectItem>
                          <SelectItem value="presente">Controle de Presenca</SelectItem>
                          <SelectItem value="batismo">Operador de Batismo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-displayName">Nome completo</Label>
                      <Input
                        id="new-displayName"
                        value={createForm.displayName}
                        onChange={(event) =>
                          setCreateForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))
                        }
                        placeholder="Nome do usuario"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={createForm.email}
                        onChange={(event) =>
                          setCreateForm((currentForm) => ({ ...currentForm, email: event.target.value }))
                        }
                        placeholder="usuario@ipda.app.br"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Senha inicial</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={createForm.password}
                        onChange={(event) =>
                          setCreateForm((currentForm) => ({ ...currentForm, password: event.target.value }))
                        }
                        placeholder="Minimo de 6 caracteres"
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Perfil de acesso</Label>
                      <Select
                        value={createForm.accessProfile}
                        onValueChange={(value) =>
                          handleAccessProfileChange(value as ManagedAccessProfile, setCreateForm)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {accessProfileOptions.map((profile) => (
                            <SelectItem key={profile.accessProfile} value={profile.accessProfile}>
                              {profile.shortLabel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {renderPermissionSelector(
                    createForm,
                    createSelectedPermissions,
                    createHasCustomPermissions,
                    setCreateForm
                  )}

                  <Alert className="border-slate-200 bg-slate-50">
                    <Shield className="h-4 w-4" />
                    <AlertDescription className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900">{createProfilePreview.label}</p>
                        {createHasCustomPermissions && (
                          <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                            Perfil personalizado
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">{createProfilePreview.description}</p>
                      <p className="text-xs text-slate-500">
                        Permissoes liberadas: {summarizePermissions(createSelectedPermissions).join(', ')}
                      </p>
                    </AlertDescription>
                  </Alert>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={resetCreateDialog}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Criar usuario
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Users className="h-9 w-9 rounded-full bg-slate-100 p-2 text-slate-700" />
            <div>
              <p className="text-sm text-muted-foreground">Total de usuarios</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Shield className="h-9 w-9 rounded-full bg-blue-100 p-2 text-blue-700" />
            <div>
              <p className="text-sm text-muted-foreground">Administradores</p>
              <p className="text-2xl font-semibold">{stats.admins}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <UserCog className="h-9 w-9 rounded-full bg-emerald-100 p-2 text-emerald-700" />
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-semibold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertTriangle className="h-9 w-9 rounded-full bg-amber-100 p-2 text-amber-700" />
            <div>
              <p className="text-sm text-muted-foreground">Pendencias de sync</p>
              <p className="text-2xl font-semibold">{stats.inconsistencies}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios cadastrados
              </CardTitle>
              <CardDescription>
                Visualizacao rapida das contas ja cadastradas no sistema.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{visibleUsersCount} exibido(s)</Badge>
              {visibleUsersCount !== users.length && (
                <Badge variant="secondary">{users.length} no total</Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              Nenhum usuario encontrado para os filtros atuais.
            </div>
          ) : (
            <div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredUsers.map((managedUser) => (
                  <div key={`summary-${managedUser.uid}`} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate font-medium text-slate-900">{managedUser.displayName}</p>
                        <p className="truncate text-sm text-muted-foreground">{managedUser.email}</p>
                      </div>
                      <Badge
                        variant={managedUser.active ? 'default' : 'secondary'}
                        className={managedUser.active ? 'bg-emerald-600 text-white hover:bg-emerald-600' : undefined}
                      >
                        {managedUser.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={getRoleBadge(managedUser.accessProfile)}>
                        {getAccessProfileConfig(managedUser.accessProfile).shortLabel}
                      </Badge>
                      {managedUser.isProtected && (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          Protegido
                        </Badge>
                      )}
                      {hasCustomNavigationPermissions(managedUser.permissions, managedUser.accessProfile) && (
                        <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                          Personalizado
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {summarizePermissions(managedUser.permissions)
                        .slice(0, 3)
                        .map((label) => (
                          <Badge key={`${managedUser.uid}-summary-${label}`} variant="secondary" className="text-[11px]">
                            {label}
                          </Badge>
                        ))}
                      {managedUser.permissions.length > 3 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{managedUser.permissions.length - 3}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-muted-foreground">
                      Ultimo acesso: {formatDateTime(managedUser.lastLoginAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div>
            <CardTitle>Painel operacional</CardTitle>
            <CardDescription>
              Busque usuarios, filtre por perfil e administre o acesso sem sair do aplicativo.
            </CardDescription>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome ou email"
                className="pl-9"
              />
            </div>

            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilterValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os perfis</SelectItem>
                {accessProfileOptions.map((profile) => (
                  <SelectItem key={profile.accessProfile} value={profile.accessProfile}>
                    {profile.shortLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isReadOnlyMode && (
            <Alert className="border-blue-200 bg-blue-50 text-blue-900">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Lista carregada diretamente do Firestore porque este deploy não possui a rota
                `/api/admin/users`. As contas ficam visíveis normalmente, mas as ações de criar,
                editar, ativar e excluir permanecem indisponíveis nesta hospedagem estática.
              </AlertDescription>
            </Alert>
          )}

          {stats.inconsistencies > 0 && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Existem usuarios sem sincronizacao completa entre Authentication e Firestore. Eles continuam
                visiveis para limpeza ou ajuste administrativo.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-slate-200 bg-slate-50">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Contas com perfil de administrador ficam somente para visualizacao neste painel. Aqui o foco e
              criar e ajustar usuarios operacionais, como o operador de batismo com acesso apenas a
              `Dashboard` e `Batismo`.
            </AlertDescription>
          </Alert>

          <div className="space-y-3 md:hidden">
            {filteredUsers.length === 0 ? (
              <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
                Nenhum usuario encontrado para os filtros atuais.
              </div>
            ) : (
              filteredUsers.map((managedUser) => {
                const syncBadge = getSyncBadge(managedUser.syncStatus);
                const isCurrentSession = managedUser.uid === currentUser?.uid;
                const actionsLocked =
                  isReadOnlyMode ||
                  managedUser.isProtected ||
                  managedUser.accessProfile === 'admin' ||
                  managedUser.role === 'admin' ||
                  isCurrentSession;

                return (
                  <div key={`mobile-${managedUser.uid}`} className="rounded-xl border bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900">{managedUser.displayName}</p>
                        <p className="truncate text-sm text-muted-foreground">{managedUser.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Criado em {formatDateTime(managedUser.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant={managedUser.active ? 'default' : 'secondary'}
                        className={
                          managedUser.active ? 'bg-emerald-600 text-white hover:bg-emerald-600' : undefined
                        }
                      >
                        {managedUser.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={getRoleBadge(managedUser.accessProfile)}>
                        {getAccessProfileConfig(managedUser.accessProfile).shortLabel}
                      </Badge>
                      <Badge variant="outline" className={syncBadge.className}>
                        {syncBadge.label}
                      </Badge>
                      {(managedUser.isProtected || managedUser.accessProfile === 'admin') && (
                        <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                          Protegido
                        </Badge>
                      )}
                      {hasCustomNavigationPermissions(managedUser.permissions, managedUser.accessProfile) && (
                        <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                          Personalizado
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 space-y-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Permissões</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {summarizePermissions(managedUser.permissions).map((label) => (
                            <Badge key={`mobile-${managedUser.uid}-${label}`} variant="secondary" className="text-[11px]">
                              {label}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 rounded-lg border bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-slate-600">Email</span>
                          <span className="text-sm font-medium text-slate-900">
                            {managedUser.emailVerified ? 'Verificado' : 'Pendente'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-slate-600">Último acesso</span>
                          <span className="text-right text-sm font-medium text-slate-900">
                            {formatDateTime(managedUser.lastLoginAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                        <span className="text-sm text-muted-foreground">Conta ativa</span>
                        <Switch
                          checked={managedUser.active}
                          disabled={actionsLocked || togglingUid === managedUser.uid}
                          onCheckedChange={(checked) => handleToggleStatus(managedUser, checked)}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(managedUser)}
                          disabled={actionsLocked}
                          className="w-full"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Editar
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              disabled={actionsLocked || deletingUid === managedUser.uid}
                            >
                              {deletingUid === managedUser.uid ? (
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                              )}
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir usuario</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acao remove a conta do Firebase Authentication e o perfil salvo no
                                Firestore. Deseja continuar com a exclusao de {managedUser.displayName}?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-rose-600 hover:bg-rose-700"
                                onClick={() => handleDeleteUser(managedUser)}
                              >
                                Excluir usuario
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden rounded-xl border md:block">
            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Usuario</TableHead>
                    <TableHead className="min-w-[140px]">Perfil</TableHead>
                    <TableHead className="min-w-[140px]">Status</TableHead>
                    <TableHead className="min-w-[160px]">Ultimo acesso</TableHead>
                    <TableHead className="min-w-[140px]">Sincronizacao</TableHead>
                    <TableHead className="min-w-[180px] text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        Nenhum usuario encontrado para os filtros atuais.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((managedUser) => {
                      const syncBadge = getSyncBadge(managedUser.syncStatus);
                      const isCurrentSession = managedUser.uid === currentUser?.uid;
                      const actionsLocked =
                        isReadOnlyMode ||
                        managedUser.isProtected ||
                        managedUser.accessProfile === 'admin' ||
                        managedUser.role === 'admin' ||
                        isCurrentSession;

                      return (
                        <TableRow key={managedUser.uid}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{managedUser.displayName}</span>
                                {(managedUser.isProtected || managedUser.accessProfile === 'admin') && (
                                  <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
                                    Protegido
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{managedUser.email}</p>
                              <p className="text-xs text-muted-foreground">
                                Criado em {formatDateTime(managedUser.createdAt)}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-2">
                              <Badge className={getRoleBadge(managedUser.accessProfile)}>
                                {getAccessProfileConfig(managedUser.accessProfile).shortLabel}
                              </Badge>
                              {hasCustomNavigationPermissions(managedUser.permissions, managedUser.accessProfile) && (
                                <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                                  Personalizado
                                </Badge>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {getAccessProfileConfig(managedUser.accessProfile).description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {summarizePermissions(managedUser.permissions)
                                  .slice(0, 4)
                                  .map((label) => (
                                    <Badge key={`${managedUser.uid}-${label}`} variant="secondary" className="text-[11px]">
                                      {label}
                                    </Badge>
                                  ))}
                                {managedUser.permissions.length > 4 && (
                                  <Badge variant="outline" className="text-[11px]">
                                    +{managedUser.permissions.length - 4}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-2">
                              <Badge
                                variant={managedUser.active ? 'default' : 'secondary'}
                                className={
                                  managedUser.active
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                                    : undefined
                                }
                              >
                                {managedUser.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {managedUser.emailVerified ? 'Email verificado' : 'Email pendente'}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>{formatDateTime(managedUser.lastLoginAt)}</TableCell>

                          <TableCell>
                            <Badge variant="outline" className={syncBadge.className}>
                              {syncBadge.label}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                                <span className="text-xs text-muted-foreground">Ativo</span>
                                <Switch
                                  checked={managedUser.active}
                                  disabled={actionsLocked || togglingUid === managedUser.uid}
                                  onCheckedChange={(checked) => handleToggleStatus(managedUser, checked)}
                                />
                              </div>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditDialog(managedUser)}
                                disabled={actionsLocked}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                    disabled={actionsLocked || deletingUid === managedUser.uid}
                                  >
                                    {deletingUid === managedUser.uid ? (
                                      <RefreshCw className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir usuario</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acao remove a conta do Firebase Authentication e o perfil salvo no
                                      Firestore. Deseja continuar com a exclusao de {managedUser.displayName}?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-rose-600 hover:bg-rose-700"
                                      onClick={() => handleDeleteUser(managedUser)}
                                    >
                                      Excluir usuario
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Ajuste perfil, status e credenciais operacionais sem sair da area administrativa.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-5" onSubmit={handleEditUser}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Nome completo</Label>
                <Input
                  id="edit-displayName"
                  value={editForm.displayName}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({ ...currentForm, displayName: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({ ...currentForm, email: event.target.value }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Perfil de acesso</Label>
                <Select
                  value={editForm.accessProfile}
                  onValueChange={(value) =>
                    handleAccessProfileChange(value as ManagedAccessProfile, setEditForm)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accessProfileOptions.map((profile) => (
                      <SelectItem key={profile.accessProfile} value={profile.accessProfile}>
                        {profile.shortLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">Nova senha</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((currentForm) => ({ ...currentForm, password: event.target.value }))
                  }
                  placeholder="Preencha apenas se desejar redefinir"
                  minLength={6}
                />
              </div>
            </div>

            {renderPermissionSelector(editForm, editSelectedPermissions, editHasCustomPermissions, setEditForm)}

            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div>
                <p className="font-medium">Conta ativa</p>
                <p className="text-sm text-muted-foreground">
                  Quando desativado, o usuario fica bloqueado no Firebase Authentication.
                </p>
              </div>
              <Switch
                checked={editForm.active}
                onCheckedChange={(checked) =>
                  setEditForm((currentForm) => ({ ...currentForm, active: checked }))
                }
              />
            </div>

            <Alert className="border-slate-200 bg-slate-50">
              <Shield className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">{editProfilePreview.label}</p>
                  {editHasCustomPermissions && (
                    <Badge className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                      Perfil personalizado
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-600">{editProfilePreview.description}</p>
                <p className="text-xs text-slate-500">
                  Permissoes liberadas: {summarizePermissions(editSelectedPermissions).join(', ')}
                </p>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar alteracoes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
