import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Tipos para melhor type safety
interface ExistingRecord {
  id: string;
  fullName: string;
  cpf?: string;
  region?: string;
  churchPosition?: string;
  timestamp?: string;
}

interface DuplicateCheckResult {
  isDuplicate: boolean;
  message: string;
  count?: number;
  existingRecords?: ExistingRecord[];
}

interface SimilarNameResult {
  hasSimilar: boolean;
  message: string;
  type?: 'exact' | 'similar';
  matches?: ExistingRecord[];
}

interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  duplicateInfo: DuplicateCheckResult | null;
}

interface FormData {
  cpf?: string;
  fullName?: string;
  [key: string]: any;
}

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// Função para verificar se um CPF já existe
export async function checkDuplicateCPF(cpf: string): Promise<DuplicateCheckResult> {
  try {
    // Limpar CPF (remover pontos e hífens)
    const cleanCPF = cpf.replace(/\D/g, '');
    
    console.log(`🔍 Verificando CPF: ${cleanCPF}`);
    
    // Buscar registros com este CPF
    const snapshot = await db.collection('attendance')
      .where('cpf', '==', cleanCPF)
      .get();
    
    if (snapshot.empty) {
      console.log('✅ CPF disponível');
      return {
        isDuplicate: false,
        message: 'CPF disponível para cadastro'
      };
    }
    
    // Se encontrou registros, coletar informações
    const existingRecords: ExistingRecord[] = [];
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      existingRecords.push({
        id: doc.id,
        fullName: data.fullName || '',
        region: data.region || '',
        churchPosition: data.churchPosition || '',
        timestamp: data.timestamp?.toDate?.()?.toLocaleString('pt-BR') || data.timestamp || ''
      });
    });
    
    console.log(`⚠️ CPF já cadastrado ${existingRecords.length} vez(es):`);
    existingRecords.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.fullName} - ${record.region} (${record.timestamp})`);
    });
    
    return {
      isDuplicate: true,
      count: existingRecords.length,
      existingRecords: existingRecords,
      message: `CPF já cadastrado ${existingRecords.length} vez(es). Verifique se não é um registro duplicado.`
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar CPF:', error);
    throw new Error('Erro ao verificar duplicatas de CPF');
  }
}

// Função para verificar nome similar (para detectar possíveis duplicatas)
export async function checkSimilarName(fullName: string, cpf: string | null = null): Promise<SimilarNameResult> {
  try {
    const nameParts = fullName.toLowerCase().trim().split(' ').filter((part: string) => part.length > 2);
    
    if (nameParts.length < 2) {
      return { hasSimilar: false, message: 'Nome muito curto para verificação' };
    }
    
    // Buscar por nome completo exato
    const snapshot = await db.collection('attendance')
      .where('fullName', '==', fullName)
      .get();
    
    if (!snapshot.empty) {
      const exactMatches: ExistingRecord[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Se tem CPF, só considera duplicata se for CPF diferente
        if (!cpf || data.cpf !== cpf.replace(/\D/g, '')) {
          exactMatches.push({
            id: doc.id,
            fullName: data.fullName || '',
            cpf: data.cpf || '',
            region: data.region || ''
          });
        }
      });
      
      if (exactMatches.length > 0) {
        return {
          hasSimilar: true,
          type: 'exact',
          matches: exactMatches,
          message: `Nome exato já cadastrado ${exactMatches.length} vez(es)`
        };
      }
    }
    
    return { hasSimilar: false, message: 'Nome disponível' };
    
  } catch (error) {
    console.error('❌ Erro ao verificar nome similar:', error);
    return { hasSimilar: false, message: 'Erro na verificação' };
  }
}

// Função principal para validar antes do cadastro
export async function validateBeforeRegister(formData: FormData): Promise<ValidationResult> {
  try {
    console.log('🔍 Validando dados antes do cadastro...');
    
    const results: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
      duplicateInfo: null
    };
    
    // 1. Verificar CPF duplicado
    if (formData.cpf) {
      const cpfCheck = await checkDuplicateCPF(formData.cpf);
      if (cpfCheck.isDuplicate) {
        results.isValid = false;
        results.errors.push(cpfCheck.message);
        results.duplicateInfo = cpfCheck;
      }
    }
    
    // 2. Verificar nome similar
    if (formData.fullName) {
      const nameCheck = await checkSimilarName(formData.fullName, formData.cpf || null);
      if (nameCheck.hasSimilar) {
        if (nameCheck.type === 'exact') {
          results.isValid = false;
          results.errors.push(nameCheck.message);
        } else {
          results.warnings.push(nameCheck.message);
        }
      }
    }
    
    console.log(`📋 Resultado da validação: ${results.isValid ? '✅ Válido' : '❌ Inválido'}`);
    if (results.errors.length > 0) {
      console.log('❌ Erros encontrados:', results.errors);
    }
    if (results.warnings.length > 0) {
      console.log('⚠️ Avisos:', results.warnings);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Erro na validação:', error);
    return {
      isValid: false,
      errors: ['Erro interno na validação. Tente novamente.'],
      warnings: [],
      duplicateInfo: null
    };
  }
}
