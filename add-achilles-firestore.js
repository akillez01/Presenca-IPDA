// Script para adicionar o usuário Achilles no Firestore
// Execute no console do navegador ou como script Node.js

const addAchillesToFirestore = async () => {
  try {
    // Dados do usuário Achilles
    const achillesData = {
      uid: 'r3ZqNdkjc2YueZfK3QWB1ATmT9I3',
      email: 'achilles.oliveira.souza@gmail.com',
      displayName: 'Achilles Oliveira',
      role: 'user',
      active: true,
      createdAt: new Date('2025-08-08').toISOString(),
      lastLoginAt: new Date('2025-08-08').toISOString(),
      emailVerified: true,
      userType: 'BASIC_USER',
      permissions: {
        canViewReports: true,
        canEditReports: false,
        canManageUsers: false,
        canAccessAdmin: false
      }
    };

    console.log('Adicionando Achilles ao Firestore...');
    
    // Se estiver executando no navegador com Firebase já importado
    if (typeof db !== 'undefined') {
      const { doc, setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'users', achillesData.uid), achillesData);
      console.log('✅ Achilles adicionado com sucesso ao Firestore!');
    } else {
      console.log('📋 Dados para adicionar no Firestore:');
      console.log(JSON.stringify(achillesData, null, 2));
    }
    
    return achillesData;
  } catch (error) {
    console.error('❌ Erro ao adicionar Achilles:', error);
  }
};

// Executar a função
addAchillesToFirestore();
