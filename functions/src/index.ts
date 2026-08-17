import cors from 'cors';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { onRequest } from 'firebase-functions/v2/https';

import {
  createManagedUser,
  deleteManagedUser,
  listManagedUsers,
  resolveAdminAccess,
  updateManagedUser,
} from './admin-user-management.js';

initializeApp();

const corsHandler = cors({ origin: true });

function getErrorMessage(error: unknown) {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

  switch (errorCode) {
    case 'auth/email-already-exists':
      return 'Este email já está cadastrado no Firebase Authentication.';
    case 'auth/invalid-email':
      return 'O email informado é inválido.';
    case 'auth/invalid-password':
      return 'A senha deve conter pelo menos 6 caracteres.';
    case 'auth/user-not-found':
      return 'Usuário não encontrado no Firebase Authentication.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Ocorreu um erro ao processar a solicitação de usuários.';
  }
}

export const adminUsers = onRequest({ region: 'us-central1', cors: true }, (request, response) => {
  corsHandler(request, response, async () => {
    const authorization = request.get('authorization') || request.get('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : null;

    if (!token) {
      response.status(401).json({ success: false, message: 'Sessão inválida. Faça login novamente para continuar.' });
      return;
    }

    let decodedToken;

    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch {
      response.status(401).json({ success: false, message: 'Não foi possível validar a sessão administrativa.' });
      return;
    }

    const access = await resolveAdminAccess(decodedToken);

    if (!access) {
      response.status(403).json({ success: false, message: 'Acesso negado para gerenciamento de usuários.' });
      return;
    }

    try {
      switch (request.method) {
        case 'GET': {
          const users = await listManagedUsers();
          response.status(200).json({ success: true, users });
          return;
        }

        case 'POST': {
          const body = request.body || {};
          const result = await createManagedUser(
            {
              email: String(body.email || ''),
              password: String(body.password || ''),
              displayName: String(body.displayName || ''),
              accessProfile: body.accessProfile || 'basic',
              permissions: Array.isArray(body.permissions) ? body.permissions : undefined,
            },
            access
          );

          response.status(200).json({
            success: true,
            message:
              result.mode === 'resynced'
                ? 'Usuário localizado e sincronizado com sucesso no Firebase.'
                : 'Usuário criado com sucesso e sincronizado com o Firebase.',
            uid: result.uid,
            mode: result.mode,
            user: result.user,
          });
          return;
        }

        case 'PATCH': {
          const body = request.body || {};

          await updateManagedUser(
            {
              uid: String(body.uid || ''),
              email: String(body.email || ''),
              displayName: String(body.displayName || ''),
              accessProfile: body.accessProfile || 'basic',
              active: body.active !== false,
              password: body.password ? String(body.password) : undefined,
              permissions: Array.isArray(body.permissions) ? body.permissions : undefined,
            },
            access
          );

          response.status(200).json({ success: true, message: 'Usuário atualizado com sucesso.' });
          return;
        }

        case 'DELETE': {
          const body = request.body || {};
          await deleteManagedUser(String(body.uid || ''), access);
          response.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });
          return;
        }

        default:
          response.status(405).json({ success: false, message: 'Método não suportado.' });
      }
    } catch (error) {
      response.status(500).json({ success: false, message: getErrorMessage(error) });
    }
  });
});
