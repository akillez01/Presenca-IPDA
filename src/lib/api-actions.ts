import { db } from '@/lib/firebase';
import { getMemberDirectoryRecords } from '@/lib/member-data';
import type { AttendanceRecord } from '@/lib/types';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';

// Função para buscar todos os registros de presença
export async function getAttendanceRecords(): Promise<AttendanceRecord[]> {
  try {
    console.log('🔥 Iniciando busca no Firebase...');
    
    const attendanceCollection = collection(db, 'attendance');
    console.log('📂 Coleção attendance obtida');

    const snapshot = await getDocs(attendanceCollection);
    console.log(`📊 Snapshot obtido: ${snapshot.size} documentos`);
    
    const records: AttendanceRecord[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp;
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;

      records.push({
        id: doc.id,
        ...data,
        // Garante que sempre haja uma data confiável para filtros
        timestamp: timestamp || createdAt || new Date(),
        createdAt: createdAt || timestamp || new Date(),
        lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : data.lastUpdated,
      } as AttendanceRecord);
    });
    
    console.log(`✅ ${records.length} registros processados com sucesso`);
    return records;
  } catch (error) {
    const code = (error as any)?.code;
    console.error('❌ Erro ao buscar registros:', code, (error as any)?.message);
    if (code === 'resource-exhausted') {
      throw new Error('Cota do Firebase excedida. Aguarde alguns minutos e tente novamente.');
    }
    throw error;
  }
}

// Função para buscar todos os membros (coleção members)
export async function getMembersRecords(): Promise<AttendanceRecord[]> {
  try {
    return await getMemberDirectoryRecords();
  } catch (error) {
    console.error('Erro ao buscar members:', error);
    throw error;
  }
}

// Função para atualizar o status de presença
export async function updateAttendanceStatus(
  id: string, 
  status: string, 
  absentReason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const docRef = doc(db, 'attendance', id);
    const updateData: any = {
      status,
      lastUpdated: serverTimestamp(),
    };
    
    if (absentReason) {
      updateData.absentReason = absentReason;
    }
    
    await updateDoc(docRef, updateData);
    
    return {
      success: true,
      message: 'Status de presença atualizado com sucesso!'
    };
  } catch (error) {
    console.error('Erro ao atualizar status de presença:', error);
    return {
      success: false,
      message: 'Erro ao atualizar status de presença.'
    };
  }
}

// Função para atualizar dados do registro
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

// Função para excluir um registro
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

// Função para criar um novo registro de presença
export async function createAttendanceRecord(data: Omit<AttendanceRecord, 'id'>): Promise<{ success: boolean; message: string; id?: string }> {
  try {
    const attendanceCollection = collection(db, 'attendance');
    const docRef = await addDoc(attendanceCollection, {
      ...data,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
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

// Função para processar CPF e registrar presença automaticamente
export async function processCPF(cpf: string): Promise<{ success: boolean; message: string; person?: AttendanceRecord }> {
  try {
    // Remove formatação do CPF
    const cleanCPF = cpf.replace(/\D/g, '');
    
    // Busca todos os registros para encontrar o CPF
    const records = await getAttendanceRecords();
    const person = records.find(r => r.cpf?.replace(/\D/g, '') === cleanCPF);
    
    if (!person) {
      return {
        success: false,
        message: `CPF ${cpf} não encontrado no sistema.`
      };
    }
    
    // Verifica se já tem presença registrada hoje
    const hoje = new Date();
    const hojeManaus = new Date(hoje.toLocaleString("en-US", { timeZone: "America/Manaus" }));
    
    if (person.timestamp) {
      const dataRegistro = new Date(person.timestamp);
      const dataManaus = new Date(dataRegistro.toLocaleString("en-US", { timeZone: "America/Manaus" }));
      
      if (dataManaus.getDate() === hojeManaus.getDate() && 
          dataManaus.getMonth() === hojeManaus.getMonth() && 
          dataManaus.getFullYear() === hojeManaus.getFullYear()) {
        return {
          success: false,
          message: `${person.fullName} já tem presença registrada hoje às ${dataManaus.toLocaleTimeString('pt-BR')}.`
        };
      }
    }
    
    // Registra presença
    const result = await updateAttendanceStatus(person.id, 'Presente');
    
    if (result.success) {
      return {
        success: true,
        message: `Presença registrada com sucesso para ${person.fullName}!`,
        person
      };
    } else {
      return result;
    }
  } catch (error) {
    console.error('Erro ao processar CPF:', error);
    return {
      success: false,
      message: 'Erro ao processar CPF.'
    };
  }
}
