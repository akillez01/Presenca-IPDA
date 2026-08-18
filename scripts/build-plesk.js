#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('🚀 Iniciando build otimizado para Plesk...\n');

const outputDir = path.join(process.cwd(), 'out');
const currentFilePath = fileURLToPath(import.meta.url);
const apiDir = path.join(process.cwd(), 'src', 'app', 'api');
const apiBackupDir = path.join(process.cwd(), 'src', 'app', '__api-export-backup');

// Função para executar comandos
function runCommand(command, description) {
    console.log(`📦 ${description}...`);
    try {
        execSync(command, { stdio: 'inherit' });
        console.log(`✅ ${description} concluído\n`);
    } catch (error) {
        console.error(`❌ Erro em ${description}:`, error.message);
        process.exit(1);
    }
}

function disableApiRoutesForStaticExport() {
    if (!fs.existsSync(apiDir) && fs.existsSync(apiBackupDir)) {
        fs.renameSync(apiBackupDir, apiDir);
    }

    if (!fs.existsSync(apiDir)) {
        return false;
    }

    if (fs.existsSync(apiBackupDir)) {
        fs.rmSync(apiBackupDir, { recursive: true, force: true });
    }

    fs.renameSync(apiDir, apiBackupDir);
    console.log('📦 Rotas API temporariamente removidas para static export\n');
    return true;
}

function restoreApiRoutesAfterBuild() {
    if (!fs.existsSync(apiBackupDir)) {
        return;
    }

    if (fs.existsSync(apiDir)) {
        fs.rmSync(apiDir, { recursive: true, force: true });
    }

    fs.renameSync(apiBackupDir, apiDir);
    console.log('✅ Rotas API restauradas após o build\n');
}

// Função para otimizar arquivos
function optimizeFiles() {
    console.log('🎯 Otimizando arquivos para Plesk...\n');
    
    if (!fs.existsSync(outputDir)) {
        console.error('❌ Diretório "out" não encontrado!');
        process.exit(1);
    }

    // Estatísticas
    let totalFiles = 0;
    let optimizedFiles = 0;
    
    function walkDir(dir) {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                walkDir(filePath);
            } else {
                totalFiles++;
                const ext = path.extname(file).toLowerCase();
                
                // Otimizar arquivos HTML
                if (ext === '.html') {
                    optimizeHtmlFile(filePath);
                    optimizedFiles++;
                }
                
                // Otimizar arquivos CSS
                if (ext === '.css') {
                    optimizeCssFile(filePath);
                    optimizedFiles++;
                }
                
                // Otimizar arquivos JS
                if (ext === '.js') {
                    optimizeJsFile(filePath);
                    optimizedFiles++;
                }
            }
        });
    }
    
    function optimizeHtmlFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');

            // Nao compacte ou normalize HTML do Next export:
            // os scripts inline do app router carregam payload RSC sensivel a quebras/espacos.
            if (!content.includes('<meta name="robots"')) {
                content = content.replace(
                    '<head>',
                    '<head>\n  <meta name="robots" content="index, follow">'
                );
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
        } catch (error) {
            console.warn(`⚠️  Erro ao otimizar ${filePath}: ${error.message}`);
        }
    }
    
    function optimizeCssFile(filePath) {
        try {
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Remover comentários CSS
            content = content.replace(/\/\*[\s\S]*?\*\//g, '');
            
            // Remover espaços desnecessários
            content = content.replace(/\s+/g, ' ');
            content = content.replace(/;\s*}/g, '}');
            
            fs.writeFileSync(filePath, content, 'utf8');
        } catch (error) {
            console.warn(`⚠️  Erro ao otimizar ${filePath}: ${error.message}`);
        }
    }
    
    function optimizeJsFile(filePath) {
        // JS files são geralmente já minificados pelo Next.js
        // Apenas verificar se não há problemas
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            if (content.length === 0) {
                console.warn(`⚠️  Arquivo JS vazio: ${filePath}`);
            }
        } catch (error) {
            console.warn(`⚠️  Erro ao verificar ${filePath}: ${error.message}`);
        }
    }
    
    walkDir(outputDir);
    
    console.log(`📊 Otimização concluída: ${optimizedFiles}/${totalFiles} arquivos processados\n`);
}

