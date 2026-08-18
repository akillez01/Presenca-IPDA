#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validando build para Plesk...\n');

const outputDir = path.join(process.cwd(), 'out');
let errors = [];
let warnings = [];
let validationPassed = true;

// Função para adicionar erro
function addError(message) {
    errors.push(message);
    validationPassed = false;
}

// Função para adicionar warning
function addWarning(message) {
    warnings.push(message);
}

// Verificar se a pasta out existe
if (!fs.existsSync(outputDir)) {
    addError('❌ Pasta "out" não encontrada. Execute: npm run build:plesk:full');
    console.error(errors[0]);
    process.exit(1);
}

// Verificar arquivos essenciais
const essentialFiles = [
    'index.html',
    '_next/static',
    '.htaccess'
];

console.log('📋 Verificando arquivos essenciais...');
essentialFiles.forEach(file => {
    const filePath = path.join(outputDir, file);
    if (fs.existsSync(filePath)) {
        console.log(`✅ ${file} - OK`);
    } else {
        addError(`❌ Arquivo essencial não encontrado: ${file}`);
    }
});

// Verificar estrutura HTML
console.log('\n🔍 Verificando estrutura HTML...');
const indexPath = path.join(outputDir, 'index.html');
if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Verificações essenciais
    const htmlChecks = [
        { check: indexContent.includes('<!DOCTYPE html>'), message: 'DOCTYPE HTML5' },
        { check: indexContent.includes('<meta charset='), message: 'Charset definido' },
        { check: indexContent.includes('<meta name="viewport"'), message: 'Viewport meta tag' },
        { check: indexContent.includes('Igreja Pentecostal Deus é Amor') || indexContent.includes('Sistema de Presença'), message: 'Título da aplicação' },
        { check: indexContent.includes('_next/static'), message: 'Assets do Next.js' }
    ];
    
    htmlChecks.forEach(({ check, message }) => {
        if (check) {
            console.log(`✅ ${message} - OK`);
        } else {
            addWarning(`⚠️  ${message} - não encontrado`);
        }
    });
}

// Verificar .htaccess
console.log('\n🔍 Verificando configuração .htaccess...');
const htaccessPath = path.join(outputDir, '.htaccess');
if (fs.existsSync(htaccessPath)) {
    const htaccessContent = fs.readFileSync(htaccessPath, 'utf8');
    
    const htaccessChecks = [
        { check: htaccessContent.includes('RewriteEngine On'), message: 'RewriteEngine habilitado' },
        { check: htaccessContent.includes('RewriteRule . /index.html'), message: 'SPA routing configurado' },
        { check: htaccessContent.includes('X-Content-Type-Options'), message: 'Headers de segurança' },
        { check: htaccessContent.includes('mod_deflate'), message: 'Compressão Gzip' },
        { check: htaccessContent.includes('mod_expires'), message: 'Cache de browser' }
    ];
    
    htaccessChecks.forEach(({ check, message }) => {
        if (check) {
            console.log(`✅ ${message} - OK`);
        } else {
            addWarning(`⚠️  ${message} - não configurado`);
        }
    });
} else {
    addError('❌ Arquivo .htaccess não encontrado');
}

// Verificar assets estáticos
console.log('\n🔍 Verificando assets estáticos...');
const staticDir = path.join(outputDir, '_next', 'static');
if (fs.existsSync(staticDir)) {
    const staticFiles = fs.readdirSync(staticDir, { recursive: true });
    const jsFiles = staticFiles.filter(f => f.toString().endsWith('.js')).length;
    const cssFiles = staticFiles.filter(f => f.toString().endsWith('.css')).length;
    
    console.log(`✅ Arquivos JavaScript: ${jsFiles}`);
    console.log(`✅ Arquivos CSS: ${cssFiles}`);
    
    if (jsFiles === 0) addWarning('⚠️  Nenhum arquivo JavaScript encontrado');
    if (cssFiles === 0) addWarning('⚠️  Nenhum arquivo CSS encontrado');
} else {
    addError('❌ Pasta _next/static não encontrada');
}

// Verificar tamanho dos arquivos
console.log('\n📊 Verificando tamanho dos arquivos...');
const maxSizes = {
    '.html': 500 * 1024, // 500KB
    '.js': 1024 * 1024,  // 1MB
    '.css': 200 * 1024   // 200KB
};

function checkFileSize(dir) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            checkFileSize(filePath);
        } else {
            const ext = path.extname(file);
            const size = stat.size;
            const maxSize = maxSizes[ext];
            
            if (maxSize && size > maxSize) {
                addWarning(`⚠️  Arquivo grande: ${file} (${(size/1024/1024).toFixed(2)}MB)`);
            }
        }
    });
}

checkFileSize(outputDir);

// Verificar configurações de Firebase
console.log('\n🔥 Verificando configuração Firebase...');
const hasFirebaseConfig = fs.readFileSync(indexPath, 'utf8').includes('firebase');
if (hasFirebaseConfig) {
    console.log('✅ Configuração Firebase encontrada');
} else {
    addWarning('⚠️  Configuração Firebase não detectada');
}

// Estatísticas finais
console.log('\n📊 Estatísticas do build:');
const { execSync } = require('child_process');
try {
    const totalSize = execSync(`du -sh "${outputDir}"`, { encoding: 'utf8' }).split('\t')[0];
    console.log(`📦 Tamanho total: ${totalSize.trim()}`);
    
    const fileCount = execSync(`find "${outputDir}" -type f | wc -l`, { encoding: 'utf8' }).trim();
    console.log(`📄 Total de arquivos: ${fileCount}`);
} catch (error) {
    console.log('📊 Não foi possível calcular estatísticas');
}

// Relatório final
console.log('\n' + '='.repeat(50));
console.log('📋 RELATÓRIO DE VALIDAÇÃO');
console.log('='.repeat(50));

if (validationPassed && errors.length === 0) {
    console.log('🎉 ✅ BUILD VÁLIDO PARA PLESK!');
    console.log('\n✅ Todos os arquivos essenciais estão presentes');
    console.log('✅ Configurações básicas estão corretas');
    console.log('✅ O build está pronto para deploy');
} else {
    console.log('❌ BUILD COM PROBLEMAS');
    console.log('\n❌ Erros encontrados:');
    errors.forEach(error => console.log(`   ${error}`));
}

if (warnings.length > 0) {
    console.log('\n⚠️  Avisos:');
    warnings.forEach(warning => console.log(`   ${warning}`));
}

console.log('\n📋 Próximos passos:');
if (validationPassed) {
    console.log('   1. ✅ Execute: npm run plesk:package');
    console.log('   2. ✅ Faça upload do arquivo .tar.gz para o Plesk');
    console.log('   3. ✅ Extraia no diretório público (public_html)');
    console.log('   4. ✅ Teste o funcionamento no seu domínio');
} else {
    console.log('   1. ❌ Corrija os erros listados acima');
    console.log('   2. ❌ Execute novamente: npm run build:plesk:full');
    console.log('   3. ❌ Execute novamente: npm run plesk:validate');
}

console.log('\n🆘 Suporte: AchillesOS - Sistema de Presença IPDA');
console.log('📧 Email: achilles.dev@exemplo.com');

// Exit code baseado na validação
process.exit(validationPassed ? 0 : 1);
