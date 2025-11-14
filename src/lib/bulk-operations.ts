/**
 * Sistema de Operações em Massa (Bulk Operations)
 * Permite updates, deletes e criação de registros em lote
 */

import { AuditEventType, AuditSeverity, auditSystem } from '@/lib/audit-system';
import { db } from '@/lib/firebase';
import { rateLimitSystem } from '@/lib/rate-limit-system';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    query,
    Timestamp,
    where,
    writeBatch
} from 'firebase/firestore';

// Tipos para operações em massa
export interface BulkOperation {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  collection: string;
  documentId?: string;
  data?: any;
  filter?: BulkFilter;
  timestamp: Date;
}

export interface BulkFilter {
  field: string;
  operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'in' | 'not-in' | 'array-contains';
  value: any;
}

export interface BulkOperationResult {
  operationId: string;
  success: boolean;
  processedCount: number;
  errorCount: number;
  results: Array<{
    documentId: string;
    success: boolean;
    error?: string;
  }>;
  duration: number;
  timestamp: Date;
}

export interface BulkOperationProgress {
  operationId: string;
  total: number;
  processed: number;
  errors: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startTime: Date;
  estimatedCompletion?: Date;
}

// Configurações de operações em massa
interface BulkConfig {
  maxBatchSize: number;
  maxConcurrentBatches: number;
  delayBetweenBatches: number;
  timeoutPerBatch: number;
  enableProgressTracking: boolean;
  enableRollback: boolean;
}

class BulkOperationSystem {
  private config: BulkConfig;
  private activeOperations = new Map<string, BulkOperationProgress>();
  private operationCallbacks = new Map<string, (progress: BulkOperationProgress) => void>();

  constructor() {
    this.config = {
      maxBatchSize: parseInt(process.env.BULK_MAX_BATCH_SIZE || '500'),
      maxConcurrentBatches: parseInt(process.env.BULK_MAX_CONCURRENT_BATCHES || '3'),
      delayBetweenBatches: parseInt(process.env.BULK_DELAY_BETWEEN_BATCHES || '1000'),
      timeoutPerBatch: parseInt(process.env.BULK_TIMEOUT_PER_BATCH || '30000'),
      enableProgressTracking: process.env.BULK_ENABLE_PROGRESS_TRACKING !== 'false',
      enableRollback: process.env.BULK_ENABLE_ROLLBACK !== 'false'
    };
  }

