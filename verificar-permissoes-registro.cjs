const admin = require("firebase-admin");

// Inicializar Firebase Admin (usando arquivo de credenciais)
if (!admin.apps.length) {
  try {
    const serviceAccount = require("./reuniao-ministerial-firebase-adminsdk-fbsvc-abbe4123aa.json");
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://reuniao-ministerial-default-rtdb.firebaseio.com",
    });
    console.log("✅ Firebase Admin inicializado com sucesso");
  } catch (error) {
    console.log("❌ Erro ao inicializar Firebase Admin:", error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function verificarPermissoesUsuarios() {
  console.log("🔍 Verificando permissões dos usuários de registro...\n");

  const usuariosRegistro = [
    "registro1@ipda.app.br",
    "registro2@ipda.app.br",
    "registro3@ipda.app.br",
    "registro4@ipda.app.br",
  ];

  for (const email of usuariosRegistro) {
    try {
      console.log(`📧 Verificando usuário: ${email}`);

      // Verificar se o usuário existe no Authentication
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
        console.log(`  ✅ Usuário existe no Authentication`);
        console.log(`  🆔 UID: ${userRecord.uid}`);
        console.log(`  📅 Criado em: ${userRecord.metadata.creationTime}`);
      } catch (error) {
        console.log(
          `  ❌ Usuário não encontrado no Authentication:`,
          error.message
        );
        continue;
      }

      // Verificar se existe documento no Firestore
      try {
        const userDoc = await db.collection("users").doc(userRecord.uid).get();
        if (userDoc.exists) {
          console.log(`  ✅ Documento existe no Firestore`);
          const userData = userDoc.data();
          console.log(`  📋 Dados:`, {
            email: userData.email,
            userType: userData.userType,
            role: userData.role,
            isActive: userData.isActive,
          });
        } else {
          console.log(`  ⚠️  Documento não existe no Firestore - criando...`);

          // Criar documento no Firestore
          const timestamp = admin.firestore.FieldValue.serverTimestamp();
          await db
            .collection("users")
            .doc(userRecord.uid)
            .set({
              email: email,
              userType: "EDITOR_USER",
              role: "editor",
              isActive: true,
              active: true,
              createdAt: timestamp,
              updatedAt: timestamp,
              permissions: [
                "dashboard",
                "register",
                "attendance",
                "letters",
                "presencadecadastrados",
                "edit_attendance",
                "reports"
              ],
              canEditAttendance: true,
              canAccessReports: true,
              canViewAttendance: true,
            });

          console.log(`  ✅ Documento criado no Firestore`);
        }
      } catch (error) {
        console.log(
          `  ❌ Erro ao verificar/criar documento no Firestore:`,
          error.message
        );
      }

      // Testar acesso à coleção attendance
      try {
        const attendanceSnapshot = await db
          .collection("attendance")
          .limit(1)
          .get();
        console.log(
          `  ✅ Acesso à coleção attendance: OK (${attendanceSnapshot.docs.length} documentos)`
        );
      } catch (error) {
        console.log(`  ❌ Erro ao acessar coleção attendance:`, error.message);
      }

      console.log(""); // Linha em branco
    } catch (error) {
      console.log(`❌ Erro geral para ${email}:`, error.message);
      console.log(""); // Linha em branco
    }
  }
}

// Executar verificação
verificarPermissoesUsuarios()
  .then(() => {
    console.log("✅ Verificação de permissões concluída");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Erro na verificação:", error);
    process.exit(1);
  });
