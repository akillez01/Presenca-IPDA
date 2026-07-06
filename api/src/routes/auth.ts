import bcrypt from 'bcryptjs';
import { Response, Router } from 'express';
import { query } from '../config/database';
import { generateRefreshToken, generateToken, verifyRefreshToken } from '../config/jwt';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios',
      });
    }

    const result = await query(
      'SELECT id, email, nome_completo, tipo_usuario, senha_hash FROM usuarios WHERE email = $1 AND ativo = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas',
      });
    }

    const token = generateToken({
      id: usuario.id,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario,
    });

    const refreshToken = generateRefreshToken({
      id: usuario.id,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario,
    });

    res.status(200).json({
      success: true,
      data: {
        token,
        refreshToken,
        usuario: {
          id: usuario.id,
          email: usuario.email,
          nome_completo: usuario.nome_completo,
          tipo_usuario: usuario.tipo_usuario,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login',
      error,
    });
  }
});

// POST /api/auth/register
router.post('/register', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, senha, nome_completo, tipo_usuario } = req.body;

    if (!email || !senha || !nome_completo) {
      return res.status(400).json({
        success: false,
        message: 'Email, senha e nome completo são obrigatórios',
      });
    }

    const checkEmail = await query('SELECT id FROM usuarios WHERE email = $1', [email]);

    if (checkEmail.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email já cadastrado',
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const result = await query(
      `INSERT INTO usuarios (email, senha_hash, nome_completo, tipo_usuario)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, nome_completo, tipo_usuario`,
      [email, senhaHash, nome_completo, tipo_usuario || 'membro']
    );

    const usuario = result.rows[0];

    const token = generateToken({
      id: usuario.id,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        usuario,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar usuário',
      error,
    });
  }
});

// POST /api/auth/refresh-token
router.post('/refresh-token', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token não fornecido',
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const result = await query(
      'SELECT id, email, nome_completo, tipo_usuario FROM usuarios WHERE id = $1 AND ativo = true',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    const usuario = result.rows[0];
    const novoToken = generateToken({
      id: usuario.id,
      email: usuario.email,
      tipo_usuario: usuario.tipo_usuario,
    });

    res.status(200).json({
      success: true,
      data: {
        token: novoToken,
      },
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Refresh token inválido ou expirado',
    });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT id, email, nome_completo, tipo_usuario, criado_em FROM usuarios WHERE id = $1',
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuário não encontrado',
      });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Erro ao obter dados do usuário',
      error,
    });
  }
});

export default router;
