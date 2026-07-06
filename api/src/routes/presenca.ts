import { Response, Router } from 'express';
import { query } from '../config/database';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/presenca/marcar
router.post('/marcar', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { membro_id, status, data_presenca, hora_presenca, justificativa } = req.body;

    if (!membro_id || !status) {
      return res.status(400).json({
        success: false,
        message: 'membro_id e status são obrigatórios',
      });
    }

    const validStatuses = ['Presente', 'Justificado', 'Ausente'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Status inválido. Deve ser um de: ${validStatuses.join(', ')}`,
      });
    }

    // Usar data atual se não fornecida
    const dataPres = data_presenca || new Date().toISOString().split('T')[0];
    const horaPres = hora_presenca || new Date().toTimeString().split(' ')[0];

    // Verificar se membro existe
    const membroCheck = await query('SELECT id FROM membros WHERE id = $1', [membro_id]);

    if (membroCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membro não encontrado',
      });
    }

    // Verificar se já existe presença neste dia
    const existente = await query(
      'SELECT id FROM presencas WHERE membro_id = $1 AND data_presenca = $2',
      [membro_id, dataPres]
    );

    let result;

    if (existente.rows.length > 0) {
      // Atualizar
      result = await query(
        `UPDATE presencas 
         SET status = $1, hora_presenca = $2, justificativa = $3, atualizado_em = NOW()
         WHERE membro_id = $4 AND data_presenca = $5
         RETURNING *`,
        [status, horaPres, justificativa || null, membro_id, dataPres]
      );
    } else {
      // Inserir
      result = await query(
        `INSERT INTO presencas (membro_id, status, data_presenca, hora_presenca, justificativa, registrado_por)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [membro_id, status, dataPres, horaPres, justificativa || null, req.user?.id]
      );
    }

    // Log de auditoria
    await query(
      `INSERT INTO auditoria (usuario_id, acao, tabela, registro_id, dados_novos)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id, existente.rows.length > 0 ? 'UPDATE' : 'CREATE', 'presencas', result.rows[0].id, JSON.stringify(result.rows[0])]
    );

    res.status(201).json({
      success: true,
      message: existente.rows.length > 0 ? 'Presença atualizada com sucesso' : 'Presença registrada com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao marcar presença:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao marcar presença',
      error,
    });
  }
});

// GET /api/presenca/listar
router.get('/listar', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, regiao, pastor_id, status } = req.query;

    let sql = `
      SELECT 
        p.id,
        p.membro_id,
        p.status,
        p.data_presenca,
        p.hora_presenca,
        p.justificativa,
        m.nome_completo,
        m.cpf,
        m.cargo_igreja,
        m.regiao,
        m.turno
      FROM presencas p
      JOIN membros m ON p.membro_id = m.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (data) {
      sql += ` AND p.data_presenca = $${paramIndex}`;
      params.push(data);
      paramIndex++;
    } else {
      sql += ` AND p.data_presenca = CURRENT_DATE`;
    }

    if (regiao) {
      sql += ` AND m.regiao = $${paramIndex}`;
      params.push(regiao);
      paramIndex++;
    }

    if (pastor_id) {
      sql += ` AND m.pastor_id = $${paramIndex}`;
      params.push(pastor_id);
      paramIndex++;
    }

    if (status) {
      sql += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    sql += ` ORDER BY m.nome_completo`;

    const result = await query(sql, params);

    // Calcular totalizadores
    const totalizadores = {
      total: result.rows.length,
      presentes: result.rows.filter(r => r.status === 'Presente').length,
      justificados: result.rows.filter(r => r.status === 'Justificado').length,
      ausentes: result.rows.filter(r => r.status === 'Ausente').length,
    };

    res.status(200).json({
      success: true,
      data: result.rows,
      totalizadores,
    });
  } catch (error) {
    console.error('Erro ao listar presenças:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar presenças',
      error,
    });
  }
});

// GET /api/presenca/estatisticas
router.get('/estatisticas', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data_inicio, data_fim } = req.query;

    const dataInicio = data_inicio || new Date().toISOString().split('T')[0];
    const dataFim = data_fim || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN status = 'Ausente' THEN 1 ELSE 0 END) as ausentes,
        ROUND(100.0 * SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) as taxa_presenca
      FROM presencas
      WHERE data_presenca BETWEEN $1 AND $2`,
      [dataInicio, dataFim]
    );

    const stats = result.rows[0];

    res.status(200).json({
      success: true,
      data: {
        periodo: `${dataInicio} até ${dataFim}`,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas',
      error,
    });
  }
});

// PUT /api/presenca/:id
router.put('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, justificativa } = req.body;

    const result = await query(
      `UPDATE presencas
       SET status = COALESCE($1, status),
           justificativa = COALESCE($2, justificativa),
           atualizado_em = NOW()
       WHERE id = $3
       RETURNING *`,
      [status || null, justificativa || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Presença não encontrada',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Presença atualizada com sucesso',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Erro ao atualizar presença:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar presença',
      error,
    });
  }
});

// DELETE /api/presenca/:id
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM presencas WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Presença não encontrada',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Presença deletada com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar presença:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao deletar presença',
      error,
    });
  }
});

export default router;
