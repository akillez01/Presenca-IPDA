#!/usr/bin/env node
/**
 * Envia a pasta out/ (gerada por `npm run build:plesk:full`) para o servidor
 * Plesk real via rsync+ssh, e confirma que o domínio respondeu depois do envio.
 *
 * Credenciais vêm de credentials.local.json (seção "plesk"), nunca hardcoded
 * aqui — esse arquivo é gitignored. Veja credentials.example.json para o formato.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { loadCredentials, getPleskConfig } = require('../credentials-loader.cjs');

const projectRoot = path.resolve(__dirname, '..');
const outDir = path.join(projectRoot, 'out');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function checkBuildFreshness() {
  const htaccess = path.join(outDir, '.htaccess');
  const report = path.join(outDir, 'build-report.txt');
  const indexHtml = path.join(outDir, 'index.html');

  if (!fs.existsSync(outDir) || !fs.existsSync(indexHtml)) {
    fail('Pasta "out/" não encontrada (ou sem index.html). Rode "npm run build:plesk:full" antes.');
  }
  if (!fs.existsSync(htaccess)) {
    fail('out/.htaccess ausente — build incompleto. Rode "npm run build:plesk:full" novamente.');
  }
  if (!fs.existsSync(report)) {
    console.warn('⚠️  out/build-report.txt ausente — build pode estar incompleto, seguindo mesmo assim.');
  }

  const stat = fs.statSync(indexHtml);
  const ageMinutes = (Date.now() - stat.mtimeMs) / 60000;
  if (ageMinutes > 120) {
    console.warn(
      `⚠️  out/index.html tem ${Math.round(ageMinutes)} min. Se o código mudou depois disso, rode o build de novo antes de subir.`
    );
  }
}

function runRsync(config) {
  const target = `${config.sshUser}@${config.host}:${config.remotePath}`;
  const args = ['-avz', '--delete', `${outDir}/`, target];

  console.log(`🚀 Enviando out/ para ${target} ...`);

  // RSYNC_RSH faz o rsync chamar "sshpass -e ssh ..." como transporte remoto,
  // então a senha vai só via variável de ambiente (SSHPASS), nunca em argv
  // (evita expor a senha em `ps aux` de outros usuários da máquina).
  const result = spawnSync('rsync', args, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      SSHPASS: config.sshPassword,
      RSYNC_RSH: 'sshpass -e ssh -o StrictHostKeyChecking=no',
    },
  });

  if (result.error) {
    fail(`Falha ao executar rsync: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`rsync terminou com código ${result.status}.`);
  }
}

function verifyDomain(config) {
  if (!config.domain) {
    console.log('ℹ️  Nenhum domínio configurado em credentials.local.json (plesk.domain) — pulando verificação HTTP.');
    return;
  }

  const result = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', config.domain], {
    encoding: 'utf8',
  });

  const statusCode = (result.stdout || '').trim();
  if (statusCode === '200') {
    console.log(`✅ ${config.domain} respondeu 200 após o deploy.`);
  } else {
    console.warn(`⚠️  ${config.domain} respondeu "${statusCode || 'sem resposta'}" — verifique manualmente.`);
  }
}

function main() {
  checkBuildFreshness();

  const credentials = loadCredentials();
  const pleskConfig = getPleskConfig(credentials);

  runRsync(pleskConfig);
  verifyDomain(pleskConfig);

  console.log('🎉 Deploy para produção (Plesk) concluído.');
}

main();
