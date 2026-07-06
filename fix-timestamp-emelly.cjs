/**
 * Script para corrigir o timestamp do registro de Emelly Barros
 * De: 17/11/2025 10:33:48
 * Para: 16/11/2025 10:33:48
 * 
 * INSTRUÇÕES PARA CORREÇÃO MANUAL VIA FIREBASE CONSOLE:
 * 
 * 1. Acesse: https://console.firebase.google.com/
 * 2. Selecione seu projeto
 * 3. Vá em Firestore Database
 * 4. Navegue até a coleção: attendance
 * 5. Procure pelo documento com CPF: 07089733297
 * 6. Clique no documento
 * 7. Edite o campo "timestamp"
 * 8. Altere para: 16 de novembro de 2025 às 10:33:48 (horário de Manaus)
 * 9. Salve as alterações
 * 
 * OU USE O COMANDO FIREBASE CLI:
 * 
 * firebase firestore:update "attendance/{DOC_ID}" --data '{"timestamp":"2025-11-16T10:33:48.000Z"}'
 * 
 * Substitua {DOC_ID} pelo ID real do documento
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║                   CORREÇÃO DE TIMESTAMP                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Registro: Emelly Barros                                       ║
║  CPF: 07089733297                                              ║
║                                                                ║
║  Data Atual: 17/11/2025 10:33:48                              ║
║  Data Correta: 16/11/2025 10:33:48                            ║
║                                                                ║
╠════════════════════════════════════════════════════════════════╣
║  COMO CORRIGIR:                                                ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  1. Acesse: https://console.firebase.google.com/              ║
║  2. Firestore Database → attendance                            ║
║  3. Procure CPF: 07089733297                                   ║
║  4. Edite o campo "timestamp"                                  ║
║  5. Altere para: 16/11/2025 10:33:48                          ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);
