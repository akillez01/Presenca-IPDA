/**
 * Sistema de Auditoria e Logging Completo
 * Registra todas as alterações e operações do sistema
 */

import { db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    where,
    writeBatch
} from 'firebase/firestore';

// Tipos de eventos auditáveis
export enum AuditEventType {
  // Operações de usuários
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_PERMISSIONS_CHANGED = 'USER_PERMISSIONS_CHANGED',

  // Operações de presença
  ATTENDANCE_CREATED = 'ATTENDANCE_CREATED',
  ATTENDANCE_UPDATED = 'ATTENDANCE_UPDATED',
  ATTENDANCE_DELETED = 'ATTENDANCE_DELETED',
  ATTENDANCE_BULK_IMPORT = 'ATTENDANCE_BULK_IMPORT',

  // Operações de cadastros
  MEMBER_CREATED = 'MEMBER_CREATED',
  MEMBER_UPDATED = 'MEMBER_UPDATED',
  MEMBER_DELETED = 'MEMBER_DELETED',
  MEMBER_STATUS_CHANGED = 'MEMBER_STATUS_CHANGED',

  // Operações de sistema
  BACKUP_CREATED = 'BACKUP_CREATED',
  BACKUP_RESTORED = 'BACKUP_RESTORED',
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Operações de dados
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  DATA_CLEANUP = 'DATA_CLEANUP',
  
  // Relatórios
  REPORT_GENERATED = 'REPORT_GENERATED',
  REPORT_EXPORTED = 'REPORT_EXPORTED'
}

// Nível de severidade do evento
export enum AuditSeverity {
  LOW = 'LOW',           // Operações normais
  MEDIUM = 'MEDIUM',     // Operações importantes
  HIGH = 'HIGH',         // Operações críticas
  CRITICAL = 'CRITICAL'  // Violações de segurança
}

// Interface do log de auditoria
export interface AuditLog {
  id?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId: string;
  userEmail?: string;
  sessionId?: string;
  timestamp: Timestamp;
  
  // Contexto da operação
  resourceType?: string;
  resourceId?: string;
  action: string;
  description: string;
  
  // Dados do evento
  before?: any;          // Estado anterior
  after?: any;           // Estado posterior
  changes?: string[];    // Lista de campos alterados
  
  // Informações técnicas
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  
  // Metadados
  tags?: string[];
  metadata?: Record<string, any>;
  
  // Rastreamento de erros
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

// Filtros para consulta de logs
export interface AuditLogFilters {
  eventTypes?: AuditEventType[];
  severities?: AuditSeverity[];
  userIds?: string[];
  resourceTypes?: string[];
  resourceIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  tags?: string[];
  limit?: number;
}

// Estatísticas de auditoria
export interface AuditStatistics {
  totalEvents: number;
  eventsByType: Record<AuditEventType, number>;
  eventsBySeverity: Record<AuditSeverity, number>;
  topUsers: Array<{ userId: string; count: number }>;
  recentActivity: AuditLog[];
  timeRange: {
    from: Date;
    to: Date;
  };
}

// Configuração do sistema de auditoria
interface AuditConfig {
  enabled: boolean;
  retentionDays: number;
  maxLogSize: number;
  autoCleanup: boolean;
  enableRealTimeNotifications: boolean;
  criticalEventNotifications: boolean;
  excludeEventTypes: AuditEventType[];
}

class AuditSystem {
  private config: AuditConfig;
  private batchBuffer: AuditLog[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly BATCH_TIMEOUT = 5000; // 5 segundos

  constructor() {
    this.config = {
      enabled: process.env.AUDIT_ENABLED !== 'false',
      retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS || '365'),
      maxLogSize: parseInt(process.env.AUDIT_MAX_LOG_SIZE || '10000'),
      autoCleanup: process.env.AUDIT_AUTO_CLEANUP === 'true',
      enableRealTimeNotifications: process.env.AUDIT_REAL_TIME_NOTIFICATIONS === 'true',
      criticalEventNotifications: process.env.AUDIT_CRITICAL_NOTIFICATIONS !== 'false',
      excludeEventTypes: []
    };

    // Iniciar limpeza automática se habilitada
    if (this.config.autoCleanup) {
      this.startAutoCleanup();
    }
  }

