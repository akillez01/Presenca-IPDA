import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Configurações padrão do sistema
const DEFAULT_SYSTEM_CONFIG = {
  reclassificationOptions: ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'],
  regionOptions: ['Norte', 'Sul', 'Leste', 'Oeste', 'Central'],
  churchPositionOptions: [
    'Conselheiro(a)',
    'Financeiro(a)', 
    'Pastor',
    'Presbítero',
    'Diácono',
    'Cooperador(a)',
    'Líder Reação',
    'Líder Simplifique', 
    'Líder Creative',
    'Líder Discipulus',
    'Líder Adore',
    'Auxiliar Expansão (a)',
    'Etda Professor(a)',
    'Coordenador Etda (a)',
    'Líder Galileu (a)',
    'Líder Adote uma alma (a)',
    'Membro',
    'Outro'
  ],
  shiftOptions: ['Manhã', 'Tarde', 'Noite'],
  statusOptions: ['Presente', 'Ausente', 'Justificado'],
  lastUpdated: new Date(),
  updatedBy: 'system-init'
};

export async function initializeSystemConfig() {
  try {
    const configRef = doc(db, 'system', 'config');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      await setDoc(configRef, DEFAULT_SYSTEM_CONFIG);
      console.log('Configuração do sistema inicializada com sucesso');
    } else {
      console.log('Configuração do sistema já existe');
    }
  } catch (error) {
    console.error('Erro ao inicializar configuração do sistema:', error);
  }
}

// Função para migrar dados antigos (se necessário)
export async function migrateAttendanceData() {
  // Esta função pode ser usada para migrar dados antigos
  // quando as opções de reclassificação mudarem
  console.log('Migração de dados não necessária no momento');
}