// Função para gerar relatório de build
function generateBuildReport() {
    console.log('📋 Gerando relatório de build...\n');
    
    const reportPath = path.join(outputDir, 'build-report.txt');
    const buildTime = new Date().toISOString();
    
    let report = `Sistema de Presença IPDA - Relatório de Build Plesk
Desenvolvido por AchillesOS

Build executado em: ${buildTime}
Ambiente: Plesk/Static Export
Node.js: ${process.version}

Arquivos gerados:
`;

    function addFilesToReport(dir, prefix = '') {
        const files = fs.readdirSync(dir);
        
        files.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                report += `${prefix}📁 ${file}/\\n`;
                addFilesToReport(filePath, prefix + '  ');
            } else {
                const size = (stat.size / 1024).toFixed(2);
                report += `${prefix}📄 ${file} (${size} KB)\\n`;
            }
        });
    }
    
    addFilesToReport(outputDir);
    
    report += `
Instruções de Deploy:
1. Compacte todo o conteúdo da pasta 'out/'
2. Faça upload para o diretório público do seu Plesk (public_html/)
3. Extraia os arquivos no servidor
4. Verifique se o .htaccess foi aplicado corretamente
5. Teste o funcionamento em: https://seu-dominio.com

Configurações importantes:
- SPA routing configurado
- Headers de segurança aplicados
- Compressão Gzip habilitada
- Cache de browser otimizado

Suporte: AchillesOS - achilles.dev@exemplo.com
`;

    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`✅ Relatório salvo em: ${reportPath}\n`);
}

// Executar processo completo
async function main() {
    let apiRoutesHandled = false;

    try {
        // 1. Limpar cache e arquivos de teste
        console.log('🧹 Limpando cache e arquivos de teste...');
        if (fs.existsSync('.next')) {
            fs.rmSync('.next', { recursive: true });
        }
        if (fs.existsSync('out')) {
            fs.rmSync('out', { recursive: true });
        }
        
        // Remover arquivos de teste que podem causar problemas no build
        const testPaths = [
            'src/app/test-indexes',
            'src/app/test-login',
            'src/app/simple-login' // página de teste também
        ];
        
        testPaths.forEach(testPath => {
            if (fs.existsSync(testPath)) {
                console.log(`🗑️  Removendo pasta de teste: ${testPath}`);
                fs.rmSync(testPath, { recursive: true });
            }
        });

        console.log('✅ Cache e arquivos de teste limpos\n');

        // 2. Remover APIs do App Router durante o export estático
        apiRoutesHandled = disableApiRoutesForStaticExport();

        // 3. Build para Plesk
        runCommand('BUILD_TARGET=plesk NODE_ENV=production npm run build', 'Build Next.js para Plesk');

        // 4. Otimizar arquivos
        optimizeFiles();

        // 5. Gerar .htaccess
        runCommand('node scripts/generate-htaccess.js', 'Geração do .htaccess');

        // 6. Gerar relatório
        generateBuildReport();

        // 7. Estatísticas finais
        const stats = fs.statSync(outputDir);
        const totalSize = execSync(`du -sh "${outputDir}"`, { encoding: 'utf8' }).split('\\t')[0];

        console.log('🎉 Build para Plesk concluído com sucesso!\n');
        console.log('📊 Estatísticas:');
        console.log(`   📁 Pasta de saída: ${outputDir}`);
        console.log(`   📦 Tamanho total: ${totalSize.trim()}`);
        console.log(`   📅 Build realizado em: ${new Date().toLocaleString('pt-BR')}\n`);
        
        console.log('📋 Próximos passos:');
        console.log('   1. Compacte a pasta "out/" (zip ou tar.gz)');
        console.log('   2. Faça upload para seu servidor Plesk');
        console.log('   3. Extraia no diretório público (public_html/)');
        console.log('   4. Verifique se está funcionando corretamente\n');
        
        console.log('🆘 Suporte: AchillesOS - Sistema de Presença IPDA');

    } catch (error) {
        console.error('❌ Erro durante o build:', error.message);
        process.exitCode = 1;
    } finally {
        if (apiRoutesHandled || fs.existsSync(apiBackupDir)) {
            restoreApiRoutesAfterBuild();
        }
    }
}

// Executar se chamado diretamente
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
    main();
}

export { generateBuildReport, main, optimizeFiles };
