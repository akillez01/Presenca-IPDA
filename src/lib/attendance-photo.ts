'use client';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import { storage } from './firebase';

interface UploadAttendancePhotoParams {
  cpf: string;
  file?: File;
  dataUrl?: string;
}

interface UploadResult {
  downloadURL: string;
  storagePath: string;
  isLocal?: boolean;
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

// Converte arquivo para base64 (fallback se Storage falhar)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Comprime a imagem antes do upload para reduzir tamanho
async function compressImage(file: File, maxSizeKB: number = 500): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Redimensiona se muito grande (max 1920px)
        const maxDimension = 1920;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Tenta diferentes qualidades até atingir o tamanho desejado
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }
            
            const sizeKB = blob.size / 1024;
            if (sizeKB <= maxSizeKB || quality <= 0.3) {
              const extension = file.type?.split('/')[1] || 'jpg';
              const compressedFile = new File([blob], file.name, { type: `image/${extension}` });
              resolve(compressedFile);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, file.type || 'image/jpeg', quality);
        };
        
        tryCompress();
      };
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAttendancePhoto({ cpf, file, dataUrl }: UploadAttendancePhotoParams): Promise<UploadResult> {
  const selectedFile = await ensureFileFromSource(file, dataUrl);
  const cleanCpf = cpf.replace(/\D/g, '') || 'sem-cpf';
  const extension = selectedFile.type?.split('/')[1] || 'jpg';
  const timestamp = Date.now();
  const filename = `${cleanCpf}-${timestamp}.${extension}`;
  const storagePath = `attendance-photos/${filename}`;
  
  console.log('📸 Iniciando upload de foto...');
  console.log('   Arquivo original:', selectedFile.name, '-', Math.round(selectedFile.size / 1024), 'KB');
  
  try {
    // Comprime a imagem antes do upload
    console.log('🔄 Comprimindo imagem...');
    const compressedFile = await compressImage(selectedFile, 500);
    console.log('   Arquivo comprimido:', Math.round(compressedFile.size / 1024), 'KB');
    
    // Tenta fazer upload para Firebase Storage
    console.log('☁️ Enviando para Firebase Storage...');
    const storageRef = ref(storage, storagePath);
    
    const snapshot = await uploadBytes(storageRef, compressedFile, {
      contentType: compressedFile.type,
      customMetadata: {
        cpf: cleanCpf,
        uploadDate: new Date().toISOString(),
      }
    });
    
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Upload concluído com sucesso!');
    console.log('   URL:', downloadURL.substring(0, 60) + '...');
    
    return {
      downloadURL,
      storagePath,
      isLocal: false
    };
    
  } catch (storageError) {
    // Se falhar, usa base64 como fallback (mas comprimido)
    console.warn('⚠️ Falha no Firebase Storage, usando fallback base64:', storageError);
    
    try {
      console.log('🔄 Convertendo para base64 comprimido...');
      const compressedFile = await compressImage(selectedFile, 300); // Menor para base64
      const base64Data = await fileToBase64(compressedFile);
      const sizeKB = Math.round(base64Data.length / 1024);
      console.log(`✅ Foto convertida (base64 comprimido): ${sizeKB} KB`);
      
      return {
        downloadURL: base64Data,
        storagePath: `local:${filename}`,
        isLocal: true
      };
    } catch (base64Error) {
      console.error('❌ Falha completa ao salvar imagem:', base64Error);
      throw new Error('Não foi possível salvar a imagem.');
    }
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
  
  // Se for base64, retorna null (não tem path no Storage)
  if (downloadUrl.startsWith('data:image/')) {
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
