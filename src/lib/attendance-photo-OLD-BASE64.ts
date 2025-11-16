'use client';

import { deleteObject, ref } from 'firebase/storage';

import { storage } from './firebase';

interface UploadAttendancePhotoParams {
  cpf: string;
  file?: File;
  dataUrl?: string;
}

function ensureFileFromSource(file?: File, dataUrl?: string): Promise<File> {
  if (file) {
    return Promise.resolve(file);
  }
  if (!dataUrl) {
    return Promise.reject(new Error('Imagem não encontrada.'));
  }
  return fetch(dataUrl)
    .then((response) => response.blob())
    .then((blob) => {
      const extension = blob.type?.split('/')[1] || 'jpg';
      const filename = `captura-${Date.now()}.${extension}`;
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    });
}

// Converte arquivo para base64 para fallback local
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadAttendancePhoto({ cpf, file, dataUrl }: UploadAttendancePhotoParams) {
  const selectedFile = await ensureFileFromSource(file, dataUrl);
  const cleanCpf = cpf.replace(/\D/g, '') || 'sem-cpf';
  const extension = selectedFile.type?.split('/')[1] || 'jpg';
  const filename = `${cleanCpf}-${Date.now()}.${extension}`;
  
  console.log('📸 Iniciando upload de foto...');
  console.log('   Arquivo:', selectedFile.name, '-', Math.round(selectedFile.size / 1024), 'KB');
  
  // Como o Firebase Storage não está configurado, usa base64 diretamente
  // (Firebase Storage CORS está bloqueando - erro 404 no preflight)
  console.log('� Usando armazenamento base64 (Firebase Storage não configurado)');
  
  try {
    console.log('🔄 Convertendo foto para base64...');
    const base64Data = await fileToBase64(selectedFile);
    const sizeKB = Math.round(base64Data.length / 1024);
    console.log(`✅ Foto convertida com sucesso! Tamanho: ${sizeKB} KB`);
    
    return { 
      downloadURL: base64Data, 
      storagePath: `local:${filename}`,
      isLocal: true 
    };
  } catch (base64Error) {
    console.error('❌ Falha ao converter imagem para base64:', base64Error);
    throw new Error('Não foi possível converter a imagem para base64.');
  }
}

export async function deleteAttendancePhoto(storagePath: string) {
  // Não tenta deletar se for armazenamento local (base64)
  if (storagePath.startsWith('local:')) {
    console.log('📝 Foto local (base64) - não há arquivo para deletar no Storage');
    return;
  }
  
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    console.log('🗑️ Foto deletada do Firebase Storage');
  } catch (error) {
    console.warn('⚠️ Erro ao deletar foto do Storage:', error);
    // Não lança erro - a foto pode já ter sido deletada ou não existir
  }
}

export function getStoragePathFromUrl(downloadUrl: string | null | undefined): string | null {
  if (!downloadUrl) {
    return null;
  }
  try {
    const url = new URL(downloadUrl);
    const [, pathWithEncoding] = url.pathname.split('/o/');
    if (!pathWithEncoding) {
      return null;
    }
    return decodeURIComponent(pathWithEncoding);
  } catch (error) {
    console.warn('⚠️ Não foi possível extrair o caminho do Storage a partir da URL fornecida.', error);
    return null;
  }
}
