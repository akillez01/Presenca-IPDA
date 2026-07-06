import { Response, Router } from 'express';
import { query } from '../config/database';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/stats/resumo
router.get('/resumo', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.query;
    const dataConsulta = data || new Date().toISOString().split('T')[0];

    // Total de membros ativos
    const totalMembros = await query(
      `SELECT COUNT(*) as total FROM membros WHERE ativo = true`
    );

    // Presenças do dia
    const presencasHoje = await query(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN status = 'Ausente' THEN 1 ELSE 0 END) as ausentes
       FROM presencas
       WHERE data_presenca = $1`,
      [dataConsulta]
    );

    const stats = presencasHoje.rows[0];
    const total_registrado = Number(stats.total) || 0;
    const presentes = Number(stats.presentes) || 0;
    const justificados = Number(stats.justificados) || 0;
    const ausentes = Number(stats.ausentes) || 0;

    const taxa_presenca = total_registrado > 0
      ? ((presentes / total_registrado) * 100).toFixed(2)
      : '0.00';

    const total_ativo = Number(totalMembros.rows[0].total);
    const nao_registrado = total_ativo - total_registrado;

    res.status(200).json({
      success: true,
      data: {
        data: dataConsulta,
        total_membros_ativos: total_ativo,
        presencas: {
          total_registrado,
          presentes,
          justificados,
          ausentes,
          nao_registrado,
        },
        taxa_presenca: `${taxa_presenca}%`,
      },
    });
  } catch (error) {
    console.error('Erro ao obter resumo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter resumo',
      error,
    });
  }
});

// GET /api/stats/por-regiao
router.get('/por-regiao', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.query;
    const dataConsulta = data || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT 
        m.regiao,
        COUNT(DISTINCT m.id) as total_membros,
        SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN p.status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN p.status = 'Ausente' THEN 1 ELSE 0 END) as ausentes,
        COUNT(DISTINCT p.membro_id) as registrados,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.status = 'Presente' THEN p.membro_id END) / 
              NULLIF(COUNT(DISTINCT p.membro_id), 0), 2) as taxa_presenca
       FROM membros m
       LEFT JOIN presencas p ON m.id = p.membro_id AND p.data_presenca = $1
       WHERE m.ativo = true
       GROUP BY m.regiao
       ORDER BY m.regiao`,
      [dataConsulta]
    );

    res.status(200).json({
      success: true,
      data: {
        data: dataConsulta,
        regioes: result.rows,
      },
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas por região:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas por região',
      error,
    });
  }
});

// GET /api/stats/por-pastor
router.get('/por-pastor', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data } = req.query;
    const dataConsulta = data || new Date().toISOString().split('T')[0];

    const result = await query(
      `SELECT 
        m.pastor_id,
        u.nome_completo as pastor_nome,
        COUNT(DISTINCT m.id) as total_membros,
        SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN p.status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN p.status = 'Ausente' THEN 1 ELSE 0 END) as ausentes,
        COUNT(DISTINCT p.membro_id) as registrados,
        ROUND(100.0 * COUNT(DISTINCT CASE WHEN p.status = 'Presente' THEN p.membro_id END) / 
              NULLIF(COUNT(DISTINCT p.membro_id), 0), 2) as taxa_presenca
       FROM membros m
       LEFT JOIN usuarios u ON m.pastor_id = u.id
       LEFT JOIN presencas p ON m.id = p.membro_id AND p.data_presenca = $1
       WHERE m.ativo = true AND m.pastor_id IS NOT NULL
       GROUP BY m.pastor_id, u.nome_completo
       ORDER BY u.nome_completo`,
      [dataConsulta]
    );

    res.status(200).json({
      success: true,
      data: {
        data: dataConsulta,
        pastores: result.rows,
      },
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas por pastor:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter estatísticas por pastor',
      error,
    });
  }
});

// GET /api/stats/historico
router.get('/historico', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data_inicio, data_fim, dias = 30 } = req.query;

    const dataFim = data_fim || new Date().toISOString().split('T')[0];
    const dataInicio = data_inicio || 
      new Date(new Date().getTime() - Number(dias) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const result = await query(
      `SELECT 
        p.data_presenca,
        COUNT(*) as total_registrado,
        SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) as presentes,
        SUM(CASE WHEN p.status = 'Justificado' THEN 1 ELSE 0 END) as justificados,
        SUM(CASE WHEN p.status = 'Ausente' THEN 1 ELSE 0 END) as ausentes,
        ROUND(100.0 * SUM(CASE WHEN p.status = 'Presente' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa_presenca
       FROM presencas p
       WHERE p.data_presenca BETWEEN $1 AND $2
       GROUP BY p.data_presenca
       ORDER BY p.data_presenca DESC`,
      [dataInicio, dataFim]
    );

    // Calcular média
    const media = await query(
      `SELECT 
        AVG(taxa) as media_taxa_presenca,
        MIN(taxa) as menor_taxa,
        MAX(taxa) as maior_taxa
       FROM (
        SELECT 
          ROUND(100.0 * SUM(CASE WHEN status = 'Presente' THEN 1 ELSE 0 END) / COUNT(*), 2) as taxa
         FROM presencas
         WHERE data_presenca BETWEEN $1 AND $2
         GROUP BY data_presenca
       ) stats`,
      [dataInicio, dataFim]
    );

    res.status(200).json({
      success: true,
      data: {
        periodo: `${dataInicio} até ${dataFim}`,
        historico: result.rows,
        resumo: media.rows[0],
      },
    });
  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter histórico',
      error,
    });
  }
});

// GET /api/stats/membros-sem-presenca
router.get('/membros-sem-presenca', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { data, regiao } = req.query;
    const dataConsulta = data || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT 
        m.id,
        m.nome_completo,
        m.email,
        m.telefone,
        m.cargo_igreja,
        m.regiao,
        m.pastor_id
      FROM membros m
      WHERE m.ativo = true
      AND NOT EXISTS (
        SELECT 1 FROM presencas p 
        WHERE p.membro_id = m.id 
        AND p.data_presenca = $1
      )
    `;

    const params: any[] = [dataConsulta];

    if (regiao) {
      sql += ` AND m.regiao = $2`;
      params.push(regiao);
    }

    sql += ` ORDER BY m.nome_completo`;

    const result = await query(sql, params);

    res.status(200).json({
      success: true,
      data: {
        data: dataConsulta,
        total_sem_presenca: result.rows.length,
        membros: result.rows,
      },
    });
  } catch (error) {
    console.error('Erro ao obter membros sem presença:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao obter membros sem presença',
      error,
    });
  }
});

export default router;
