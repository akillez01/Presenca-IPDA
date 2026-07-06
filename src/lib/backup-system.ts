/**
 * Sistema de Backup Automático
 * Implementa rotinas de backup diário para dados do Firebase
 */

import { AuditEventType, AuditSeverity, auditSystem } from '@/lib/audit-system';
import { collection, doc, getDocs, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// Configurações do sistema de backup
export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron format: "0 2 * * *" (daily at 2 AM)
  retention: number; // Dias para manter backups
  storageLocation: 'local' | 'firebase-storage' | 'external';
  compression: boolean;
  encryption: boolean;
}

// Metadados do backup
export interface BackupMetadata {
  id: string;
  timestamp: Date;
  recordCount: number;
  fileSize: number;
  compression: boolean;
  checksum: string;
  status: 'success' | 'failed' | 'partial';
  error?: string;
  reason?: string;
  filePath?: string;
  storageLocation?: BackupConfig['storageLocation'];
}

// Resultado do backup
export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
  filePath?: string;
}

interface BackupCreationOptions {
  reason?: string;
  safetyBackupOf?: string;
  skipCleanup?: boolean;
}

type BackupDocument = Record<string, unknown> & { id: string };

interface BackupPayload {
  metadata: {
    timestamp: string;
    version: string;
    source: string;
    timezone: string;
    reason?: string;
    safetyBackupOf?: string;
  };
  attendance: BackupDocument[];
  members: BackupDocument[];
  users: BackupDocument[];
  config: BackupDocument[];
  statistics: {
    totalRecords: number;
    totalMembers: number;
    totalDocuments: number;
    createdAt: string;
  };
}

const LOCAL_STORAGE_PREFIX = 'backup-';
const BACKUP_METADATA_PREFIX = 'backup-metadata-';
const BACKUP_DIRECTORY = 'backups';
const RESTORE_BATCH_SIZE = 400;
const FIRESTORE_DATE_FIELDS = new Set([
  'timestamp',
  'createdAt',
  'updatedAt',
  'lastUpdated',
  'lastPresenceAt',
  'deletedAt',
  'restoredAt',
]);

class BackupSystem {
  private config: BackupConfig;
  private isRunning = false;

  constructor() {
    this.config = {
      enabled: process.env.BACKUP_ENABLED === 'true',
      schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // 2 AM daily
      retention: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
      storageLocation: (process.env.BACKUP_STORAGE_LOCATION as any) || 'local',
      compression: true,
      encryption: process.env.BACKUP_ENCRYPTION === 'true'
    };
  }

  /**
   * Executa backup completo dos dados de presença
   */
  async createBackup(options: BackupCreationOptions = {}): Promise<BackupResult> {
    if (this.isRunning) {
      return {
        success: false,
        error: 'Backup já está em execução'
      };
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      console.log('🔄 Iniciando backup automático...');

      // 1. Buscar todos os dados
      const attendanceData = await this.fetchAllAttendanceData();
      const membersData = await this.fetchMembersData();
      const usersData = await this.fetchUsersData();
      const configData = await this.fetchSystemConfig();

      // 2. Preparar dados para backup
      const totalDocumentCount = attendanceData.length + membersData.length + usersData.length + configData.length;
      const backupData: BackupPayload = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'firebase-firestore',
          timezone: 'America/Manaus',
          reason: options.reason,
          safetyBackupOf: options.safetyBackupOf,
        },
        attendance: attendanceData,
        members: membersData,
        users: usersData,
        config: configData,
        statistics: {
          totalRecords: attendanceData.length,
          totalMembers: membersData.length,
          totalDocuments: totalDocumentCount,
          createdAt: new Date().toISOString()
        }
      };

      // 3. Gerar backup
      const backupId = this.generateBackupId();
      const compressed = this.config.compression ? 
        await this.compressData(backupData) : JSON.stringify(backupData, null, 2);

      // 4. Salvar backup
      const filePath = await this.saveBackup(backupId, compressed);

