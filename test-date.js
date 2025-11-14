// Teste simples de data
const hoje = new Date();
console.log('Data de hoje (local):', hoje.toLocaleDateString('pt-BR'));
console.log('Data de hoje (ISO):', hoje.toISOString().slice(0, 10));
console.log('Data de hoje (Manaus):', new Date(hoje.toLocaleString('en-US', { timeZone: 'America/Manaus' })).toISOString().slice(0, 10));

// Simular o que o frontend faz
const todayDateStr = new Date().toISOString().slice(0, 10);
console.log('todayDateStr que o frontend usa:', todayDateStr);

// Se os registros estão todos com data de hoje, deveria mostrar todos
console.log('\nSe TODOS os 1803 registros são de hoje (21/09/2025):');
console.log('- Frontend deveria mostrar: 1803 registros hoje');
console.log('- Mas está mostrando: 1800 registros hoje');
console.log('');
console.log('Possíveis explicações:');
console.log('1. Cache desatualizado');
console.log('2. Valor hardcoded em algum lugar');
console.log('3. Filtragem diferente ou erro de contagem');
console.log('4. Alguns registros têm problemas de data/timezone');
