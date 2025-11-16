// Script para verificar fotos salvas no Firestore
// Execute este código no console do navegador na página /register

async function verificarFotosSalvas() {
  console.log('🔍 Verificando fotos salvas nos registros...\n');

  try {
    const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
    const { db } = await import('./src/lib/firebase.ts');

    // Busca os últimos 10 registros
    const q = query(
      collection(db, 'attendance'),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.log('❌ Nenhum registro encontrado');
      return;
    }

    console.log(`📊 Encontrados ${snapshot.size} registros recentes\n`);

    let comFoto = 0;
    let semFoto = 0;
    let fotoBase64 = 0;
    let fotoStorage = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const nome = data.fullName || 'Sem nome';
      const cpf = data.cpf || 'Sem CPF';
      const timestamp = data.timestamp?.toDate() || new Date();
      const photoUrl = data.photoUrl;

      console.log(`\n📝 Registro: ${nome} (CPF: ${cpf})`);
      console.log(`   Data: ${timestamp.toLocaleString('pt-BR')}`);
      
      if (photoUrl) {
        comFoto++;
        
        if (photoUrl.startsWith('data:image/')) {
          fotoBase64++;
          const sizeKB = Math.round(photoUrl.length / 1024);
          console.log(`   ✅ Foto: BASE64 (${sizeKB} KB)`);
        } else if (photoUrl.startsWith('https://firebasestorage')) {
          fotoStorage++;
          console.log(`   ✅ Foto: Firebase Storage`);
          console.log(`   URL: ${photoUrl.substring(0, 80)}...`);
        } else {
          console.log(`   ⚠️  Foto: Formato desconhecido`);
          console.log(`   URL: ${photoUrl.substring(0, 80)}...`);
        }
      } else {
        semFoto++;
        console.log(`   ❌ Sem foto`);
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMO:');
    console.log('='.repeat(60));
    console.log(`Total de registros analisados: ${snapshot.size}`);
    console.log(`✅ Com foto: ${comFoto} (${Math.round(comFoto/snapshot.size*100)}%)`);
    console.log(`   - Base64 (local): ${fotoBase64}`);
    console.log(`   - Firebase Storage: ${fotoStorage}`);
    console.log(`❌ Sem foto: ${semFoto} (${Math.round(semFoto/snapshot.size*100)}%)`);
    console.log('='.repeat(60));

    console.log('\n✅ Verificação concluída!');
    
    return {
      total: snapshot.size,
      comFoto,
      semFoto,
      fotoBase64,
      fotoStorage
    };

  } catch (error) {
    console.error('❌ Erro ao verificar fotos:', error);
    throw error;
  }
}

// Expõe a função globalmente
window.verificarFotosSalvas = verificarFotosSalvas;

console.log('✅ Teste de fotos carregado!');
console.log('Execute: verificarFotosSalvas()');
