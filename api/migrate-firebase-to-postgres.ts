#!/usr/bin/env node

/**
 * Script de Migração: Firebase Firestore → PostgreSQL
 * 
 * Copia dados de Firebase Firestore para o novo banco PostgreSQL
 * 
 * Uso:
 *   npx ts-node migrate-firebase-to-postgres.ts
 */

import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

// Carrega variáveis de ambiente
dotenv.config({ path: path.resolve(__dirname, '.env') });

interface FirebaseUser {
  id?: string;
  nome_completo: string;
  email: string;
  senha_hash?: string;
  papel?: string;
  data_criacao?: any;
}

interface FirebaseMembro {
  id?: string;
  nome_completo: string;
  email: string;
  cpf: string;
  telefone: string;
  data_nascimento: string;
  genero: string;
  endereco: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  cargo_igreja: string;
  regiao: string;
  turno: string;
  pastor_id?: string;
  ativo?: boolean;
  data_cadastro?: any;
}

interface FirebasePresenca {
  id?: string;
  membro_id: string;
  data_presenca: string;
  status: 'Presente' | 'Justificado' | 'Ausente';
  hora_presenca?: string;
  justificativa?: string;
}

class MigrationService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true',
    });
  }

  /**
   * Carrega dados do arquivo JSON de backup do Firebase
   */
  private loadFirebaseData(filePath: string): any {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Erro ao carregar arquivo ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Migra usuários do Firebase para PostgreSQL
   */
  async migrateUsers(firebaseUsers: FirebaseUser[]) {
    console.log(`\n📝 Migrando ${firebaseUsers.length} usuários...`);

    let migrados = 0;
    let erros = 0;

    for (const user of firebaseUsers) {
      try {
        await this.pool.query(
          `INSERT INTO usuarios (id, nome_completo, email, senha_hash, papel, data_criacao)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
           nome_completo = EXCLUDED.nome_completo,
           email = EXCLUDED.email,
           papel = EXCLUDED.papel`,
          [
            user.id || this.generateUUID(),
            user.nome_completo,
            user.email,
            user.senha_hash || '',
            user.papel || 'membro',
            user.data_criacao ? new Date(user.data_criacao) : new Date(),
          ]
        );
        migrados++;
      } catch (error) {
        console.error(`Erro ao migrar usuário ${user.email}:`, error);
        erros++;
      }
    }

    console.log(`✅ Usuários migrados: ${migrados}/${firebaseUsers.length} (Erros: ${erros})`);
    return { migrados, erros };
  }

  /**
   * Migra membros do Firebase para PostgreSQL
   */
  async migrateMembros(firebaseMembros: FirebaseMembro[]) {
    console.log(`\n📝 Migrando ${firebaseMembros.length} membros...`);

    let migrados = 0;
    let erros = 0;

    for (const membro of firebaseMembros) {
      try {
        await this.pool.query(
          `INSERT INTO membros (
            id, nome_completo, email, cpf, telefone, data_nascimento, genero,
            endereco, numero, complemento, bairro, cidade, estado, cep,
            cargo_igreja, regiao, turno, pastor_id, ativo, data_cadastro
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           ON CONFLICT (id) DO UPDATE SET
           nome_completo = EXCLUDED.nome_completo,
           email = EXCLUDED.email,
           telefone = EXCLUDED.telefone,
           cargo_igreja = EXCLUDED.cargo_igreja,
           regiao = EXCLUDED.regiao`,
          [
            membro.id || this.generateUUID(),
            membro.nome_completo,
            membro.email || '',
            membro.cpf || '',
            membro.telefone || '',
            membro.data_nascimento ? new Date(membro.data_nascimento) : null,
            membro.genero || 'N',
            membro.endereco || '',
            membro.numero || '',
            membro.complemento || null,
            membro.bairro || '',
            membro.cidade || '',
            membro.estado || '',
            membro.cep || '',
            membro.cargo_igreja || '',
            membro.regiao || '',
            membro.turno || '',
            membro.pastor_id || null,
            membro.ativo !== false,
            membro.data_cadastro ? new Date(membro.data_cadastro) : new Date(),
          ]
        );
        migrados++;
      } catch (error) {
        console.error(`Erro ao migrar membro ${membro.nome_completo}:`, error);
        erros++;
      }
    }

    console.log(`✅ Membros migrados: ${migrados}/${firebaseMembros.length} (Erros: ${erros})`);
    return { migrados, erros };
  }

  /**
   * Migra presenças do Firebase para PostgreSQL
   */
  async migratePresencas(firebasePresencas: FirebasePresenca[]) {
    console.log(`\n📝 Migrando ${firebasePresencas.length} presenças...`);

    let migrados = 0;
    let erros = 0;

    for (const presenca of firebasePresencas) {
      try {
        await this.pool.query(
          `INSERT INTO presencas (
            id, membro_id, status, data_presenca, hora_presenca, justificativa
          ) VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           justificativa = EXCLUDED.justificativa`,
          [
            presenca.id || this.generateUUID(),
            presenca.membro_id,
            presenca.status || 'Ausente',
            new Date(presenca.data_presenca),
            presenca.hora_presenca || '00:00:00',
            presenca.justificativa || null,
          ]
        );
        migrados++;
      } catch (error) {
        console.error(`Erro ao migrar presença de ${presenca.membro_id}:`, error);
        erros++;
      }
    }

    console.log(`✅ Presenças migradas: ${migrados}/${firebasePresencas.length} (Erros: ${erros})`);
    return { migrados, erros };
  }

  /**
   * Gera UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Verifica conexão com banco
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.pool.query('SELECT NOW()');
      console.log('✅ Conexão com banco de dados estabelecida');
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar ao banco:', error);
      return false;
    }
  }

  /**
   * Fecha conexão com banco
   */
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * Executa migração
 */
async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Migração: Firebase → PostgreSQL              ║');
  console.log('╚════════════════════════════════════════════════╝');

  const service = new MigrationService();

  try {
    // Verifica conexão
    const connected = await service.checkConnection();
    if (!connected) {
      process.exit(1);
    }

    // Define caminho dos arquivos de backup do Firebase
    const backupDir = path.resolve(__dirname, '.');
    
    // Procura por arquivos de backup
    const firebaseFiles = fs.readdirSync(backupDir).filter(f => 
      f.startsWith('backup-') && f.endsWith('.json')
    );

    if (firebaseFiles.length === 0) {
      console.warn('⚠️  Nenhum arquivo de backup encontrado');
      console.log('Esperados: backup-*.json');
      process.exit(1);
    }

    console.log(`\n📁 Arquivos encontrados: ${firebaseFiles.join(', ')}`);

    // Migra cada arquivo
    for (const file of firebaseFiles) {
      const filePath = path.join(backupDir, file);
      const data = service.loadFirebaseData(filePath);

      console.log(`\n📂 Processando arquivo: ${file}`);

      // Determina tipo de dados pelo nome do arquivo
      if (file.includes('users') || file.includes('usuarios')) {
        await service.migrateUsers(data.usuarios || []);
      } else if (file.includes('attendance') || file.includes('presenca')) {
        await service.migratePresencas(data.presencas || []);
      } else if (file.includes('attendance')) {
        // Pode conter membros e presenças
        if (data.membros) {
          await service.migrateMembros(data.membros);
        }
        if (data.presencas) {
          await service.migratePresencas(data.presencas);
        }
      }
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📊 Próximos passos:');
    console.log('  1. Verifique os dados no banco: SELECT COUNT(*) FROM membros;');
    console.log('  2. Teste a API: curl http://localhost:3001/api/stats/resumo');
    console.log('  3. Inicie o Next.js: npm run dev');

  } catch (error) {
    console.error('❌ Erro durante migração:', error);
    process.exit(1);
  } finally {
    await service.close();
  }
}

// Executa se for chamado diretamente
if (require.main === module) {
  main();
}

export { MigrationService };
