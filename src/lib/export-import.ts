/**
 * Sistema de Export/Import Avançado
 * Funcionalidades para exportação e importação de dados com múltiplos formatos
 */

import { useAuditLog } from '@/lib/audit-system';
import { db } from '@/lib/firebase';
import {
    addDoc,
    collection,
    doc,
    getDocs,
    limit,
    orderBy,
    query,
    Timestamp,
    where,
    writeBatch
} from 'firebase/firestore';

// Tipos para Export/Import
export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'xml';
  includeMetadata: boolean;
  dateRange?: {
    field: string;
    startDate: Date;
    endDate: Date;
  };
  fields?: string[];
  filters?: Array<{
    field: string;
    operator: '==' | '!=' | '<' | '<=' | '>' | '>=' | 'array-contains' | 'in' | 'not-in';
    value: any;
  }>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  maxRecords?: number;
}

export interface ImportOptions {
  format: 'json' | 'csv' | 'xlsx';
  mode: 'insert' | 'update' | 'upsert';
  skipDuplicates: boolean;
  validateData: boolean;
  idField?: string;
  mapping?: Record<string, string>; // Campo origem -> Campo destino
  transformations?: Record<string, (value: any) => any>;
  batchSize: number;
}

export interface ExportResult {
  success: boolean;
  recordsExported: number;
  format: string;
  fileUrl?: string;
  blob?: Blob;
  fileName: string;
  metadata: {
    exportedAt: Date;
    exportedBy: string;
    collection: string;
    filters: any;
    totalSize: number;
  };
  error?: string;
}

export interface ImportResult {
  success: boolean;
  recordsProcessed: number;
  recordsImported: number;
  recordsSkipped: number;
  recordsWithErrors: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  importId: string;
  metadata: {
    importedAt: Date;
    importedBy: string;
    collection: string;
    mode: string;
    fileName: string;
  };
}