  /**
   * Remove campos undefined de um objeto
   */
  private cleanUndefinedFields(obj: any): any {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  /**
   * Registra um evento de auditoria
   */
  async log(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return;

    // Verificar se o tipo de evento deve ser ignorado
    if (this.config.excludeEventTypes.includes(event.eventType)) {
      return;
    }

    const auditLog: AuditLog = {
      ...event,
      timestamp: Timestamp.now()
    };

    // Remover campos undefined para evitar erro no Firebase
    const cleanedAuditLog = this.cleanUndefinedFields(auditLog);

    try {
      // Log imediato para eventos críticos
      if (event.severity === AuditSeverity.CRITICAL) {
        await this.writeLogImmediate(cleanedAuditLog);
        
        // Notificação crítica se habilitada
        if (this.config.criticalEventNotifications) {
          await this.sendCriticalNotification(cleanedAuditLog);
        }
      } else {
        // Adicionar ao buffer para batch
        this.addToBatch(cleanedAuditLog);
      }

      // Log no console em desenvolvimento
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AUDIT] ${event.eventType}:`, cleanedAuditLog);
      }

    } catch (error) {
      console.error('Erro ao registrar log de auditoria:', error);
      
      // Fallback: log em arquivo local se Firebase falhar
      this.logToFile(cleanedAuditLog, error);
    }
  }

  /**
   * Log rápido para operações comuns
   */
  async logUserAction(
    userId: string,
    action: string,
    resourceType?: string,
    resourceId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logData: any = {
      eventType: this.getEventTypeFromAction(action),
      severity: AuditSeverity.LOW,
      userId,
      action,
      description: `Usuário ${userId} executou: ${action}`
    };

    // Adicionar campos opcionais apenas se tiverem valor
    if (resourceType) logData.resourceType = resourceType;
    if (resourceId) logData.resourceId = resourceId;
    if (metadata) logData.metadata = metadata;

    await this.log(logData);
  }

  /**
   * Log de alterações com comparação before/after
   */
  async logDataChange(
    userId: string,
    eventType: AuditEventType,
    resourceType: string,
    resourceId: string,
    before: any,
    after: any,
    description?: string
  ): Promise<void> {
    const changes = this.compareObjects(before, after);
    
    await this.log({
      eventType,
      severity: AuditSeverity.MEDIUM,
      userId,
      action: 'UPDATE',
      description: description || `Alteração em ${resourceType} ${resourceId}`,
      resourceType,
      resourceId,
      before,
      after,
      changes
    });
  }

  /**
   * Log de eventos de segurança
   */
  async logSecurityEvent(
    userId: string,
    action: string,
    severity: AuditSeverity,
    description: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType: AuditEventType.SECURITY_VIOLATION,
      severity,
      userId,
      action,
      description,
      metadata,
      tags: ['security', 'violation']
    });
  }

  /**
   * Log de operações em lote
   */
  async logBulkOperation(
    userId: string,
    eventType: AuditEventType,
    operation: string,
    affectedResources: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      eventType,
      severity: AuditSeverity.HIGH,
      userId,
      action: 'BULK_OPERATION',
      description: `Operação em lote: ${operation} (${affectedResources.length} itens)`,
      metadata: {
        ...metadata,
        affectedResources,
        operationType: operation,
        itemCount: affectedResources.length
      },
      tags: ['bulk', 'mass-operation']
    });
  }

  /**
   * Consulta logs de auditoria
   */
  async queryLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
    try {
      const auditCollection = collection(db, 'audit_logs');
      let q = query(auditCollection);

      // Aplicar filtros
      if (filters.eventTypes?.length) {
        q = query(q, where('eventType', 'in', filters.eventTypes));
      }

      if (filters.severities?.length) {
        q = query(q, where('severity', 'in', filters.severities));
      }

      if (filters.userIds?.length) {
        q = query(q, where('userId', 'in', filters.userIds));
      }

      if (filters.resourceTypes?.length) {
        q = query(q, where('resourceType', 'in', filters.resourceTypes));
      }

      if (filters.dateFrom) {
        q = query(q, where('timestamp', '>=', Timestamp.fromDate(filters.dateFrom)));
      }

      if (filters.dateTo) {
        q = query(q, where('timestamp', '<=', Timestamp.fromDate(filters.dateTo)));
      }

      // Ordenar por timestamp (mais recente primeiro)
      q = query(q, orderBy('timestamp', 'desc'));

      // Aplicar limite
      if (filters.limit) {
        q = query(q, limit(filters.limit));
      }

      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];

    } catch (error) {
      console.error('Erro ao consultar logs de auditoria:', error);
      throw error;
    }
  }

  /**
   * Gera estatísticas de auditoria
   */
  async generateStatistics(days: number = 30): Promise<AuditStatistics> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    const logs = await this.queryLogs({
      dateFrom,
      limit: 10000 // Limite para evitar sobrecarga
    });

    const eventsByType = Object.values(AuditEventType).reduce((acc, type) => {
      acc[type] = logs.filter(log => log.eventType === type).length;
      return acc;
    }, {} as Record<AuditEventType, number>);

    const eventsBySeverity = Object.values(AuditSeverity).reduce((acc, severity) => {
      acc[severity] = logs.filter(log => log.severity === severity).length;
      return acc;
    }, {} as Record<AuditSeverity, number>);

    // Top usuários por atividade
    const userActivity = logs.reduce((acc, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topUsers = Object.entries(userActivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));

    return {
      totalEvents: logs.length,
      eventsByType,
      eventsBySeverity,
      topUsers,
      recentActivity: logs.slice(0, 20),
      timeRange: {
        from: dateFrom,
        to: new Date()
      }
    };
  }

  /**
   * Exporta logs para arquivo
   */
  async exportLogs(
    filters: AuditLogFilters = {},
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const logs = await this.queryLogs(filters);

    if (format === 'csv') {
      return this.convertToCSV(logs);
    } else {
      return JSON.stringify(logs, null, 2);
    }
  }

  /**
   * Limpa logs antigos
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    try {
      const auditCollection = collection(db, 'audit_logs');
      const q = query(
        auditCollection,
        where('timestamp', '<', Timestamp.fromDate(cutoffDate)),
        limit(500) // Processar em lotes para evitar timeout
      );

      const snapshot = await getDocs(q);
      let deletedCount = 0;

      // Processar em lotes
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
        deletedCount++;
      });

      if (deletedCount > 0) {
        await batch.commit();
      }

      return deletedCount;

    } catch (error) {
      console.error('Erro ao limpar logs antigos:', error);
      throw error;
    }
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<AuditConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): AuditConfig {
    return { ...this.config };
  }

  // Métodos privados

  private addToBatch(log: AuditLog): void {
    this.batchBuffer.push(log);

    // Escrever imediatamente se buffer está cheio
    if (this.batchBuffer.length >= this.BATCH_SIZE) {
      this.flushBatch();
    } else {
      // Configurar timeout se não existe
      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.flushBatch();
        }, this.BATCH_TIMEOUT);
      }
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;

    const logsToWrite = [...this.batchBuffer];
    this.batchBuffer = [];

    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    try {
      // Escrever logs em lote
      const auditCollection = collection(db, 'audit_logs');
      const writePromises = logsToWrite.map(log => 
        addDoc(auditCollection, this.cleanUndefinedFields(log))
      );
      await Promise.all(writePromises);

    } catch (error) {
      console.error('Erro ao escrever batch de logs:', error);
      
      // Fallback: tentar escrever individualmente
      for (const log of logsToWrite) {
        try {
          await this.writeLogImmediate(log);
        } catch (individualError) {
          this.logToFile(this.cleanUndefinedFields(log), individualError);
        }
      }
    }
  }

  private async writeLogImmediate(log: AuditLog): Promise<void> {
    const auditCollection = collection(db, 'audit_logs');
    await addDoc(auditCollection, this.cleanUndefinedFields(log));
  }

  private compareObjects(before: any, after: any): string[] {
    const changes: string[] = [];
    
    if (!before || !after) return changes;

    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {})
    ]);

    for (const key of allKeys) {
      const beforeValue = before[key];
      const afterValue = after[key];

      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        changes.push(key);
      }
    }

    return changes;
  }

  private getEventTypeFromAction(action: string): AuditEventType {
    const actionMap: Record<string, AuditEventType> = {
      'login': AuditEventType.USER_LOGIN,
      'logout': AuditEventType.USER_LOGOUT,
      'create_user': AuditEventType.USER_CREATED,
      'update_user': AuditEventType.USER_UPDATED,
      'delete_user': AuditEventType.USER_DELETED,
      'create_attendance': AuditEventType.ATTENDANCE_CREATED,
      'update_attendance': AuditEventType.ATTENDANCE_UPDATED,
      'delete_attendance': AuditEventType.ATTENDANCE_DELETED,
      'create_member': AuditEventType.MEMBER_CREATED,
      'update_member': AuditEventType.MEMBER_UPDATED,
      'delete_member': AuditEventType.MEMBER_DELETED,
      'export_data': AuditEventType.DATA_EXPORT,
      'import_data': AuditEventType.DATA_IMPORT,
      'generate_report': AuditEventType.REPORT_GENERATED
    };

    return actionMap[action] || AuditEventType.USER_LOGIN;
  }

  private convertToCSV(logs: AuditLog[]): string {
    if (logs.length === 0) return '';

    const headers = [
      'ID', 'Timestamp', 'Event Type', 'Severity', 'User ID', 
      'Action', 'Description', 'Resource Type', 'Resource ID'
    ];

    const rows = logs.map(log => [
      log.id || '',
      log.timestamp.toDate().toISOString(),
      log.eventType,
      log.severity,
      log.userId,
      log.action,
      log.description,
      log.resourceType || '',
      log.resourceId || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }

  private async sendCriticalNotification(log: AuditLog): Promise<void> {
    // Implementar notificações críticas (email, Slack, etc.)
    console.error('EVENTO CRÍTICO DE AUDITORIA:', log);
    
    // Exemplo de implementação futura:
    // await notificationService.sendCriticalAlert({
    //   title: `Evento Crítico: ${log.eventType}`,
    //   message: log.description,
    //   severity: log.severity,
    //   timestamp: log.timestamp.toDate()
    // });
  }

  private logToFile(log: AuditLog, error: any): void {
    // Fallback para log local em caso de falha no Firebase
    const logEntry = {
      timestamp: new Date().toISOString(),
      auditLog: log,
      error: error.message,
      fallback: true
    };

    console.error('AUDIT FALLBACK:', JSON.stringify(logEntry));
    
    // Em produção, implementar escrita em arquivo local:
    // fs.appendFileSync('/var/log/audit-fallback.log', JSON.stringify(logEntry) + '\n');
  }

  private startAutoCleanup(): void {
    // Executar limpeza a cada 24 horas
    const cleanup = async () => {
      try {
        const deletedCount = await this.cleanupOldLogs();
        console.log(`Limpeza automática: ${deletedCount} logs removidos`);
        
        // Log da limpeza
        await this.log({
          eventType: AuditEventType.DATA_CLEANUP,
          severity: AuditSeverity.LOW,
          userId: 'system',
          action: 'AUTO_CLEANUP',
          description: `Limpeza automática removeu ${deletedCount} logs antigos`,
          metadata: { deletedCount, automated: true }
        });
        
      } catch (error) {
        console.error('Erro na limpeza automática:', error);
      }
    };

    // Executar imediatamente e depois a cada 24 horas
    cleanup();
    setInterval(cleanup, 24 * 60 * 60 * 1000);
  }
}

// Instância singleton do sistema de auditoria
export const auditSystem = new AuditSystem();

// Funções utilitárias

/**
 * Decorator para auditar automaticamente métodos
 */
export function withAudit(
  eventType: AuditEventType,
  severity: AuditSeverity = AuditSeverity.LOW
) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: any, ...args: any[]) {
      const startTime = Date.now();
      const userId = this.getCurrentUserId?.() || 'unknown';

      try {
        const result = await originalMethod.apply(this, args);
        
        // Log sucesso
        await auditSystem.log({
          eventType,
          severity,
          userId,
          action: propertyKey,
          description: `Método ${propertyKey} executado com sucesso`,
          metadata: {
            duration: Date.now() - startTime,
            argumentCount: args.length
          }
        });

        return result;
      } catch (error) {
        // Log erro
        await auditSystem.log({
          eventType,
          severity: AuditSeverity.HIGH,
          userId,
          action: propertyKey,
          description: `Erro ao executar método ${propertyKey}`,
          error: {
            code: 'METHOD_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
          },
          metadata: {
            duration: Date.now() - startTime,
            argumentCount: args.length
          }
        });

        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Hook para React para logging automático
 */
export function useAuditLog() {
  const logEvent = async (
    eventType: AuditEventType,
    action: string,
    description: string,
    severity: AuditSeverity = AuditSeverity.LOW,
    metadata?: Record<string, any>
  ) => {
    // Em um hook real, obteria o userId do contexto de auth
    const userId = 'current-user'; // getUserFromContext();
    
    await auditSystem.log({
      eventType,
      severity,
      userId,
      action,
      description,
      metadata
    });
  };

  return { logEvent };
}