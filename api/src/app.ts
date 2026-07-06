import cors from 'cors';
import express, { Express, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import membrosRoutes from './routes/membros';
import presencaRoutes from './routes/presenca';
import statsRoutes from './routes/stats';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Configuração CORS
const corsOptions = {
  origin: [
    'https://ipda.app.br',
    'https://www.ipda.app.br',
    'https://seivadigital.com.br',
    'https://www.seivadigital.com.br',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware de segurança
app.use(helmet());
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por janela
  message: 'Muitas requisições deste IP, tente novamente mais tarde.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // limite de 5 tentativas por janela
  message: 'Muitas tentativas de autenticação, tente novamente mais tarde.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware de logs
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} - Status: ${res.statusCode} - ${duration}ms`
    );
  });
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'API está funcionando normalmente',
    timestamp: new Date().toISOString(),
  });
});

// API version
app.get('/api/version', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Rotas da API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/presenca', presencaRoutes);
app.use('/api/membros', membrosRoutes);
app.use('/api/stats', statsRoutes);

// Rota não encontrada
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Rota não encontrada',
    path: req.path,
  });
});

// Middleware de tratamento de erros
app.use(errorHandler);

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║     IPDA Attendance API - v1.0.0              ║
╠════════════════════════════════════════════════╣
║  Servidor rodando em: http://localhost:${PORT}
║  Ambiente: ${process.env.NODE_ENV || 'development'}
║  Banco de dados: ${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT}/${process.env.DATABASE_NAME}
║  CORS: ${corsOptions.origin.join(', ')}
╚════════════════════════════════════════════════╝
  `);
});

// Tratamento de sinais de encerramento
process.on('SIGTERM', () => {
  console.log('SIGTERM recebido. Encerrando servidor...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT recebido. Encerrando servidor...');
  server.close(() => {
    console.log('Servidor encerrado');
    process.exit(0);
  });
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  console.error('Erro não capturado:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejeitada não tratada:', promise, 'Razão:', reason);
  process.exit(1);
});

export default app;
