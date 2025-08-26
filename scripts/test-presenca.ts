// Teste das funções de consulta do MariaDB
const { getAllPresencas, getPresencaStats } = require('../src/lib/presenca-mysql');

(async () => {
  try {
    console.log('--- Testando busca de todos os registros ---');
    const registros = await getAllPresencas();
    console.log('Registros:', registros);

    console.log('\n--- Testando estatísticas ---');
    const stats = await getPresencaStats();
    console.log('Estatísticas:', stats);
  } catch (err) {
    console.error('Erro ao testar funções:', err);
  }
})();