  /**
   * Atualização em massa de documentos
   */
  async bulkUpdate(
    collectionName: string,
    updates: Array<{ documentId: string; data: Partial<any> }>,
    options: {
      userId: string;
      validateData?: (data: any) => boolean;
      onProgress?: (progress: BulkOperationProgress) => void;
      dryRun?: boolean;
    }
  ): Promise<BulkOperationResult> {
    const operationId = this.generateOperationId();
    const startTime = new Date();

    try {
      // Validar entrada
      if (updates.length === 0) {
        throw new Error('Lista de atualizações não pode estar vazia');
      }

      if (updates.length > 10000) {
        throw new Error('Máximo de 10.000 atualizações por operação');
      }

      // Inicializar tracking de progresso
      const progress: BulkOperationProgress = {
        operationId,
        total: updates.length,
        processed: 0,
        errors: 0,
        status: 'PENDING',
        startTime
      };

      if (this.config.enableProgressTracking) {
        this.activeOperations.set(operationId, progress);
        if (options.onProgress) {
          this.operationCallbacks.set(operationId, options.onProgress);
        }
      }

      // Log início da operação
      await auditSystem.logBulkOperation(
        options.userId,
        AuditEventType.ATTENDANCE_UPDATED,
        'BULK_UPDATE',
        updates.map(u => u.documentId),
        { 
          collection: collectionName,
          dryRun: options.dryRun || false,
          operationId 
        }
      );

      progress.status = 'RUNNING';
      this.updateProgress(operationId, progress);

      // Processar em lotes
      const results: BulkOperationResult['results'] = [];
      const batches = this.createBatches(updates, this.config.maxBatchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          // Rate limiting
          await rateLimitSystem.queueOperation(
            `bulk-update-${options.userId}`,
            async () => {
              if (options.dryRun) {
                // Simular operação sem execução real
                return this.simulateBatchUpdate(batch, options.validateData);
              } else {
                return this.executeBatchUpdate(collectionName, batch, options.validateData);
              }
            },
            { priority: 3 }
          );

          const batchResults = await this.getBatchResults(batch);
          results.push(...batchResults);

          // Atualizar progresso
          progress.processed += batch.length;
          progress.estimatedCompletion = this.calculateETA(progress, batches.length, i + 1);
          this.updateProgress(operationId, progress);

          // Delay entre lotes
          if (i < batches.length - 1) {
            await this.delay(this.config.delayBetweenBatches);
          }

        } catch (error) {
          console.error(`Erro no lote ${i + 1}:`, error);
          
          // Registrar erros do lote
          const batchErrors = batch.map(update => ({
            documentId: update.documentId,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          }));
          
          results.push(...batchErrors);
          progress.errors += batch.length;
          this.updateProgress(operationId, progress);

          // Decidir se continua ou para
          if (progress.errors > progress.total * 0.5) {
            throw new Error('Muitos erros na operação em massa. Operação cancelada.');
          }
        }
      }

      // Finalizar operação
      const duration = Date.now() - startTime.getTime();
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      progress.status = errorCount === 0 ? 'COMPLETED' : 'FAILED';
      this.updateProgress(operationId, progress);

      const result: BulkOperationResult = {
        operationId,
        success: errorCount === 0,
        processedCount: successCount,
        errorCount,
        results,
        duration,
        timestamp: new Date()
      };

      // Log resultado final
      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_UPDATED,
        severity: errorCount > 0 ? AuditSeverity.HIGH : AuditSeverity.MEDIUM,
        userId: options.userId,
        action: 'BULK_UPDATE_COMPLETED',
        description: `Atualização em massa: ${successCount} sucessos, ${errorCount} erros`,
        metadata: { 
          operationId, 
          duration, 
          processedCount: successCount,
          errorCount,
          dryRun: options.dryRun || false
        }
      });

      return result;

    } catch (error) {
      // Erro geral da operação
      const progress = this.activeOperations.get(operationId);
      if (progress) {
        progress.status = 'FAILED';
        this.updateProgress(operationId, progress);
      }

      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_UPDATED,
        severity: AuditSeverity.CRITICAL,
        userId: options.userId,
        action: 'BULK_UPDATE_FAILED',
        description: `Falha na atualização em massa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        error: {
          code: 'BULK_UPDATE_ERROR',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        },
        metadata: { operationId }
      });

      throw error;
    } finally {
      // Limpeza
      this.activeOperations.delete(operationId);
      this.operationCallbacks.delete(operationId);
    }
  }

  /**
   * Exclusão em massa de documentos
   */
  async bulkDelete(
    collectionName: string,
    documentIds: string[],
    options: {
      userId: string;
      confirmationToken?: string;
      onProgress?: (progress: BulkOperationProgress) => void;
      createBackup?: boolean;
    }
  ): Promise<BulkOperationResult> {
    const operationId = this.generateOperationId();
    const startTime = new Date();

    try {
      // Validações de segurança
      if (documentIds.length === 0) {
        throw new Error('Lista de documentos não pode estar vazia');
      }

      if (documentIds.length > 5000) {
        throw new Error('Máximo de 5.000 exclusões por operação (segurança)');
      }

      // Verificar token de confirmação para operações grandes
      if (documentIds.length > 100 && !options.confirmationToken) {
        throw new Error('Token de confirmação obrigatório para exclusões em massa > 100 itens');
      }

      // Backup antes da exclusão se solicitado
      let backupData: any[] = [];
      if (options.createBackup) {
        backupData = await this.createBackupBeforeDelete(collectionName, documentIds);
      }

      // Inicializar progresso
      const progress: BulkOperationProgress = {
        operationId,
        total: documentIds.length,
        processed: 0,
        errors: 0,
        status: 'RUNNING',
        startTime
      };

      this.activeOperations.set(operationId, progress);
      if (options.onProgress) {
        this.operationCallbacks.set(operationId, options.onProgress);
      }

      // Log início
      await auditSystem.logBulkOperation(
        options.userId,
        AuditEventType.ATTENDANCE_DELETED,
        'BULK_DELETE',
        documentIds,
        { 
          collection: collectionName,
          operationId,
          hasBackup: options.createBackup || false,
          confirmationToken: !!options.confirmationToken
        }
      );

      // Processar em lotes
      const results: BulkOperationResult['results'] = [];
      const batches = this.createBatches(
        documentIds.map(id => ({ documentId: id })), 
        this.config.maxBatchSize
      );

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          await rateLimitSystem.queueOperation(
            `bulk-delete-${options.userId}`,
            () => this.executeBatchDelete(collectionName, batch.map(b => b.documentId)),
            { priority: 2 }
          );

          const batchResults = batch.map(b => ({
            documentId: b.documentId,
            success: true
          }));
          
          results.push(...batchResults);
          progress.processed += batch.length;
          this.updateProgress(operationId, progress);

          await this.delay(this.config.delayBetweenBatches);

        } catch (error) {
          const batchErrors = batch.map(b => ({
            documentId: b.documentId,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          }));
          
          results.push(...batchErrors);
          progress.errors += batch.length;
          this.updateProgress(operationId, progress);
        }
      }

      // Resultado final
      const duration = Date.now() - startTime.getTime();
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      progress.status = errorCount === 0 ? 'COMPLETED' : 'FAILED';
      this.updateProgress(operationId, progress);

      const result: BulkOperationResult = {
        operationId,
        success: errorCount === 0,
        processedCount: successCount,
        errorCount,
        results,
        duration,
        timestamp: new Date()
      };

      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_DELETED,
        severity: AuditSeverity.HIGH,
        userId: options.userId,
        action: 'BULK_DELETE_COMPLETED',
        description: `Exclusão em massa: ${successCount} sucessos, ${errorCount} erros`,
        metadata: { 
          operationId, 
          duration, 
          processedCount: successCount,
          errorCount,
          backupCreated: options.createBackup || false
        }
      });

      return result;

    } catch (error) {
      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_DELETED,
        severity: AuditSeverity.CRITICAL,
        userId: options.userId,
        action: 'BULK_DELETE_FAILED',
        description: `Falha na exclusão em massa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        error: {
          code: 'BULK_DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        },
        metadata: { operationId }
      });

      throw error;
    } finally {
      this.activeOperations.delete(operationId);
      this.operationCallbacks.delete(operationId);
    }
  }

  /**
   * Criação em massa de documentos
   */
  async bulkCreate(
    collectionName: string,
    documents: any[],
    options: {
      userId: string;
      validateData?: (data: any) => boolean;
      onProgress?: (progress: BulkOperationProgress) => void;
      skipDuplicates?: boolean;
    }
  ): Promise<BulkOperationResult> {
    const operationId = this.generateOperationId();
    const startTime = new Date();

    try {
      if (documents.length === 0) {
        throw new Error('Lista de documentos não pode estar vazia');
      }

      if (documents.length > 10000) {
        throw new Error('Máximo de 10.000 criações por operação');
      }

      // Validar dados se fornecido validador
      if (options.validateData) {
        const invalidDocs = documents.filter(doc => !options.validateData!(doc));
        if (invalidDocs.length > 0) {
          throw new Error(`${invalidDocs.length} documentos falharam na validação`);
        }
      }

      const progress: BulkOperationProgress = {
        operationId,
        total: documents.length,
        processed: 0,
        errors: 0,
        status: 'RUNNING',
        startTime
      };

      this.activeOperations.set(operationId, progress);
      if (options.onProgress) {
        this.operationCallbacks.set(operationId, options.onProgress);
      }

      await auditSystem.logBulkOperation(
        options.userId,
        AuditEventType.ATTENDANCE_CREATED,
        'BULK_CREATE',
        [],
        { 
          collection: collectionName,
          operationId,
          documentCount: documents.length,
          skipDuplicates: options.skipDuplicates || false
        }
      );

      const results: BulkOperationResult['results'] = [];
      const batches = this.createBatches(documents, this.config.maxBatchSize);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        try {
          await rateLimitSystem.queueOperation(
            `bulk-create-${options.userId}`,
            () => this.executeBatchCreate(collectionName, batch),
            { priority: 4 }
          );

          const batchResults = batch.map((_, index) => ({
            documentId: `batch-${i}-doc-${index}`, // ID temporário
            success: true
          }));
          
          results.push(...batchResults);
          progress.processed += batch.length;
          this.updateProgress(operationId, progress);

          await this.delay(this.config.delayBetweenBatches);

        } catch (error) {
          const batchErrors = batch.map((_, index) => ({
            documentId: `batch-${i}-doc-${index}`,
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
          }));
          
          results.push(...batchErrors);
          progress.errors += batch.length;
          this.updateProgress(operationId, progress);
        }
      }

      const duration = Date.now() - startTime.getTime();
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      progress.status = errorCount === 0 ? 'COMPLETED' : 'FAILED';
      this.updateProgress(operationId, progress);

      const result: BulkOperationResult = {
        operationId,
        success: errorCount === 0,
        processedCount: successCount,
        errorCount,
        results,
        duration,
        timestamp: new Date()
      };

      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_CREATED,
        severity: AuditSeverity.MEDIUM,
        userId: options.userId,
        action: 'BULK_CREATE_COMPLETED',
        description: `Criação em massa: ${successCount} sucessos, ${errorCount} erros`,
        metadata: { 
          operationId, 
          duration, 
          processedCount: successCount,
          errorCount
        }
      });

      return result;

    } catch (error) {
      await auditSystem.log({
        eventType: AuditEventType.ATTENDANCE_CREATED,
        severity: AuditSeverity.CRITICAL,
        userId: options.userId,
        action: 'BULK_CREATE_FAILED',
        description: `Falha na criação em massa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        error: {
          code: 'BULK_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Erro desconhecido'
        },
        metadata: { operationId }
      });

      throw error;
    } finally {
      this.activeOperations.delete(operationId);
      this.operationCallbacks.delete(operationId);
    }
  }

  /**
   * Obtém progresso de uma operação ativa
   */
  getOperationProgress(operationId: string): BulkOperationProgress | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * Lista todas as operações ativas
   */
  getActiveOperations(): BulkOperationProgress[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Cancela uma operação em andamento
   */
  async cancelOperation(operationId: string, userId: string): Promise<void> {
    const operation = this.activeOperations.get(operationId);
    if (!operation) {
      throw new Error('Operação não encontrada');
    }

    operation.status = 'CANCELLED';
    this.updateProgress(operationId, operation);

    await auditSystem.log({
      eventType: AuditEventType.USER_LOGIN, // Usar evento genérico
      severity: AuditSeverity.MEDIUM,
      userId,
      action: 'BULK_OPERATION_CANCELLED',
      description: `Operação em massa cancelada: ${operationId}`,
      metadata: { operationId, cancelledAt: new Date() }
    });

    this.activeOperations.delete(operationId);
    this.operationCallbacks.delete(operationId);
  }

  // Métodos privados

  private generateOperationId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateProgress(operationId: string, progress: BulkOperationProgress): void {
    this.activeOperations.set(operationId, progress);
    
    const callback = this.operationCallbacks.get(operationId);
    if (callback) {
      callback(progress);
    }
  }

  private calculateETA(progress: BulkOperationProgress, totalBatches: number, completedBatches: number): Date {
    const elapsed = Date.now() - progress.startTime.getTime();
    const avgTimePerBatch = elapsed / completedBatches;
    const remainingBatches = totalBatches - completedBatches;
    const estimatedRemainingTime = remainingBatches * avgTimePerBatch;
    
    return new Date(Date.now() + estimatedRemainingTime);
  }

  private async executeBatchUpdate(
    collectionName: string, 
    batch: Array<{ documentId: string; data: Partial<any> }>,
    validateData?: (data: any) => boolean
  ): Promise<void> {
    const writeBatchRef = writeBatch(db);

    for (const update of batch) {
      if (validateData && !validateData(update.data)) {
        throw new Error(`Dados inválidos para documento ${update.documentId}`);
      }

      const docRef = doc(db, collectionName, update.documentId);
      writeBatchRef.update(docRef, {
        ...update.data,
        updatedAt: Timestamp.now()
      });
    }

    await writeBatchRef.commit();
  }

  private async executeBatchDelete(collectionName: string, documentIds: string[]): Promise<void> {
    const writeBatchRef = writeBatch(db);

    for (const documentId of documentIds) {
      const docRef = doc(db, collectionName, documentId);
      writeBatchRef.delete(docRef);
    }

    await writeBatchRef.commit();
  }

  private async executeBatchCreate(collectionName: string, documents: any[]): Promise<void> {
    const collectionRef = collection(db, collectionName);

    // Para criação, não podemos usar writeBatch com addDoc
    // Vamos usar Promise.all para paralelizar
    const createPromises = documents.map(document => 
      addDoc(collectionRef, {
        ...document,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
    );

    await Promise.all(createPromises);
  }

  private async simulateBatchUpdate(
    batch: Array<{ documentId: string; data: Partial<any> }>,
    validateData?: (data: any) => boolean
  ): Promise<void> {
    // Simular validação e delay para dry run
    for (const update of batch) {
      if (validateData && !validateData(update.data)) {
        throw new Error(`Dados inválidos para documento ${update.documentId}`);
      }
    }
    
    // Simular delay de rede
    await this.delay(100);
  }

  private async getBatchResults(batch: Array<{ documentId: string; data: any }>): Promise<Array<{ documentId: string; success: boolean }>> {
    return batch.map(update => ({
      documentId: update.documentId,
      success: true
    }));
  }

  private async createBackupBeforeDelete(collectionName: string, documentIds: string[]): Promise<any[]> {
    const backupData: any[] = [];
    
    // Buscar documentos em lotes para backup
    const batches = this.createBatches(documentIds, 30); // Limite do Firestore para 'in' queries
    
    for (const batch of batches) {
      const q = query(
        collection(db, collectionName),
        where('__name__', 'in', batch)
      );
      
      const snapshot = await getDocs(q);
      snapshot.forEach(doc => {
        backupData.push({
          id: doc.id,
          data: doc.data()
        });
      });
    }
    
    return backupData;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Instância singleton
export const bulkOperationSystem = new BulkOperationSystem();

// Funções utilitárias

/**
 * Hook para usar operações em massa no React
 */
export function useBulkOperations() {
  return {
    bulkUpdate: bulkOperationSystem.bulkUpdate.bind(bulkOperationSystem),
    bulkDelete: bulkOperationSystem.bulkDelete.bind(bulkOperationSystem),
    bulkCreate: bulkOperationSystem.bulkCreate.bind(bulkOperationSystem),
    getOperationProgress: bulkOperationSystem.getOperationProgress.bind(bulkOperationSystem),
    getActiveOperations: bulkOperationSystem.getActiveOperations.bind(bulkOperationSystem),
    cancelOperation: bulkOperationSystem.cancelOperation.bind(bulkOperationSystem)
  };
}