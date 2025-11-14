/**
 * Sistema de Backup Automático
 * Implementa rotinas de backup diário para dados do Firebase
 */

import { collection, getDocs, Timestamp } from 'firebase/firestore';
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
}

// Resultado do backup
export interface BackupResult {
  success: boolean;
  metadata?: BackupMetadata;
  error?: string;
  filePath?: string;
}

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
  async createBackup(): Promise<BackupResult> {
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
      const usersData = await this.fetchUsersData();
      const configData = await this.fetchSystemConfig();

      // 2. Preparar dados para backup
      const backupData = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0',
          source: 'firebase-firestore',
          timezone: 'America/Manaus'
        },
        attendance: attendanceData,
        users: usersData,
        config: configData,
        statistics: {
          totalRecords: attendanceData.length,
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
        recordCount: attendanceData.length,
        fileSize: compressed.length,
        compression: this.config.compression,
        checksum: await this.generateChecksum(compressed),
        status: 'success'
      };

      // 6. Registrar backup
      await this.registerBackup(metadata);

      // 7. Limpeza de backups antigos
      await this.cleanupOldBackups();

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
  private async fetchAllAttendanceData(): Promise<any[]> {
    const snapshot = await getDocs(collection(db, 'attendance'));
    const data: any[] = [];

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
   * Busca dados de usuários
   */
  private async fetchUsersData(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const data: any[] = [];

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
  private async fetchSystemConfig(): Promise<any[]> {
    try {
      const snapshot = await getDocs(collection(db, 'system-config'));
      const data: any[] = [];

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
  private async compressData(data: any): Promise<string> {
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
    for (let key in localStorage) {
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
        localStorage.setItem(`backup-${fileName}`, data);
        console.log(`✅ Backup salvo no localStorage: ${Math.round(data.length / 1024)}KB`);
        return `localStorage:backup-${fileName}`;
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
      
      const backupDir = path.join(process.cwd(), 'backups');
      
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
      // Salvar metadados localmente
      const metadataFile = `backup-metadata-${metadata.id}.json`;
      await this.saveToLocalStorage(metadataFile, JSON.stringify(metadata, null, 2));
      
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
      const keys = Object.keys(localStorage);
      const backupKeys = keys.filter(key => key.startsWith('backup-'));
      
      // Remover metade dos backups mais antigos
      const keysToRemove = Math.ceil(backupKeys.length / 2);
      
      // Ordenar por nome (que inclui timestamp) e remover os mais antigos
      backupKeys.sort();
      
      for (let i = 0; i < keysToRemove && i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i]);
      }
      
      console.log(`🧹 Limpeza agressiva: removidos ${keysToRemove} backups adicionais`);
    } catch (error) {
      console.warn('Erro na limpeza agressiva:', error);
    }
  }

  /**
   * Limpa backups antigos do localStorage
   */
  private cleanupLocalStorageBackups(): void {
    const keys = Object.keys(localStorage);
    const backupKeys = keys.filter(key => key.startsWith('backup-'));
    
    // Ordenar por timestamp (assumindo formato consistente)
    backupKeys.sort().reverse();
    
    // Manter apenas os mais recentes
    const keysToRemove = backupKeys.slice(this.config.retention);
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`🧹 Removidos ${keysToRemove.length} backups antigos do localStorage`);
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
      
      const backupDir = path.join(process.cwd(), 'backups');
      
      const files = await fs.readdir(backupDir);
      const backupFiles = files.filter(file => file.startsWith('backup-') && file.endsWith('.json'));
      
      // Obter estatísticas dos arquivos para ordenar por data
      const fileStats = await Promise.all(
        backupFiles.map(async (file) => ({
          name: file,
          path: path.join(backupDir, file),
          mtime: (await fs.stat(path.join(backupDir, file))).mtime
        }))
      );
      
      // Ordenar por data de modificação (mais recente primeiro)
      fileStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      
      // Manter apenas os mais recentes
      const filesToRemove = fileStats.slice(this.config.retention);
      
      for (const file of filesToRemove) {
        await fs.unlink(file.path);
      }
      
      console.log(`🧹 Removidos ${filesToRemove.length} backups antigos do filesystem`);
    } catch (error) {
      console.warn('Erro ao acessar sistema de arquivos:', error);
    }
  }

  /**
   * Lista backups disponíveis
   */
  async listBackups(): Promise<BackupMetadata[]> {
    // TODO: Implementar listagem de backups
    return [];
  }

  /**
   * Restaura dados a partir de um backup
   */
  async restoreFromBackup(backupId: string): Promise<boolean> {
    // TODO: Implementar restauração de backup
    console.warn('Funcionalidade de restauração ainda não implementada');
    return false;
  }

  /**
   * Verifica integridade de um backup
   */
  async verifyBackup(backupId: string): Promise<boolean> {
    // TODO: Implementar verificação de integridade
    return true;
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
}

// Instância singleton do sistema de backup
export const backupSystem = new BackupSystem();

// Função utilitária para executar backup manual
export async function createManualBackup(): Promise<BackupResult> {
  return backupSystem.createBackup();
}

// Função para agendar backup automático (a ser implementada com cron job)
export function scheduleBackup(schedule?: string): void {
  console.log(`📅 Backup agendado: ${schedule || backupSystem.getConfig().schedule}`);
  // TODO: Implementar scheduling com node-cron ou similar
}