import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Função para atualizar as configurações do Firebase com os novos cargos
export async function updateFirebaseConfig() {
  try {
    const configRef = doc(db, 'system', 'config');
    
    const updatedConfig = {
      churchPositionOptions: [
        'Conselheiro(a)',
        'Financeiro(a)',
        'Secretário(a)',
        'Pastor',
        'Presbítero',
        'Diácono',
        'Dirigente 1',
        'Dirigente 2',
        'Dirigente 3',
        'Cooperador(a)',
        'Líder Reação',
        'Líder Simplifique',
        'Líder Creative',
        'Líder Discipulus',
        'Líder Adore',
        'Auxiliar Expansão (a)',
        'Etda Professor(a)',
        'Coordenador Etda (a)',
        'Líder Galileu (a)',
        'Líder Adote uma alma (a)',
        'Membro',
        'Outro'
      ],
      lastUpdated: new Date(),
      updatedBy: 'system-update'
    };

    await updateDoc(configRef, updatedConfig);
    console.log('Configurações do Firebase atualizadas com sucesso!');
    return { success: true };
  } catch (error) {
    console.error('Erro ao atualizar configurações do Firebase:', error);
    return { success: false, error };
  }
}

// Função para executar a atualização
export async function runFirebaseUpdate() {
  console.log('Iniciando atualização das configurações do Firebase...');
  const result = await updateFirebaseConfig();
  
  if (result.success) {
    console.log('✅ Atualização concluída com sucesso!');
  } else {
    console.error('❌ Erro na atualização:', result.error);
  }
  
  return result;
}
