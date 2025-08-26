import admin from 'firebase-admin';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { NextRequest, NextResponse } from 'next/server';

// Configuração para exportação estática
export const dynamic = 'force-static';
export const revalidate = false;

function initializeFirebaseAdmin() {
  if (getApps().length > 0) {
    return admin.app(); // Retorna a app já inicializada
  }

  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.log('⚠️ Firebase Admin não configurado - variáveis ausentes');
      return null;
    }

    // Corrige o formato da chave privada
    privateKey = privateKey.replace(/\\n/g, '\n');

    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      databaseURL: `https://${projectId}.firebaseio.com`
    });

    console.log('✅ Firebase Admin inicializado');
    return app;
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const adminApp = initializeFirebaseAdmin();

  try {
    const { action, uid, email, password, displayName } = await request.json();

    if (!adminApp) {
      return NextResponse.json({
        success: false,
        message: 'Firebase Admin não configurado. Verifique as credenciais do serviço.',
      }, { status: 500 });
    }

    if (action === 'delete') {
      await admin.auth().deleteUser(uid);
      await admin.firestore().collection('users').doc(uid).delete();

      return NextResponse.json({
        success: true,
        message: `Usuário ${email} excluído com sucesso.`,
      });
    }

    if (action === 'create') {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      });

      await admin.firestore().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role: 'user',
        active: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        emailVerified: true,
        userType: 'BASIC_USER',
        permissions: {
          canViewReports: true,
          canEditReports: false,
          canManageUsers: false,
          canAccessAdmin: false,
        },
      });

      return NextResponse.json({
        success: true,
        user: userRecord.toJSON(),
        message: `Usuário ${email} criado com sucesso.`,
      });
    }

    if (action === 'list') {
      const listUsersResult = await admin.auth().listUsers();
      const users = listUsersResult.users.map((userRecord) => ({
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime,
        },
      }));

      return NextResponse.json({ success: true, users });
    }

    return NextResponse.json({ 
      success: false, 
      message: 'Ação não reconhecida.' 
    }, { status: 400 });

  } catch (error: any) {
    console.error('❌ Erro na API:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro interno no servidor.',
      code: error.code || 'internal_error',
    }, { status: 500 });
  }
}

export async function GET() {
  const adminApp = initializeFirebaseAdmin();

  if (!adminApp) {
    return NextResponse.json({
      success: false,
      message: 'Firebase Admin não configurado. Verifique as credenciais do serviço.',
    }, { status: 500 });
  }

  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map((userRecord) => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      metadata: {
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
      },
    }));

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro ao listar usuários',
      code: error.code || 'list_users_error',
    }, { status: 500 });
  }
}