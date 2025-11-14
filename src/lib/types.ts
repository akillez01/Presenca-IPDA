export type AttendanceRecord = {
  id: string;
  timestamp: Date;
  fullName: string;
  cpf: string;
  birthday?: string; // Campo padronizado para aniversário
  reclassification: string;
  pastorName: string;
  region: string;
  churchPosition: string;
  city: string;
  shift: string;
  status: string;
  absentReason?: string; // Motivo da falta/justificativa
  createdBy?: string; // ID do usuário que criou o registro
  createdAt?: Date; // Data de criação
  lastUpdated?: any; // Timestamp da última atualização de presença (Firestore Timestamp)
  // Campos de auditoria para controle de concorrência
  lastUpdatedBy?: string; // Email do usuário que fez a última atualização
  updateCount?: number; // Contador de atualizações para controle de concorrência
  cpfScannedAt?: string; // Timestamp de quando o CPF foi escaneado
  scanMethod?: string; // Método usado para registrar (CPF_SCANNER, MANUAL, etc.)
  // Campos legacy para compatibilidade (serão removidos gradualmente)
  aniversario?: string; // @deprecated - usar birthday
  turno?: string; // @deprecated - usar shift
  cidade?: string; // @deprecated - usar city
};

// Sistema de usuários padronizado
export type UserRole = 'admin' | 'editor' | 'moderator' | 'user';
export type UserType = 'ADMIN_USER' | 'EDITOR_USER' | 'MODERATOR_USER' | 'STANDARD_USER';
export type Permission = 
  | 'dashboard' 
  | 'register' 
  | 'attendance' 
  | 'letters' 
  | 'presencadecadastrados' 
  | 'edit_attendance'
  | 'user_management'
  | 'reports'
  | 'settings'
  | 'audit_logs'
  | 'monitoring';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  userType: UserType;
  
  // Status
  active: boolean;
  isActive: boolean;
  
  // Capacidades
  canEditAttendance: boolean;
  canRegister: boolean;
  canViewAttendance: boolean;
  canManageUsers: boolean;
  canAccessReports: boolean;
  
  // Permissões específicas
  permissions: Permission[];
  
  // Timestamps
  createdAt: Date | any; // any para compatibilidade com Firestore Timestamp
  updatedAt: Date | any;
  lastUpdated: Date | any;
  lastLoginAt?: string;
  
  // Auditoria
  migratedAt?: Date | any;
  migrationVersion?: string;
  previousRole?: string;
}

// Configurações globais do sistema
export type SystemConfig = {
  reclassificationOptions: string[];
  regionOptions: string[];
  churchPositionOptions: string[];
  shiftOptions: string[];
  statusOptions: string[];
  lastUpdated: Date;
  updatedBy: string;
};
