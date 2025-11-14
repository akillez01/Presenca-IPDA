import { db } from '@/lib/firebase';
import type { AttendanceRecord } from '@/lib/types';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    updateDoc,
    where
} from 'firebase/firestore';

// Classe para controle de concorrência e auditoria
class AttendanceManager {
  private static instance: AttendanceManager;
  private retryAttempts = 3;
  private retryDelay = 1000; // 1 segundo

  static getInstance(): AttendanceManager {
    if (!AttendanceManager.instance) {
      AttendanceManager.instance = new AttendanceManager();
    }
    return AttendanceManager.instance;
  }

  // Log de auditoria para debugging
  private async logAuditEvent(event: string, data: any) {
    try {
      const logsCollection = collection(db, 'audit_logs');
      await addDoc(logsCollection, {
        event,
        data,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent,
        ip: await this.getUserIP()
      });
    } catch (error) {
      console.warn('Erro ao salvar log de auditoria:', error);
    }
  }

  private async getUserIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // Sleep para retry
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Buscar registros com cache otimizado
  async getAttendanceRecords(): Promise<AttendanceRecord[]> {
    try {
      console.log('🔥 Iniciando busca no Firebase com controle de concorrência...');
      
      const attendanceCollection = collection(db, 'attendance');
      const snapshot = await getDocs(attendanceCollection);
      
      const records: AttendanceRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        records.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : data.lastUpdated,
        } as AttendanceRecord);
      });
      
      await this.logAuditEvent('GET_ATTENDANCE_RECORDS', { 
        totalRecords: records.length,
        success: true 
      });
      
      return records;
    } catch (error) {
      await this.logAuditEvent('GET_ATTENDANCE_RECORDS_ERROR', { 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      });
      throw error;
    }
  }

  // Registro de presença com transação atômica
  async updateAttendanceStatusAtomic(
    id: string, 
    status: string, 
    absentReason?: string,
    userEmail?: string
  ): Promise<{ success: boolean; message: string; retries?: number }> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const result = await runTransaction(db, async (transaction) => {
          const docRef = doc(db, 'attendance', id);
          const docSnapshot = await transaction.get(docRef);
          
          if (!docSnapshot.exists()) {
            throw new Error(`Documento ${id} não encontrado`);
          }
          
          const currentData = docSnapshot.data();
          const now = new Date();
          
          // Verificar se já foi atualizado hoje (proteção contra duplicação)
          if (currentData.status === status && currentData.lastUpdated) {
            const lastUpdate = currentData.lastUpdated.toDate();
            const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
            
            // Se foi atualizado com o mesmo status há menos de 5 minutos, ignorar
            if (diffMinutes < 5) {
              await this.logAuditEvent('DUPLICATE_ATTENDANCE_BLOCKED', {
                id,
                status,
                userEmail,
                timeDiff: diffMinutes,
                attempt
              });
              
              return {
                success: false,
                message: `${currentData.fullName} já tem status "${status}" registrado há ${Math.round(diffMinutes)} minuto(s). Duplicação bloqueada.`,
                isDuplicate: true
              };
            }
          }
          
          const updateData: any = {
            status,
            lastUpdated: serverTimestamp(),
            lastUpdatedBy: userEmail || 'unknown',
            updateCount: (currentData.updateCount || 0) + 1
          };
          
          if (absentReason) {
            updateData.absentReason = absentReason;
          }
          
          // Transação atômica
          transaction.update(docRef, updateData);
          
          await this.logAuditEvent('ATTENDANCE_UPDATE_SUCCESS', {
            id,
            status,
            userEmail,
            attempt,
            fullName: currentData.fullName,
            previousStatus: currentData.status
          });
          
          return {
            success: true,
            message: `Presença atualizada com sucesso para ${currentData.fullName}!`,
            attempt
          };
        });
        
        return {
          ...result,
          retries: attempt - 1
        };
        
      } catch (error) {
        lastError = error;
        console.warn(`Tentativa ${attempt} falhou:`, error instanceof Error ? error.message : String(error));
        
        await this.logAuditEvent('ATTENDANCE_UPDATE_RETRY', {
          id,
          status,
          attempt,
          error: error instanceof Error ? error.message : String(error),
          userEmail
        });
        
        if (attempt < this.retryAttempts) {
          await this.sleep(this.retryDelay * attempt); // Backoff exponencial
        }
      }
    }
    
    // Se chegou aqui, todas as tentativas falharam
    await this.logAuditEvent('ATTENDANCE_UPDATE_FAILED', {
      id,
      status,
      finalError: lastError?.message,
      totalAttempts: this.retryAttempts,
      userEmail
    });
    
    return {
      success: false,
      message: `Erro após ${this.retryAttempts} tentativas: ${lastError?.message}`,
      retries: this.retryAttempts
    };
  }

  // Processamento de CPF com controle de duplicação robusto
  async processCPFAtomic(cpf: string, userEmail?: string): Promise<{ 
    success: boolean; 
    message: string; 
    person?: AttendanceRecord;
    details?: any;
  }> {
    try {
      const cleanCPF = cpf.replace(/\D/g, '');
      
      // Buscar pessoa por CPF usando query
      const attendanceCollection = collection(db, 'attendance');
      const q = query(attendanceCollection, where('cpf', '==', cleanCPF));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        await this.logAuditEvent('CPF_NOT_FOUND', { cpf: cleanCPF, userEmail });
        return {
          success: false,
          message: `CPF ${cpf} não encontrado no sistema.`
        };
      }
      
      const personDoc = snapshot.docs[0];
      const person = {
        id: personDoc.id,
        ...personDoc.data(),
        timestamp: personDoc.data().timestamp?.toDate ? 
          personDoc.data().timestamp.toDate() : personDoc.data().timestamp
      } as AttendanceRecord;
      
      // Verificação de duplicação robusta usando transação
      const result = await runTransaction(db, async (transaction) => {
        const docRef = doc(db, 'attendance', person.id);
        const freshDoc = await transaction.get(docRef);
        
        if (!freshDoc.exists()) {
          throw new Error('Documento não encontrado durante transação');
        }
        
        const currentData = freshDoc.data();
        const now = new Date();
        
        // Verificar se já tem presença hoje
        if (currentData.status === 'Presente' && currentData.lastUpdated) {
          const lastUpdate = currentData.lastUpdated.toDate();
          const sameDay = lastUpdate.toDateString() === now.toDateString();
          
          if (sameDay) {
            const timeAgo = Math.round((now.getTime() - lastUpdate.getTime()) / (1000 * 60));
            
            await this.logAuditEvent('CPF_ALREADY_PRESENT_TODAY', {
              cpf: cleanCPF,
              fullName: currentData.fullName,
              lastUpdate: lastUpdate.toISOString(),
              timeAgo,
              userEmail
            });
            
            return {
              success: false,
              message: `${currentData.fullName} já tem presença registrada hoje às ${lastUpdate.toLocaleTimeString('pt-BR')} (há ${timeAgo} minuto(s)).`,
              details: {
                alreadyPresent: true,
                lastUpdate: lastUpdate.toISOString(),
                timeAgo
              }
            };
          }
        }
        
        // Registrar presença
        const updateData = {
          status: 'Presente',
          timestamp: serverTimestamp(),
          lastUpdated: serverTimestamp(),
          lastUpdatedBy: userEmail || 'unknown',
          updateCount: (currentData.updateCount || 0) + 1,
          cpfScannedAt: now.toISOString(),
          scanMethod: 'CPF_SCANNER'
        };
        
        transaction.update(docRef, updateData);
        
        await this.logAuditEvent('CPF_PRESENCE_REGISTERED', {
          cpf: cleanCPF,
          fullName: currentData.fullName,
          userEmail,
          scanMethod: 'CPF_SCANNER'
        });
        
        return {
          success: true,
          message: `Presença registrada com sucesso para ${currentData.fullName}!`,
          person: { 
            ...person, 
            status: 'Presente',
            timestamp: now,
            lastUpdated: now,
            lastUpdatedBy: userEmail || 'unknown',
            updateCount: (currentData.updateCount || 0) + 1,
            cpfScannedAt: now.toISOString(),
            scanMethod: 'CPF_SCANNER'
          }
        };
      });
      
      return result;
      
    } catch (error) {
      await this.logAuditEvent('CPF_PROCESS_ERROR', {
        cpf: cpf.replace(/\D/g, ''),
        error: error instanceof Error ? error.message : String(error),
        userEmail
      });
      
      return {
        success: false,
        message: `Erro ao processar CPF: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  // Lote de atualizações com controle de concorrência
  async batchUpdateAttendances(
    updates: Array<{ id: string; status: string; absentReason?: string }>,
    userEmail?: string
  ): Promise<{ success: boolean; results: any[]; errors: any[] }> {
    const results: any[] = [];
    const errors: any[] = [];
    
    // Processar em lotes de 10 para evitar sobrecarga
    const batchSize = 10;
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (update) => {
        try {
          const result = await this.updateAttendanceStatusAtomic(
            update.id, 
            update.status, 
            update.absentReason,
            userEmail
          );
          results.push({ ...update, result });
          return result;
        } catch (error) {
          const errorResult = { 
            id: update.id, 
            error: error instanceof Error ? error.message : String(error),
            success: false 
          };
          errors.push(errorResult);
          return errorResult;
        }
      });
      
      await Promise.all(batchPromises);
      
      // Pequena pausa entre lotes
      if (i + batchSize < updates.length) {
        await this.sleep(500);
      }
    }
    
    await this.logAuditEvent('BATCH_UPDATE_COMPLETED', {
      totalUpdates: updates.length,
      successCount: results.filter(r => r.result?.success).length,
      errorCount: errors.length,
      userEmail
    });
    
    return {
      success: errors.length === 0,
      results,
      errors
    };
  }
  
  // Relatório de auditoria para debug
  async getAuditReport(hours: number = 24): Promise<any[]> {
    try {
      const logsCollection = collection(db, 'audit_logs');
      const snapshot = await getDocs(logsCollection);
      
      const logs: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp
        });
      });
      
      // Filtrar últimas X horas
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
      return logs
        .filter(log => log.timestamp && log.timestamp > cutoff)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
    } catch (error) {
      console.error('Erro ao buscar relatório de auditoria:', error);
      return [];
    }
  }
}

// Funções exportadas que usam o AttendanceManager
const attendanceManager = AttendanceManager.getInstance();

export const getAttendanceRecords = () => attendanceManager.getAttendanceRecords();
export const updateAttendanceStatusAtomic = (id: string, status: string, absentReason?: string, userEmail?: string) => 
  attendanceManager.updateAttendanceStatusAtomic(id, status, absentReason, userEmail);
export const processCPFAtomic = (cpf: string, userEmail?: string) => 
  attendanceManager.processCPFAtomic(cpf, userEmail);
export const batchUpdateAttendances = (updates: any[], userEmail?: string) => 
  attendanceManager.batchUpdateAttendances(updates, userEmail);
export const getAuditReport = (hours?: number) => 
  attendanceManager.getAuditReport(hours);

// Manter compatibilidade com funções antigas
export async function updateAttendanceStatus(
  id: string, 
  status: string, 
  absentReason?: string
): Promise<{ success: boolean; message: string }> {
  console.warn('⚠️ Usando função legada. Recomendado migrar para updateAttendanceStatusAtomic');
  return attendanceManager.updateAttendanceStatusAtomic(id, status, absentReason);
}

export async function processCPF(cpf: string): Promise<{ success: boolean; message: string; person?: AttendanceRecord }> {
  console.warn('⚠️ Usando função legada. Recomendado migrar para processCPFAtomic');
  return attendanceManager.processCPFAtomic(cpf);
}

// Outras funções existentes mantidas para compatibilidade
export async function updateAttendanceRecord(
  id: string, 
  data: Partial<AttendanceRecord>
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, 'attendance', id);
    const updateData = {
      ...data,
      lastUpdated: serverTimestamp(),
    };
    
    await updateDoc(docRef, updateData);
    
    return {
      success: true,
      message: 'Registro atualizado com sucesso!'
    };
  } catch (error) {
    console.error('Erro ao atualizar registro:', error);
    return {
      success: false,
      message: 'Erro ao atualizar registro.'
    };
  }
}

export async function deleteAttendance(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, 'attendance', id);
    await deleteDoc(docRef);
    
    return {
      success: true,
      message: 'Registro excluído com sucesso!'
    };
  } catch (error) {
    console.error('Erro ao excluir registro:', error);
    return {
      success: false,
      message: 'Erro ao excluir registro.'
    };
  }
}

export async function createAttendanceRecord(data: Omit<AttendanceRecord, 'id'>): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    const attendanceCollection = collection(db, 'attendance');
    const docRef = await addDoc(attendanceCollection, {
      ...data,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      updateCount: 1
    });
    
    return {
      success: true,
      message: 'Registro criado com sucesso!',
      id: docRef.id
    };
  } catch (error) {
    console.error('Erro ao criar registro:', error);
    return {
      success: false,
      message: 'Erro ao criar registro.'
    };
  }
}