import admin from 'firebase-admin';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = false;

function initializeFirebaseAdmin() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID; // ✅ sem NEXT_PUBLIC
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      console.log('⚠️ Firebase Admin não configurado - funcionalidades limitadas');
      return false;
    }

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    console.log('✅ Firebase Admin inicializado');
  }
  return true;
}

async function handleDeleteUser(request: Request) {
  const isAdminReady = initializeFirebaseAdmin();

  try {
    const { action, uid, email } = await request.json();
    console.log(`🔥 API DELETE-USER: ${action} para ${email || uid}`);

    if (!isAdminReady) {
      return NextResponse.json({
        success: false,
        message:
          'Firebase Admin não configurado. Configure as variáveis de ambiente FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.',
      }, { status: 500 });
    }

    if (action !== 'delete') {
      return NextResponse.json({
        success: false,
        message: `Ação '${action}' não reconhecida`,
      }, { status: 400 });
    }

    // 🔥 Exclusão no Firebase Auth e Firestore
    await admin.auth().deleteUser(uid);
    await admin.firestore().collection('users').doc(uid).delete();

    console.log(`✅ Usuário ${email} removido do Firebase Auth e Firestore`);

    return NextResponse.json({
      success: true,
      message: `Usuário ${email} removido completamente do Firebase Authentication e Firestore.`,
    });
  } catch (error: any) {
    console.error('❌ Erro ao remover usuário:', error);
    return NextResponse.json({
      success: false,
      message: error.message || 'Erro interno ao remover usuário',
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return handleDeleteUser(request);
}

export async function DELETE(request: Request) {
  return handleDeleteUser(request);
}