      // 5. Criar metadados
      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        recordCount: totalDocumentCount,
        fileSize: compressed.length,
        compression: this.config.compression,
        checksum: await this.generateChecksum(compressed),
        status: filePath.startsWith('download:') ? 'partial' : 'success',
        reason: options.reason,
        filePath,
        storageLocation: this.config.storageLocation,
      };

      // 6. Registrar backup
      await this.registerBackup(metadata);

      // 7. Limpeza de backups antigos
      if (!options.skipCleanup) {
        await this.cleanupOldBackups();
      }

      await auditSystem.log({
        eventType: AuditEventType.BACKUP_CREATED,
        severity: AuditSeverity.MEDIUM,
        userId: 'system',
        action: 'create_backup',
        resourceType: 'backup',
        resourceId: backupId,
        description: `Backup ${backupId} criado com sucesso`,
        metadata: {
          recordCount: metadata.recordCount,
          fileSize: metadata.fileSize,
          storageLocation: metadata.storageLocation,
          reason: metadata.reason,
          status: metadata.status,
        },
      });

      const duration = Date.now() - startTime;
      const sizeKB = Math.round(compressed.length / 1024);
      console.log(`✅ Backup concluído em ${duration}ms - ID: ${backupId} - Tamanho: ${sizeKB}KB`);

      return {
        success: true,
        metadata,
        filePath
      };

    } catch (error) {
      console.error('❌ Erro durante backup:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Busca todos os dados de presença
   */
  private async fetchAllAttendanceData(): Promise<BackupDocument[]> {
    const snapshot = await getDocs(collection(db, 'attendance'));
    const data: BackupDocument[] = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        id: doc.id,
        ...docData,
        // Serializar timestamps
        timestamp: docData.timestamp instanceof Timestamp ? 
          docData.timestamp.toDate().toISOString() : docData.timestamp,
        createdAt: docData.createdAt instanceof Timestamp ? 
          docData.createdAt.toDate().toISOString() : docData.createdAt,
        lastUpdated: docData.lastUpdated instanceof Timestamp ? 
          docData.lastUpdated.toDate().toISOString() : docData.lastUpdated
      });
    });

    return data;
  }

  /**
   * Busca todos os dados de cadastro de membros
   */
  private async fetchMembersData(): Promise<BackupDocument[]> {
    const snapshot = await getDocs(collection(db, 'members'));
    const data: BackupDocument[] = [];

    snapshot.forEach((doc) => {
      const docData = doc.data();
      data.push({
        id: doc.id,
        ...docData,
        createdAt: docData.createdAt instanceof Timestamp ?
          docData.createdAt.toDate().toISOString() : docData.createdAt,
        updatedAt: docData.updatedAt instanceof Timestamp ?
          docData.updatedAt.toDate().toISOString() : docData.updatedAt,
        lastPresenceAt: docData.lastPresenceAt instanceof Timestamp ?
          docData.lastPresenceAt.toDate().toISOString() : docData.lastPresenceAt,
      });
    });

    return data;
  }

  /**
   * Busca dados de usuários
   */
  private async fetchUsersData(): Promise<BackupDocument[]> {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const data: BackupDocument[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return data;
    } catch (error) {
      console.warn('Aviso: Não foi possível fazer backup dos usuários:', error);
      return [];
    }
  }

  /**
   * Busca configurações do sistema
   */
  private async fetchSystemConfig(): Promise<BackupDocument[]> {
    try {
      const snapshot = await getDocs(collection(db, 'system-config'));
      const data: BackupDocument[] = [];

      snapshot.forEach((doc) => {
        data.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return data;
    } catch (error) {
      console.warn('Aviso: Não foi possível fazer backup das configurações:', error);
      return [];
    }
  }

  /**
   * Gera ID único para o backup
   */
  private generateBackupId(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
    return `backup-${dateStr}-${timeStr}`;
  }

  /**
   * Comprime dados do backup
   */
  private async compressData(data: BackupPayload): Promise<string> {
    // Em produção, usar biblioteca como pako ou node:zlib
    // Por enquanto, apenas minifica JSON
    return JSON.stringify(data);
  }

  /**
   * Salva backup no storage configurado
   */
  private async saveBackup(backupId: string, data: string): Promise<string> {
    const fileName = `${backupId}.json`;
    
    switch (this.config.storageLocation) {
      case 'local':
        return this.saveToLocalStorage(fileName, data);
      case 'firebase-storage':
        return this.saveToFirebaseStorage(fileName, data);
      case 'external':
        return this.saveToExternalStorage(fileName, data);
      default:
        throw new Error(`Storage location não suportado: ${this.config.storageLocation}`);
    }
  }

  /**
   * Verifica espaço disponível no localStorage
   */
  private checkLocalStorageSpace(dataSize: number): { available: boolean; usedSpace: number; totalSpace: number } {
    if (typeof window === 'undefined') {
      return { available: true, usedSpace: 0, totalSpace: 0 };
    }
    
    const totalSpace = 5 * 1024 * 1024; // 5MB (estimativa conservadora)
    let usedSpace = 0;
    
    // Calcular espaço usado
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        usedSpace += localStorage[key].length + key.length;
      }
    }
    
    const availableSpace = totalSpace - usedSpace;
    return {
      available: availableSpace > dataSize,
      usedSpace,
      totalSpace
    };
  }

  /**
   * Força download do arquivo como fallback
   */
  private forceDownload(fileName: string, data: string): string {
    if (typeof window === 'undefined') {
      throw new Error('Download forçado só funciona no navegador');
    }
    
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Limpar URL após uso
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    return `download:${fileName}`;
  }

  /**
   * Salva backup localmente (desenvolvimento)
   */
  private async saveToLocalStorage(fileName: string, data: string): Promise<string> {
    if (typeof window !== 'undefined') {
      // Browser environment - verificar quota primeiro
      const spaceCheck = this.checkLocalStorageSpace(data.length);
      
      if (!spaceCheck.available) {
        console.warn(`⚠️ LocalStorage quota excedida. Usado: ${Math.round(spaceCheck.usedSpace / 1024)}KB, Total: ${Math.round(spaceCheck.totalSpace / 1024)}KB`);
        console.log('📥 Iniciando download direto do backup...');
        
        return this.forceDownload(fileName, data);
      }
      
      try {
        localStorage.setItem(this.getStorageKey(fileName), data);
        console.log(`✅ Backup salvo no localStorage: ${Math.round(data.length / 1024)}KB`);
        return `localStorage:${this.getStorageKey(fileName)}`;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
          console.warn('⚠️ Quota do localStorage excedida durante salvamento');
          return this.forceDownload(fileName, data);
        }
        throw error;
      }
    } else {
      // Node environment - usar filesystem
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
      
      // Criar diretório se não existir
      try {
        await fs.mkdir(backupDir, { recursive: true });
      } catch (error) {
        // Diretório já existe
      }
      
      const filePath = path.join(backupDir, fileName);
      await fs.writeFile(filePath, data, 'utf8');
      
      return filePath;
    }
  }

  /**
   * Salva backup no Firebase Storage
   */
  private async saveToFirebaseStorage(fileName: string, data: string): Promise<string> {
    // TODO: Implementar com Firebase Storage
    throw new Error('Firebase Storage ainda não implementado');
  }

  /**
   * Salva backup em storage externo
   */
  private async saveToExternalStorage(fileName: string, data: string): Promise<string> {
    // TODO: Implementar com AWS S3, Google Cloud Storage, etc.
    throw new Error('Storage externo ainda não implementado');
  }

  /**
   * Gera checksum para verificação de integridade
   */
  private async generateChecksum(data: string): Promise<string> {
    // Implementação simples usando hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Registra metadados do backup
   */
  private async registerBackup(metadata: BackupMetadata): Promise<void> {
    try {
      const metadataFile = this.getMetadataFileName(metadata.id);
      await this.saveToLocalStorage(metadataFile, JSON.stringify(this.serializeMetadata(metadata), null, 2));
      
      console.log('📝 Metadados do backup registrados:', metadata.id);
    } catch (error) {
      console.warn('Aviso: Não foi possível registrar metadados do backup:', error);
    }
  }

  /**
   * Remove backups antigos baseado na política de retenção
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      if (typeof window !== 'undefined') {
        // Browser - limpar localStorage e verificar espaço
        this.cleanupLocalStorageBackups();
        
        // Se ainda estiver com pouco espaço, fazer limpeza mais agressiva
        const spaceCheck = this.checkLocalStorageSpace(0);
        const usagePercent = (spaceCheck.usedSpace / spaceCheck.totalSpace) * 100;
        
        if (usagePercent > 80) {
          console.warn(`⚠️ LocalStorage com ${Math.round(usagePercent)}% de uso. Fazendo limpeza adicional...`);
          this.aggressiveLocalStorageCleanup();
        }
      } else {
        // Node - limpar arquivos
        await this.cleanupFileSystemBackups();
      }
    } catch (error) {
      console.warn('Aviso: Erro durante limpeza de backups antigos:', error);
    }
  }

  /**
   * Limpeza mais agressiva do localStorage quando necessário
   */
  private aggressiveLocalStorageCleanup(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const backupIds = this.listStoredLocalBackupIds();
      
      const backupIdsToRemove = Math.ceil(backupIds.length / 2);
      
      backupIds.sort();
      
      for (let i = 0; i < backupIdsToRemove && i < backupIds.length; i++) {
        this.removeLocalBackupById(backupIds[i]);
      }
      
      console.log(`🧹 Limpeza agressiva: removidos ${backupIdsToRemove} backups adicionais`);
    } catch (error) {
      console.warn('Erro na limpeza agressiva:', error);
    }
  }

  /**
   * Limpa backups antigos do localStorage
   */
  private cleanupLocalStorageBackups(): void {
    const backupIds = this.listStoredLocalBackupIds();
    
    backupIds.sort().reverse();
    
    const idsToRemove = backupIds.slice(this.config.retention);
    
    idsToRemove.forEach(id => {
      this.removeLocalBackupById(id);
    });
    
    console.log(`🧹 Removidos ${idsToRemove.length} backups antigos do localStorage`);
  }

  /**
   * Limpa backups antigos do filesystem (apenas server-side)
   */
  private async cleanupFileSystemBackups(): Promise<void> {
    // Verificar se estamos no server-side
    if (typeof window !== 'undefined') {
      console.log('Cleanup de filesystem não disponível no client-side');
      return;
    }

    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      
      const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
      
      const files = await fs.readdir(backupDir);
      const backupIds = files
        .filter(file => this.isBackupDataFileName(file))
        .map(file => file.replace(/\.json$/, ''))
        .sort()
        .reverse();

      const idsToRemove = backupIds.slice(this.config.retention);
      
      for (const backupId of idsToRemove) {
        await this.removeFileSystemBackupById(backupId);
      }
      
      console.log(`🧹 Removidos ${idsToRemove.length} backups antigos do filesystem`);
    } catch (error) {
      console.warn('Erro ao acessar sistema de arquivos:', error);
    }
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const fileNames = await this.listStoredFiles();
    const metadataFiles = fileNames.filter(fileName => fileName.startsWith(BACKUP_METADATA_PREFIX) && fileName.endsWith('.json'));
    const parsedMetadata: BackupMetadata[] = [];

    for (const metadataFile of metadataFiles) {
      const raw = await this.readStoredFile(metadataFile);
      if (!raw) {
        continue;
      }

      try {
        parsedMetadata.push(this.parseMetadata(raw));
      } catch (error) {
        console.warn(`Aviso: metadados de backup inválidos em ${metadataFile}:`, error);
      }
    }

    parsedMetadata.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return parsedMetadata;
  }

  /**
   * Restaura dados a partir de um backup
   */
  async restoreFromBackup(backupId: string): Promise<boolean> {
    const metadata = await this.loadMetadata(backupId);
    if (!metadata) {
      throw new Error(`Backup ${backupId} não encontrado.`);
    }

    const verified = await this.verifyBackup(backupId);
    if (!verified) {
      throw new Error(`Backup ${backupId} falhou na verificação de integridade.`);
    }

    const safetyBackup = await this.createBackup({
      reason: `Backup de proteção antes da restauração de ${backupId}`,
      safetyBackupOf: backupId,
      skipCleanup: true,
    });

    if (!safetyBackup.success) {
      throw new Error(`Não foi possível criar backup de proteção antes da restauração: ${safetyBackup.error || 'erro desconhecido'}`);
    }

    const payload = await this.loadBackupPayload(backupId);

    await this.restoreCollection('attendance', payload.attendance);
    await this.restoreCollection('members', payload.members);
    await this.restoreCollection('users', payload.users);
    await this.restoreCollection('system-config', payload.config);

    await auditSystem.log({
      eventType: AuditEventType.BACKUP_RESTORED,
      severity: AuditSeverity.HIGH,
      userId: 'system',
      action: 'restore_backup',
      resourceType: 'backup',
      resourceId: backupId,
      description: `Backup ${backupId} restaurado com sucesso`,
      metadata: {
        restoredCollections: {
          attendance: payload.attendance.length,
          members: payload.members.length,
          users: payload.users.length,
          config: payload.config.length,
        },
        safetyBackupId: safetyBackup.metadata?.id,
      },
    });

    return true;
  }

  /**
   * Verifica integridade de um backup
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    try {
      const metadata = await this.loadMetadata(backupId);
      if (!metadata) {
        return false;
      }

      const raw = await this.readStoredFile(this.getBackupFileName(backupId));
      if (!raw) {
        return false;
      }

      const checksum = await this.generateChecksum(raw);
      if (checksum !== metadata.checksum) {
        return false;
      }

      const payload = this.parseBackupPayload(raw);
      if (payload.metadata.version !== '1.0') {
        return false;
      }

      if (payload.statistics.totalRecords !== payload.attendance.length) {
        return false;
      }

      if (payload.statistics.totalMembers !== payload.members.length) {
        return false;
      }

      return true;
    } catch (error) {
      console.warn(`Falha ao verificar backup ${backupId}:`, error);
      return false;
    }
  }

  /**
   * Obtém configuração atual do backup
   */
  getConfig(): BackupConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração do backup
   */
  updateConfig(newConfig: Partial<BackupConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined') {
        this.removeLocalBackupById(backupId);
      } else {
        await this.removeFileSystemBackupById(backupId);
      }

      return true;
    } catch (error) {
      console.error(`Erro ao excluir backup ${backupId}:`, error);
      return false;
    }
  }

  private getBackupFileName(backupId: string): string {
    return `${backupId}.json`;
  }

  private getMetadataFileName(backupId: string): string {
    return `${BACKUP_METADATA_PREFIX}${backupId}.json`;
  }

  private getStorageKey(fileName: string): string {
    return `${LOCAL_STORAGE_PREFIX}${fileName}`;
  }

  private listStoredLocalBackupIds(): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    return Object.keys(localStorage)
      .filter((key) => this.isLocalStorageBackupDataKey(key))
      .map((key) => key.slice(LOCAL_STORAGE_PREFIX.length).replace(/\.json$/, ''))
      .sort();
  }

  private isLocalStorageBackupDataKey(key: string): boolean {
    if (!key.startsWith(LOCAL_STORAGE_PREFIX)) {
      return false;
    }

    const fileName = key.slice(LOCAL_STORAGE_PREFIX.length);
    return this.isBackupDataFileName(fileName);
  }

  private isBackupDataFileName(fileName: string): boolean {
    return /^backup-\d{8}-\d{6}\.json$/.test(fileName);
  }

  private removeLocalBackupById(backupId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(this.getStorageKey(this.getBackupFileName(backupId)));
    localStorage.removeItem(this.getStorageKey(this.getMetadataFileName(backupId)));
  }

  private async removeFileSystemBackupById(backupId: string): Promise<void> {
    const fs = await import('fs').then(m => m.promises);
    const path = await import('path');
    const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
    const files = [
      path.join(backupDir, this.getBackupFileName(backupId)),
      path.join(backupDir, this.getMetadataFileName(backupId)),
    ];

    await Promise.all(
      files.map(async (filePath) => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
            throw error;
          }
        }
      })
    );
  }

  private async listStoredFiles(): Promise<string[]> {
    if (typeof window !== 'undefined') {
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(LOCAL_STORAGE_PREFIX))
        .map((key) => key.slice(LOCAL_STORAGE_PREFIX.length));
    }

    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
      return await fs.readdir(backupDir);
    } catch {
      return [];
    }
  }

  private async readStoredFile(fileName: string): Promise<string | null> {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.getStorageKey(fileName));
    }

    try {
      const fs = await import('fs').then(m => m.promises);
      const path = await import('path');
      const backupDir = path.join(process.cwd(), BACKUP_DIRECTORY);
      return await fs.readFile(path.join(backupDir, fileName), 'utf8');
    } catch {
      return null;
    }
  }

  private serializeMetadata(metadata: BackupMetadata): Omit<BackupMetadata, 'timestamp'> & { timestamp: string } {
    return {
      ...metadata,
      timestamp: metadata.timestamp.toISOString(),
    };
  }

  private parseMetadata(raw: string): BackupMetadata {
    const parsed = JSON.parse(raw) as Partial<BackupMetadata> & { timestamp?: string | Date };

    if (!parsed.id || !parsed.timestamp || typeof parsed.recordCount !== 'number' || typeof parsed.fileSize !== 'number' || typeof parsed.checksum !== 'string' || !parsed.status) {
      throw new Error('Metadados de backup inválidos.');
    }

    return {
      ...parsed,
      timestamp: new Date(parsed.timestamp),
      compression: Boolean(parsed.compression),
      status: parsed.status,
    } as BackupMetadata;
  }

  private async loadMetadata(backupId: string): Promise<BackupMetadata | null> {
    const raw = await this.readStoredFile(this.getMetadataFileName(backupId));
    if (!raw) {
      return null;
    }

    return this.parseMetadata(raw);
  }

  private parseBackupPayload(raw: string): BackupPayload {
    const parsed = JSON.parse(raw) as Partial<BackupPayload>;

    if (!parsed.metadata || typeof parsed.metadata.timestamp !== 'string' || typeof parsed.metadata.version !== 'string') {
      throw new Error('Payload de backup inválido: metadados ausentes.');
    }

    return {
      metadata: {
        timestamp: parsed.metadata.timestamp,
        version: parsed.metadata.version,
        source: parsed.metadata.source || 'firebase-firestore',
        timezone: parsed.metadata.timezone || 'America/Manaus',
        reason: parsed.metadata.reason,
        safetyBackupOf: parsed.metadata.safetyBackupOf,
      },
      attendance: this.normalizeBackupDocuments(parsed.attendance),
      members: this.normalizeBackupDocuments(parsed.members),
      users: this.normalizeBackupDocuments(parsed.users),
      config: this.normalizeBackupDocuments(parsed.config),
      statistics: {
        totalRecords: parsed.statistics?.totalRecords ?? 0,
        totalMembers: parsed.statistics?.totalMembers ?? 0,
        totalDocuments: parsed.statistics?.totalDocuments ?? 0,
        createdAt: parsed.statistics?.createdAt || parsed.metadata.timestamp,
      },
    };
  }

  private normalizeBackupDocuments(records: unknown): BackupDocument[] {
    if (!Array.isArray(records)) {
      return [];
    }

    return records.filter((record): record is BackupDocument => {
      return Boolean(record) && typeof record === 'object' && 'id' in record && typeof (record as BackupDocument).id === 'string';
    });
  }

  private async loadBackupPayload(backupId: string): Promise<BackupPayload> {
    const raw = await this.readStoredFile(this.getBackupFileName(backupId));
    if (!raw) {
      throw new Error(`Arquivo do backup ${backupId} não encontrado.`);
    }

    return this.parseBackupPayload(raw);
  }

  private async restoreCollection(collectionName: string, records: BackupDocument[]): Promise<void> {
    for (let index = 0; index < records.length; index += RESTORE_BATCH_SIZE) {
      const chunk = records.slice(index, index + RESTORE_BATCH_SIZE);
      const batch = writeBatch(db);

      for (const record of chunk) {
        const reference = doc(db, collectionName, record.id);
        batch.set(reference, this.prepareDocumentForRestore(record));
      }

      await batch.commit();
    }
  }

  private prepareDocumentForRestore(record: BackupDocument): Record<string, unknown> {
    const prepared: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (key === 'id' || value === undefined) {
        continue;
      }

      prepared[key] = this.prepareValueForRestore(key, value);
    }

    return prepared;
  }

  private prepareValueForRestore(key: string, value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.prepareValueForRestore(key, item));
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const nested: Record<string, unknown> = {};
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        nested[nestedKey] = this.prepareValueForRestore(nestedKey, nestedValue);
      }
      return nested;
    }

    if (typeof value === 'string' && FIRESTORE_DATE_FIELDS.has(key) && this.isIsoDateString(value)) {
      return new Date(value);
    }

    return value;
  }

  private isIsoDateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }
}

// Instância singleton do sistema de backup
export const backupSystem = new BackupSystem();

// Função utilitária para executar backup manual
export async function createManualBackup(options: BackupCreationOptions = {}): Promise<BackupResult> {
  return backupSystem.createBackup(options);
}

// Função para agendar backup automático (a ser implementada com cron job)
export function scheduleBackup(schedule?: string): void {
  console.log(`📅 Backup agendado: ${schedule || backupSystem.getConfig().schedule}`);
  // TODO: Implementar scheduling com node-cron ou similar
}