export interface ExportProgress {
  recordsProcessed: number;
  totalRecords: number;
  currentStep: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface ImportProgress {
  recordsProcessed: number;
  totalRecords: number;
  recordsImported: number;
  recordsSkipped: number;
  currentBatch: number;
  totalBatches: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

// Classe principal do sistema de Export/Import
export class ExportImportSystem {
  private auditLog: ReturnType<typeof useAuditLog>;

  constructor(userId: string) {
    this.auditLog = useAuditLog();
  }

  // Rate limiting simples
  private async checkRateLimit(key: string): Promise<void> {
    // Implementação simples de rate limiting
    const now = Date.now();
    const storageKey = `rateLimit_${key}`;
    const lastRequest = localStorage.getItem(storageKey);
    
    if (lastRequest && now - parseInt(lastRequest) < 1000) {
      throw new Error('Muitas solicitações. Tente novamente em alguns segundos.');
    }
    
    localStorage.setItem(storageKey, now.toString());
  }

  // Exportar dados
  async exportData(
    collectionName: string,
    options: ExportOptions,
    userId: string,
    onProgress?: (progress: ExportProgress) => void
  ): Promise<ExportResult> {
    const startTime = Date.now();
    
    try {
      // Rate limiting
      await this.rateLimiter.checkRateLimit(`export_${userId}`, 5, 60000);

      // Construir query
      let queryRef = collection(db, collectionName);
      let constraints: any[] = [];

      // Aplicar filtros
      if (options.filters) {
        options.filters.forEach(filter => {
          constraints.push(where(filter.field, filter.operator as any, filter.value));
        });
      }

      // Aplicar range de datas
      if (options.dateRange) {
        constraints.push(
          where(options.dateRange.field, '>=', Timestamp.fromDate(options.dateRange.startDate)),
          where(options.dateRange.field, '<=', Timestamp.fromDate(options.dateRange.endDate))
        );
      }

      // Aplicar ordenação
      if (options.sortBy) {
        constraints.push(orderBy(options.sortBy, options.sortOrder || 'asc'));
      }

      // Aplicar limite
      if (options.maxRecords) {
        constraints.push(limit(options.maxRecords));
      }

      const finalQuery = constraints.length > 0 ? query(queryRef, ...constraints) : queryRef;

      // Executar query
      onProgress?.({
        recordsProcessed: 0,
        totalRecords: 0,
        currentStep: 'Consultando dados...',
        percentage: 10
      });

      const snapshot = await getDocs(finalQuery);
      const totalRecords = snapshot.size;

      onProgress?.({
        recordsProcessed: 0,
        totalRecords,
        currentStep: 'Processando dados...',
        percentage: 30
      });

      // Processar documentos
      const documents: any[] = [];
      let processedCount = 0;

      snapshot.forEach(docSnapshot => {
        const data = docSnapshot.data();
        const docData: any = {
          id: docSnapshot.id,
          ...data
        };

        // Incluir metadata se solicitado
        if (options.includeMetadata) {
          docData._metadata = {
            path: docSnapshot.ref.path,
            exists: docSnapshot.exists(),
            createTime: data.createdAt || null,
            updateTime: data.updatedAt || null
          };
        }

        // Filtrar campos se especificado
        if (options.fields && options.fields.length > 0) {
          const filteredData: any = { id: docData.id };
          options.fields.forEach(field => {
            if (docData[field] !== undefined) {
              filteredData[field] = docData[field];
            }
          });
          documents.push(filteredData);
        } else {
          documents.push(docData);
        }

        processedCount++;
        if (processedCount % 100 === 0) {
          onProgress?.({
            recordsProcessed: processedCount,
            totalRecords,
            currentStep: 'Processando dados...',
            percentage: 30 + (processedCount / totalRecords) * 40
          });
        }
      });

      onProgress?.({
        recordsProcessed: processedCount,
        totalRecords,
        currentStep: 'Gerando arquivo...',
        percentage: 80
      });

      // Gerar arquivo no formato especificado
      const { blob, fileName } = await this.generateExportFile(documents, options);

      onProgress?.({
        recordsProcessed: processedCount,
        totalRecords,
        currentStep: 'Concluído',
        percentage: 100
      });

      const result: ExportResult = {
        success: true,
        recordsExported: documents.length,
        format: options.format,
        blob,
        fileName,
        metadata: {
          exportedAt: new Date(),
          exportedBy: userId,
          collection: collectionName,
          filters: options.filters || [],
          totalSize: blob.size
        }
      };

      // Log de auditoria
      await this.auditLogger.logEvent({
        userId,
        eventType: 'DATA_EXPORT',
        entityType: 'collection',
        entityId: collectionName,
        metadata: {
          recordsExported: documents.length,
          format: options.format,
          filters: options.filters,
          duration: Date.now() - startTime
        }
      } as AuditEvent);

      return result;

    } catch (error) {
      console.error('Erro na exportação:', error);
      
      await this.auditLogger.logEvent({
        userId,
        eventType: 'DATA_EXPORT_FAILED',
        entityType: 'collection',
        entityId: collectionName,
        metadata: {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          duration: Date.now() - startTime
        }
      } as AuditEvent);

      return {
        success: false,
        recordsExported: 0,
        format: options.format,
        fileName: '',
        metadata: {
          exportedAt: new Date(),
          exportedBy: userId,
          collection: collectionName,
          filters: options.filters || [],
          totalSize: 0
        },
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  // Importar dados
  async importData(
    collectionName: string,
    file: File,
    options: ImportOptions,
    userId: string,
    onProgress?: (progress: ImportProgress) => void
  ): Promise<ImportResult> {
    const startTime = Date.now();
    const importId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Rate limiting
      await this.rateLimiter.checkRateLimit(`import_${userId}`, 3, 60000);

      onProgress?.({
        recordsProcessed: 0,
        totalRecords: 0,
        recordsImported: 0,
        recordsSkipped: 0,
        currentBatch: 0,
        totalBatches: 0,
        percentage: 10
      });

      // Parsear arquivo
      const records = await this.parseImportFile(file, options);
      const totalRecords = records.length;
      const totalBatches = Math.ceil(totalRecords / options.batchSize);

      onProgress?.({
        recordsProcessed: 0,
        totalRecords,
        recordsImported: 0,
        recordsSkipped: 0,
        currentBatch: 0,
        totalBatches,
        percentage: 20
      });

      let recordsImported = 0;
      let recordsSkipped = 0;
      const errors: ImportResult['errors'] = [];

      // Processar em batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = writeBatch(db);
        const startIndex = batchIndex * options.batchSize;
        const endIndex = Math.min(startIndex + options.batchSize, totalRecords);
        const batchRecords = records.slice(startIndex, endIndex);

        for (let i = 0; i < batchRecords.length; i++) {
          const recordIndex = startIndex + i;
          const record = batchRecords[i];

          try {
            // Validar dados se solicitado
            if (options.validateData) {
              const validation = this.validateRecord(record, collectionName);
              if (!validation.valid) {
                errors.push({
                  row: recordIndex + 1,
                  error: `Validação falhou: ${validation.errors.join(', ')}`,
                  data: record
                });
                recordsSkipped++;
                continue;
              }
            }

            // Aplicar mapeamentos
            let processedRecord = this.applyMapping(record, options.mapping);
            
            // Aplicar transformações
            processedRecord = this.applyTransformations(processedRecord, options.transformations);

            // Adicionar timestamps
            processedRecord.importedAt = Timestamp.now();
            processedRecord.importedBy = userId;
            processedRecord.importId = importId;

            // Determinar ID do documento
            let docId: string | undefined;
            if (options.idField && processedRecord[options.idField]) {
              docId = processedRecord[options.idField];
              delete processedRecord[options.idField];
            }

            // Executar operação baseada no modo
            const docRef = docId ? doc(db, collectionName, docId) : doc(collection(db, collectionName));

            switch (options.mode) {
              case 'insert':
                if (docId) {
                  batch.set(docRef, processedRecord);
                } else {
                  // Para insert sem ID, usamos addDoc fora do batch
                  // Isso é uma limitação do Firestore
                  await addDoc(collection(db, collectionName), processedRecord);
                }
                break;
              case 'update':
                if (docId) {
                  batch.update(docRef, processedRecord);
                } else {
                  errors.push({
                    row: recordIndex + 1,
                    error: 'Modo update requer ID do documento',
                    data: record
                  });
                  recordsSkipped++;
                  continue;
                }
                break;
              case 'upsert':
                batch.set(docRef, processedRecord, { merge: true });
                break;
            }

            recordsImported++;

          } catch (error) {
            errors.push({
              row: recordIndex + 1,
              error: error instanceof Error ? error.message : 'Erro desconhecido',
              data: record
            });
            recordsSkipped++;
          }
        }

        // Executar batch
        if (batch._mutations && batch._mutations.length > 0) {
          await batch.commit();
        }

        // Atualizar progresso
        const recordsProcessed = endIndex;
        onProgress?.({
          recordsProcessed,
          totalRecords,
          recordsImported,
          recordsSkipped,
          currentBatch: batchIndex + 1,
          totalBatches,
          percentage: 20 + (recordsProcessed / totalRecords) * 70
        });

        // Rate limiting entre batches
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      onProgress?.({
        recordsProcessed: totalRecords,
        totalRecords,
        recordsImported,
        recordsSkipped,
        currentBatch: totalBatches,
        totalBatches,
        percentage: 100
      });

      const result: ImportResult = {
        success: true,
        recordsProcessed: totalRecords,
        recordsImported,
        recordsSkipped,
        recordsWithErrors: errors.length,
        errors,
        importId,
        metadata: {
          importedAt: new Date(),
          importedBy: userId,
          collection: collectionName,
          mode: options.mode,
          fileName: file.name
        }
      };

      // Log de auditoria
      await this.auditLogger.logEvent({
        userId,
        eventType: 'DATA_IMPORT',
        entityType: 'collection',
        entityId: collectionName,
        metadata: {
          recordsImported,
          recordsSkipped,
          recordsWithErrors: errors.length,
          importId,
          fileName: file.name,
          duration: Date.now() - startTime
        }
      } as AuditEvent);

      return result;

    } catch (error) {
      console.error('Erro na importação:', error);
      
      await this.auditLogger.logEvent({
        userId,
        eventType: 'DATA_IMPORT_FAILED',
        entityType: 'collection',
        entityId: collectionName,
        metadata: {
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          fileName: file.name,
          duration: Date.now() - startTime
        }
      } as AuditEvent);

      return {
        success: false,
        recordsProcessed: 0,
        recordsImported: 0,
        recordsSkipped: 0,
        recordsWithErrors: 0,
        errors: [{
          row: 0,
          error: error instanceof Error ? error.message : 'Erro desconhecido',
          data: {}
        }],
        importId,
        metadata: {
          importedAt: new Date(),
          importedBy: userId,
          collection: collectionName,
          mode: options.mode,
          fileName: file.name
        }
      };
    }
  }

  // Gerar arquivo de exportação
  private async generateExportFile(
    documents: any[],
    options: ExportOptions
  ): Promise<{ blob: Blob; fileName: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    switch (options.format) {
      case 'json':
        const jsonData = JSON.stringify(documents, null, 2);
        return {
          blob: new Blob([jsonData], { type: 'application/json' }),
          fileName: `export_${timestamp}.json`
        };

      case 'csv':
        const csvData = this.convertToCSV(documents);
        return {
          blob: new Blob([csvData], { type: 'text/csv;charset=utf-8' }),
          fileName: `export_${timestamp}.csv`
        };

      case 'xml':
        const xmlData = this.convertToXML(documents);
        return {
          blob: new Blob([xmlData], { type: 'application/xml' }),
          fileName: `export_${timestamp}.xml`
        };

      default:
        throw new Error(`Formato não suportado: ${options.format}`);
    }
  }

  // Parsear arquivo de importação
  private async parseImportFile(file: File, options: ImportOptions): Promise<any[]> {
    const text = await file.text();
    
    switch (options.format) {
      case 'json':
        const jsonData = JSON.parse(text);
        return Array.isArray(jsonData) ? jsonData : [jsonData];

      case 'csv':
        return this.parseCSV(text);

      default:
        throw new Error(`Formato não suportado para importação: ${options.format}`);
    }
  }

  // Converter para CSV
  private convertToCSV(documents: any[]): string {
    if (documents.length === 0) return '';

    // Obter todas as chaves únicas
    const allKeys = new Set<string>();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => allKeys.add(key));
    });

    const headers = Array.from(allKeys);
    const csvLines = [headers.join(',')];

    documents.forEach(doc => {
      const values = headers.map(header => {
        const value = doc[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      csvLines.push(values.join(','));
    });

    return csvLines.join('\n');
  }

  // Converter para XML
  private convertToXML(documents: any[]): string {
    const xmlLines = ['<?xml version="1.0" encoding="UTF-8"?>', '<documents>'];
    
    documents.forEach(doc => {
      xmlLines.push('  <document>');
      Object.entries(doc).forEach(([key, value]) => {
        const xmlValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        xmlLines.push(`    <${key}>${xmlValue}</${key}>`);
      });
      xmlLines.push('  </document>');
    });
    
    xmlLines.push('</documents>');
    return xmlLines.join('\n');
  }

  // Parsear CSV
  private parseCSV(text: string): any[] {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const records: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const record: any = {};
      
      headers.forEach((header, index) => {
        const value = values[index] || '';
        
        // Tentar converter para número ou booleano
        if (value === 'true') record[header] = true;
        else if (value === 'false') record[header] = false;
        else if (!isNaN(Number(value)) && value !== '') record[header] = Number(value);
        else record[header] = value;
      });
      
      records.push(record);
    }

    return records;
  }

  // Aplicar mapeamento de campos
  private applyMapping(record: any, mapping?: Record<string, string>): any {
    if (!mapping) return record;

    const mappedRecord: any = {};
    Object.entries(record).forEach(([key, value]) => {
      const mappedKey = mapping[key] || key;
      mappedRecord[mappedKey] = value;
    });

    return mappedRecord;
  }

  // Aplicar transformações
  private applyTransformations(
    record: any,
    transformations?: Record<string, (value: any) => any>
  ): any {
    if (!transformations) return record;

    const transformedRecord = { ...record };
    Object.entries(transformations).forEach(([field, transformer]) => {
      if (transformedRecord[field] !== undefined) {
        transformedRecord[field] = transformer(transformedRecord[field]);
      }
    });

    return transformedRecord;
  }

  // Validar registro
  private validateRecord(record: any, collectionName: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validações básicas
    if (!record || typeof record !== 'object') {
      errors.push('Registro deve ser um objeto');
      return { valid: false, errors };
    }

    // Validações específicas por coleção
    switch (collectionName) {
      case 'presencas':
        if (!record.nome) errors.push('Nome é obrigatório');
        if (!record.status) errors.push('Status é obrigatório');
        if (record.status && !['Presente', 'Ausente'].includes(record.status)) {
          errors.push('Status deve ser "Presente" ou "Ausente"');
        }
        break;
      
      case 'usuarios':
        if (!record.email) errors.push('Email é obrigatório');
        if (record.email && !record.email.includes('@')) errors.push('Email inválido');
        break;
    }

    return { valid: errors.length === 0, errors };
  }
}

// Hook para usar o sistema de Export/Import
export function useExportImport(userId: string) {
  const exportImportSystem = new ExportImportSystem(userId);

  return {
    exportData: exportImportSystem.exportData.bind(exportImportSystem),
    importData: exportImportSystem.importData.bind(exportImportSystem)
  };
}