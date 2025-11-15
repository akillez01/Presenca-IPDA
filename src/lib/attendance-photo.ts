'use client';

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';

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

export async function uploadAttendancePhoto({ cpf, file, dataUrl }: UploadAttendancePhotoParams) {
  const selectedFile = await ensureFileFromSource(file, dataUrl);
  const cleanCpf = cpf.replace(/\D/g, '') || 'sem-cpf';
  const extension = selectedFile.type?.split('/')[1] || 'jpg';
  const filename = `${cleanCpf}-${Date.now()}.${extension}`;
  const storagePath = `attendance_photos/${cleanCpf}/${filename}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, selectedFile, { contentType: selectedFile.type || 'image/jpeg' });
  const downloadURL = await getDownloadURL(storageRef);

  return { downloadURL, storagePath };
}

export async function deleteAttendancePhoto(storagePath: string) {
  const storageRef = ref(storage, storagePath);
  await deleteObject(storageRef);
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
