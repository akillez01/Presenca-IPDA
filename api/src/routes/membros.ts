import { Response, Router } from 'express';
import { query } from '../config/database';
import { adminMiddleware, AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/membros
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pagina = 1, limite = 20, regiao, cargo_igreja, status } = req.query;

    const offset = (Number(pagina) - 1) * Number(limite);

    let sql = `
      SELECT 
        id,
        nome_completo,
        email,
        cpf,
        telefone,
        data_nascimento,
        genero,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        cep,
        cargo_igreja,
        regiao,
        turno,
        pastor_id,
        data_cadastro,
        ativo
      FROM membros
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status !== undefined) {
      sql += ` AND ativo = $${paramIndex}`;
      params.push(status === 'ativo');
      paramIndex++;
    } else {
      sql += ` AND ativo = true`;
    }

    if (regiao) {
      sql += ` AND regiao = $${paramIndex}`;
      params.push(regiao);
      paramIndex++;
    }

    if (cargo_igreja) {
      sql += ` AND cargo_igreja = $${paramIndex}`;
      params.push(cargo_igreja);
      paramIndex++;
    }

    sql += ` ORDER BY nome_completo`;
    sql += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(Number(limite), offset);

    const result = await query(sql, params);

    // Contar total de membros
    let countSql = 'SELECT COUNT(*) as total FROM membros WHERE 1=1';
    const countParams: any[] = [];
    let countIndex = 1;

    if (status !== undefined) {
      countSql += ` AND ativo = $${countIndex}`;
      countParams.push(status === 'ativo');
      countIndex++;
    } else {
      countSql += ` AND ativo = true`;
    }

    if (regiao) {
      countSql += ` AND regiao = $${countIndex}`;
      countParams.push(regiao);
      countIndex++;
    }

    if (cargo_igreja) {
      countSql += ` AND cargo_igreja = $${countIndex}`;
      countParams.push(cargo_igreja);
      countIndex++;
    }

    const countResult = await query(countSql, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.status(200).json({
      success: true,
      data: result.rows,
      paginacao: {
        total,
        pagina: Number(pagina),
        limite: Number(limite),
        total_paginas: Math.ceil(total / Number(limite)),
      },
    });
  } catch (error) {
    console.error('Erro ao listar membros:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar membros',
      error,
    });
  }
});

// POST /api/membros
router.post('/', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      nome_completo,
      email,
      cpf,
      telefone,
      data_nascimento,
      genero,
      endereco,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      cargo_igreja,
      regiao,
      turno,
      pastor_id,
    } = req.body;

    if (!nome_completo || !email || !cpf) {
      return res.status(400).json({
        success: false,
        message: 'nome_completo, email e cpf são obrigatórios',
      });
    }

    // Verificar duplicatas
    const existing = await query(
      'SELECT id FROM membros WHERE email = $1 OR cpf = $2',
      [email, cpf]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email ou CPF já cadastrado',
      });
    }

    const result = await query(
      `INSERT INTO membros (
        nome_completo, email, cpf, telefone, data_nascimento, genero,
        endereco, numero, complemento, bairro, cidade, estado, cep,
        cargo_igreja, regiao, turno, pastor_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        nome_completo, email, cpf, telefone, data_nascimento, genero,
        endereco, numero, complemento, bairro, cidade, estado, cep,
        cargo_igreja || null, regiao || null, turno || null, pastor_id || null
      ]
    );

    // Log de auditoria
    await query(
      `INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, dados_novos)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id, 'CREATE', 'membros', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      message: 'Membro criado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar membro',
      error,
    });
  }
});

// GET /api/membros/:id
router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const membro = await query(
      `SELECT * FROM membros WHERE id = $1`,
      [id]
    );

    if (membro.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membro não encontrado',
      });
    }

    // Obter presenças recentes (últimos 30 dias)
    const presencas = await query(
      `SELECT * FROM presencas 
       WHERE membro_id = $1 
       AND data_presenca >= CURRENT_DATE - INTERVAL '30 days'
       ORDER BY data_presenca DESC`,
      [id]
    );

    // Calcular estatísticas
    const stats = await query(
      `SELECT
        COUNT(*) as total_registros,
        SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN status = 'Ausente' THEN 1 ELSE 0 END) as ausentes
       FROM presencas
       WHERE membro_id = $1
       AND data_presenca >= CURRENT_DATE - INTERVAL '30 days'`,
      [id]
    );

    res.status(200).json({
      success: true,
      data: {
        ...membro.rows[0],
        presencas_recentes: presencas.rows,
        estatisticas_mes: stats.rows[0],
      },
    });
  } catch (error) {
    console.error('Erro ao obter membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter membro',
      error,
    });
  }
});

// PUT /api/membros/:id
router.put('/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Campos permitidos para atualização
    const allowedFields = [
      'nome_completo', 'email', 'cpf', 'telefone', 'data_nascimento', 'genero',
      'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
      'cargo_igreja', 'regiao', 'turno', 'pastor_id', 'ativo'
    ];

    const updateFields = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');

    if (!updateFields) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum campo válido para atualizar',
      });
    }

    const updateValues = Object.keys(updates)
      .filter(key => allowedFields.includes(key))
      .map(key => updates[key]);

    updateValues.push(id);

    const result = await query(
      `UPDATE membros
       SET ${updateFields}, atualizado_em = NOW()
       WHERE id = $${updateValues.length}
       RETURNING *`,
      updateValues
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membro não encontrado',
      });
    }

    // Log de auditoria
    await query(
      `INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, dados_novos)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id, 'UPDATE', 'membros', id, JSON.stringify(result.rows[0])]
    );

    res.status(200).json({
      success: true,
      message: 'Membro atualizado com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar membro',
      error,
    });
  }
});

// DELETE /api/membros/:id (soft delete)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE membros
       SET ativo = false, atualizado_em = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membro não encontrado',
      });
    }

    // Log de auditoria
    await query(
      `INSERT INTO auditoria (usuario_id, acao, tabela, registro_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user?.id, 'DELETE', 'membros', id]
    );

    res.status(200).json({
      success: true,
      message: 'Membro desativado com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar membro:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar membro',
      error,
    });
  }
});

export default router;
