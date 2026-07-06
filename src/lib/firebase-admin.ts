import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

type ServiceAccountPayload = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function readServiceAccountFromEnv(): ServiceAccountPayload | null {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
}

function readServiceAccountFromFile(): ServiceAccountPayload | null {
  const candidatePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    resolve(process.cwd(), 'serviceAccountKey.json'),
    resolve(process.cwd(), 'reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json'),
    resolve(process.cwd(), 'reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json'),
  ].filter((value): value is string => Boolean(value));

  for (const filePath of candidatePaths) {
    if (!existsSync(filePath)) {
      continue;
    }

    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as ServiceAccountPayload;

    if (raw.project_id && raw.client_email && raw.private_key) {
      return {
        ...raw,
        private_key: raw.private_key.replace(/\\n/g, '\n'),
      };
    }
  }

  return null;
}

function getServiceAccount() {
  const serviceAccount = readServiceAccountFromEnv() || readServiceAccountFromFile();

  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin não está configurado. Defina FIREBASE_ADMIN_* ou forneça um arquivo de credenciais no projeto.'
    );
  }

  return serviceAccount;
}

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const serviceAccount = getServiceAccount();

  return initializeApp({
    credential: cert({
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }),
    projectId: serviceAccount.project_id,
  });
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}
