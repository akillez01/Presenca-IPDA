// Script para testar se a criação de usuários está funcionando
// Cole no console do navegador na página de gerenciamento de usuários

console.log('🧪 TESTE DE CRIAÇÃO DE USUÁRIO');

// Verificar se Firebase está carregado
if (typeof auth !== 'undefined' && typeof db !== 'undefined') {
  console.log('✅ Firebase Auth e Firestore carregados');
} else {
  console.log('❌ Firebase não carregado - verifique a configuração');
}

// Verificar se usuário atual é super user
console.log('👤 Usuário atual:', auth.currentUser?.email);
console.log('🔐 É super usuário:', 
  auth.currentUser?.email === 'admin@ipda.org.br' || 
  auth.currentUser?.email === 'marciodesk@ipda.app.br'
);

// Função de teste (não executar automaticamente)
window.testarCriacaoUsuario = async function(email = 'teste@exemplo.com', senha = 'teste123') {
  try {
    console.log(`🔄 Testando criação: ${email}`);
    
    const { createUserWithEmailAndPassword } = await import('firebase/auth');
    const { setDoc, doc } = await import('firebase/firestore');
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    console.log('✅ Usuário criado no Auth:', userCredential.user.uid);
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email: email,
      displayName: 'Usuário Teste',
      role: 'user',
      active: true,
      createdAt: new Date().toISOString()
    });
    
    console.log('✅ Perfil criado no Firestore');
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    console.log('💡 Erro detalhado:', error.code, error.message);
  }
};

console.log('💡 Para testar, execute: testarCriacaoUsuario("email@teste.com", "senha123")');
