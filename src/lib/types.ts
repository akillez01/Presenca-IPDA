export type AttendanceRecord = {
  id: string;
  timestamp: Date;
  fullName: string;
  cpf: string;
  birthday?: string; // Campo de aniversário
  reclassification: string;
  pastorName: string;
  region: string;
  churchPosition: string;
  city: string;
  shift: string;
  turno?: string; // Campo adicional para turno
  cidade?: string; // Campo adicional para cidade
  status: string;
  absentReason?: string; // Motivo da falta/justificativa
  createdBy?: string; // ID do usuário que criou o registro
  createdAt?: Date; // Data de criação
  lastUpdated?: any; // Timestamp da última atualização de presença (Firestore Timestamp)
};

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
