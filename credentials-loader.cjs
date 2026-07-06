const fs = require('fs');
const path = require('path');

const DEFAULT_CREDENTIALS_FILE = 'credentials.local.json';

function resolveCredentialsPath() {
  const configuredPath = process.env.IPDA_CREDENTIALS_FILE || DEFAULT_CREDENTIALS_FILE;
  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `[credentials] JSON inválido em ${filePath}: ${error.message}`
    );
  }
}

function loadCredentials() {
  const filePath = resolveCredentialsPath();

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `[credentials] Arquivo não encontrado: ${filePath}\n` +
      'Crie este arquivo a partir de credentials.example.json e mantenha fora do Git remoto.'
    );
  }

  return readJsonFile(filePath);
}

function ensureObject(value, fieldName) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[credentials] Campo obrigatório inválido: ${fieldName}`);
  }
  return value;
}

function ensureString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`[credentials] Campo obrigatório ausente: ${fieldName}`);
  }
  return value;
}

function getFirebaseAdminConfig(credentials) {
  const firebase = ensureObject(credentials.firebase, 'firebase');
  const serviceAccountPath = ensureString(firebase.serviceAccountPath, 'firebase.serviceAccountPath');

  return {
    projectId: typeof firebase.projectId === 'string' ? firebase.projectId : undefined,
    databaseURL: typeof firebase.databaseURL === 'string' ? firebase.databaseURL : undefined,
    serviceAccountPath: path.isAbsolute(serviceAccountPath)
      ? serviceAccountPath
      : path.resolve(process.cwd(), serviceAccountPath),
  };
}

function getFirebaseClientConfig(credentials) {
  const firebase = ensureObject(credentials.firebase, 'firebase');
  const clientConfig = ensureObject(firebase.clientConfig, 'firebase.clientConfig');

  const resolved = {
    apiKey: clientConfig.apiKey || process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: clientConfig.authDomain || process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: clientConfig.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: clientConfig.storageBucket || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: clientConfig.messagingSenderId || process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: clientConfig.appId || process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: clientConfig.measurementId || process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    databaseURL: clientConfig.databaseURL || firebase.databaseURL || process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };

  ensureString(resolved.apiKey, 'firebase.clientConfig.apiKey');
  ensureString(resolved.authDomain, 'firebase.clientConfig.authDomain');
  ensureString(resolved.projectId, 'firebase.clientConfig.projectId');
  ensureString(resolved.storageBucket, 'firebase.clientConfig.storageBucket');
  ensureString(resolved.messagingSenderId, 'firebase.clientConfig.messagingSenderId');
  ensureString(resolved.appId, 'firebase.clientConfig.appId');

  return resolved;
}

function getMysqlConfig(credentials) {
  const mysql = ensureObject(credentials.mysql, 'mysql');

  return {
    host: ensureString(mysql.host, 'mysql.host'),
    user: ensureString(mysql.user, 'mysql.user'),
    password: ensureString(mysql.password, 'mysql.password'),
    database: ensureString(mysql.database, 'mysql.database'),
    port: Number.isInteger(mysql.port) ? mysql.port : 3306,
  };
}

function getUserByKey(credentials, key, section = 'users') {
  const collection = ensureObject(credentials[section], section);
  const user = collection[key];

  if (!user || typeof user !== 'object') {
    throw new Error(`[credentials] Usuário '${key}' não encontrado em '${section}'.`);
  }

  ensureString(user.email, `${section}.${key}.email`);
  ensureString(user.password, `${section}.${key}.password`);

  return user;
}

function getUsersByKeys(credentials, keys, section = 'users') {
  return keys.map((key) => getUserByKey(credentials, key, section));
}

module.exports = {
  loadCredentials,
  getFirebaseAdminConfig,
  getFirebaseClientConfig,
  getMysqlConfig,
  getUserByKey,
  getUsersByKeys,
};
