/**
 * Gerador de Ícones PWA
 * Gera todos os ícones necessários para o PWA em diferentes tamanhos
 */

// Este script deve ser executado no navegador para gerar os ícones
// Copie e cole no console do navegador para executar

function generatePWAIcons() {
  const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
  
  sizes.forEach(size => {
    // Criar canvas
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Fundo azul com bordas arredondadas
    const radius = size * 0.125; // 12.5% de raio
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, radius);
    ctx.fill();
    
    // Texto "I" principal
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.4}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', size / 2, size * 0.4);
    
    // Texto "PDA" secundário
    ctx.font = `${size * 0.15}px Arial, sans-serif`;
    ctx.fillText('PDA', size / 2, size * 0.75);
    
    // Converter para download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `icon-${size}x${size}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  });
  
  console.log('✅ Todos os ícones PWA foram gerados e baixados!');
}

// Executar a função
if (typeof window !== 'undefined') {
  generatePWAIcons();
} else {
  console.log('⚠️ Este script deve ser executado no navegador');
  console.log('📋 Copie esta função e execute no console do navegador:');
  console.log('generatePWAIcons()');
}

export default generatePWAIcons;