// Script para gerar QR Code do formulário público de presença
// Uso: node scripts/gerar-qr-formulario.js

const QRCode = require('qrcode');

// URL de produção do formulário público de presença
const url = 'https://ipda.app.br/register';

QRCode.toFile('qr-presenca.png', url, {
  color: {
    dark: '#000',  // Cor do QR
    light: '#FFF'  // Fundo
  },
  width: 400
}, function (err) {
  if (err) return console.error('Erro ao gerar QR:', err);
  console.log('QR Code gerado: qr-presenca.png');
  console.log('Aponte a câmera do celular para acessar o formulário de presença!');
});
