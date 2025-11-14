/**
 * Sistema de Rate Limiting e Throttling
 * Previne sobrecarga do Firebase e controla operações em massa
 */

// Configurações de rate limiting
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number; // Janela de tempo em ms (ex: 60000 = 1 minuto)
  maxRequests: number; // Máximo de requests por janela
  maxConcurrent: number; // Máximo de requests simultâneos
  blockDuration: number; // Tempo de bloqueio em ms após exceder limite
  whitelist: string[]; // IPs ou usuários na whitelist
  skipSuccessful: boolean; // Pular requests bem-sucedidos do contador
}

// Métricas de uso
export interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  currentWindow: {
    requests: number;
    startTime: number;
  };
  activeConnections: number;
  averageResponseTime: number;
}

// Resultado da verificação de rate limit
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

// Operação em fila
interface QueuedOperation {
  id: string;
  operation: () => Promise<any>;
  priority: number;
  timestamp: number;
  timeout: number;
}

class RateLimitSystem {
  private config: RateLimitConfig;
  private requestHistory: Map<string, number[]> = new Map();
  private activeRequests: Map<string, number> = new Map();
  private blockedUntil: Map<string, number> = new Map();
  private operationQueue: QueuedOperation[] = [];
  private metrics: RateLimitMetrics;
  private isProcessingQueue = false;

  constructor() {
    this.config = {
      enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minuto
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
      maxConcurrent: parseInt(process.env.RATE_LIMIT_MAX_CONCURRENT || '10'),
      blockDuration: parseInt(process.env.RATE_LIMIT_BLOCK_DURATION || '300000'), // 5 minutos
      whitelist: (process.env.RATE_LIMIT_WHITELIST || '').split(',').filter(Boolean),
      skipSuccessful: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true'
    };

    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      currentWindow: {
        requests: 0,
        startTime: Date.now()
      },
      activeConnections: 0,
      averageResponseTime: 0
    };

    // Iniciar processamento da fila
    this.startQueueProcessor();
    
    // Limpeza periódica
    setInterval(() => this.cleanup(), this.config.windowMs);
  }

  /**
   * Verifica se uma operação pode ser executada
   */
  checkRateLimit(identifier: string, isWhitelisted = false): RateLimitResult {
    const now = Date.now();

    // Verificar se está desabilitado
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    // Verificar whitelist
    if (isWhitelisted || this.config.whitelist.includes(identifier)) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs
      };
    }

    // Verificar se está bloqueado
    const blockedUntil = this.blockedUntil.get(identifier) || 0;
    if (now < blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockedUntil,
        retryAfter: blockedUntil - now,
        reason: 'Temporarily blocked due to rate limit exceeded'
      };
    }

    // Verificar limite de requests simultâneos
    const concurrent = this.activeRequests.get(identifier) || 0;
    if (concurrent >= this.config.maxConcurrent) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + this.config.windowMs,
        reason: 'Too many concurrent requests'
      };
    }

    // Verificar histórico de requests
    const history = this.getRequestHistory(identifier);
    const windowStart = now - this.config.windowMs;
    const recentRequests = history.filter(timestamp => timestamp > windowStart);

    if (recentRequests.length >= this.config.maxRequests) {
      // Excedeu limite - bloquear temporariamente
      this.blockedUntil.set(identifier, now + this.config.blockDuration);
      this.metrics.blockedRequests++;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + this.config.blockDuration,
        retryAfter: this.config.blockDuration,
        reason: 'Rate limit exceeded'
      };
    }

    // Permitir request
    return {
      allowed: true,
      remaining: this.config.maxRequests - recentRequests.length - 1,
      resetTime: Math.min(...recentRequests) + this.config.windowMs
    };
  }

  /**
   * Registra início de uma operação
   */
  startOperation(identifier: string): void {
    const now = Date.now();
    
    // Registrar request
    this.addToHistory(identifier, now);
    
    // Incrementar requests ativos
    const current = this.activeRequests.get(identifier) || 0;
    this.activeRequests.set(identifier, current + 1);
    
    // Atualizar métricas
    this.metrics.totalRequests++;
    this.metrics.activeConnections++;
    this.updateCurrentWindow(now);
  }

  /**
   * Registra fim de uma operação
   */
  endOperation(identifier: string, success = true, responseTime?: number): void {
    // Decrementar requests ativos
    const current = this.activeRequests.get(identifier) || 0;
    if (current > 0) {
      this.activeRequests.set(identifier, current - 1);
      this.metrics.activeConnections--;
    }

    // Atualizar tempo de resposta médio
    if (responseTime) {
      const currentAvg = this.metrics.averageResponseTime;
      this.metrics.averageResponseTime = 
        (currentAvg + responseTime) / 2;
    }

    // Remover da história se bem-sucedido e configurado
    if (success && this.config.skipSuccessful) {
      this.removeFromHistory(identifier);
    }
  }

  /**
   * Adiciona operação à fila com throttling
   */
  async queueOperation<T>(
    identifier: string,
    operation: () => Promise<T>,
    options: {
      priority?: number;
      timeout?: number;
      skipRateLimit?: boolean;
    } = {}
  ): Promise<T> {
    const {
      priority = 5,
      timeout = 30000,
      skipRateLimit = false
    } = options;

    // Verificar rate limit se não for para pular
    if (!skipRateLimit) {
      const rateLimitCheck = this.checkRateLimit(identifier);
      if (!rateLimitCheck.allowed) {
        throw new Error(`Rate limit exceeded: ${rateLimitCheck.reason}`);
      }
    }

    return new Promise((resolve, reject) => {
      const queuedOperation: QueuedOperation = {
        id: this.generateOperationId(),
        operation: async () => {
          const startTime = Date.now();
          this.startOperation(identifier);
          
          try {
            const result = await operation();
            this.endOperation(identifier, true, Date.now() - startTime);
            resolve(result);
            return result;
          } catch (error) {
            this.endOperation(identifier, false, Date.now() - startTime);
            reject(error);
            throw error;
          }
        },
        priority,
        timestamp: Date.now(),
        timeout
      };

      this.operationQueue.push(queuedOperation);
      this.sortQueue();

      // Timeout da operação
      setTimeout(() => {
        const index = this.operationQueue.findIndex(op => op.id === queuedOperation.id);
        if (index > -1) {
          this.operationQueue.splice(index, 1);
          reject(new Error('Operation timeout'));
        }
      }, timeout);
    });
  }

  /**
   * Executa operação em lote com throttling
   */
  async batchOperation<T>(
    identifier: string,
    operations: (() => Promise<T>)[],
    options: {
      batchSize?: number;
      delayBetweenBatches?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<Array<T | Error>> {
    const {
      batchSize = 5,
      delayBetweenBatches = 1000,
      continueOnError = false
    } = options;

    const results: Array<T | Error> = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);
      
      // Executar lote
      const batchPromises = batch.map(async (operation, index) => {
        try {
          return await this.queueOperation(
            `${identifier}-batch-${i + index}`,
            operation,
            { priority: 3 }
          );
        } catch (error) {
          if (!continueOnError) {
            throw error;
          }
          return error instanceof Error ? error : new Error('Unknown error');
        }
      });

      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        results.push(error instanceof Error ? error : new Error('Batch failed'));
      }

      // Delay entre lotes (exceto no último)
      if (i + batchSize < operations.length) {
        await this.delay(delayBetweenBatches);
      }
    }

    return results;
  }

  /**
   * Obtém métricas atuais
   */
  getMetrics(): RateLimitMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtém configuração atual
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Limpa histórico de um identificador específico
   */
  clearHistory(identifier: string): void {
    this.requestHistory.delete(identifier);
    this.activeRequests.delete(identifier);
    this.blockedUntil.delete(identifier);
  }

  /**
   * Obtém status detalhado de um identificador
   */
  getStatus(identifier: string): {
    requests: number;
    activeRequests: number;
    isBlocked: boolean;
    blockedUntil?: number;
    remaining: number;
  } {
    const now = Date.now();
    const history = this.getRequestHistory(identifier);
    const windowStart = now - this.config.windowMs;
    const recentRequests = history.filter(timestamp => timestamp > windowStart);
    
    return {
      requests: recentRequests.length,
      activeRequests: this.activeRequests.get(identifier) || 0,
      isBlocked: now < (this.blockedUntil.get(identifier) || 0),
      blockedUntil: this.blockedUntil.get(identifier),
      remaining: Math.max(0, this.config.maxRequests - recentRequests.length)
    };
  }

  // Métodos privados

  private getRequestHistory(identifier: string): number[] {
    return this.requestHistory.get(identifier) || [];
  }

  private addToHistory(identifier: string, timestamp: number): void {
    const history = this.getRequestHistory(identifier);
    history.push(timestamp);
    this.requestHistory.set(identifier, history);
  }

  private removeFromHistory(identifier: string): void {
    const history = this.getRequestHistory(identifier);
    if (history.length > 0) {
      history.pop();
      this.requestHistory.set(identifier, history);
    }
  }

  private updateCurrentWindow(now: number): void {
    // Reset window se necessário
    if (now - this.metrics.currentWindow.startTime > this.config.windowMs) {
      this.metrics.currentWindow = {
        requests: 1,
        startTime: now
      };
    } else {
      this.metrics.currentWindow.requests++;
    }
  }

  private sortQueue(): void {
    this.operationQueue.sort((a, b) => {
      // Maior prioridade primeiro, depois mais antigo
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.timestamp - b.timestamp;
    });
  }

  private async startQueueProcessor(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    while (true) {
      if (this.operationQueue.length === 0) {
        await this.delay(100);
        continue;
      }

      // Verificar limite de operações simultâneas
      if (this.metrics.activeConnections >= this.config.maxConcurrent) {
        await this.delay(100);
        continue;
      }

      const operation = this.operationQueue.shift();
      if (!operation) continue;

      // Verificar se não expirou
      if (Date.now() - operation.timestamp > operation.timeout) {
        continue;
      }

      // Executar operação (não aguardar)
      operation.operation().catch(() => {
        // Erro já foi tratado na operação
      });

      // Pequeno delay para evitar sobrecarga
      await this.delay(10);
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Limpar histórico antigo
    for (const [identifier, history] of this.requestHistory.entries()) {
      const recentHistory = history.filter(timestamp => timestamp > windowStart);
      if (recentHistory.length === 0) {
        this.requestHistory.delete(identifier);
      } else {
        this.requestHistory.set(identifier, recentHistory);
      }
    }

    // Limpar bloqueios expirados
    for (const [identifier, blockedUntil] of this.blockedUntil.entries()) {
      if (now >= blockedUntil) {
        this.blockedUntil.delete(identifier);
      }
    }

    // Limpar operações ativas órfãs
    for (const [identifier, count] of this.activeRequests.entries()) {
      if (count === 0) {
        this.activeRequests.delete(identifier);
      }
    }
  }
}

// Instância singleton do sistema de rate limiting
export const rateLimitSystem = new RateLimitSystem();

// Funções utilitárias

/**
 * Decorator para aplicar rate limiting em funções
 */
export function withRateLimit(identifier: string, options?: { priority?: number }) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return rateLimitSystem.queueOperation(
        identifier,
        () => originalMethod.apply(this, args),
        options
      );
    };

    return descriptor;
  };
}

/**
 * Middleware para Express.js (se usado)
 */
export function createRateLimitMiddleware() {
  return (req: any, res: any, next: any) => {
    const identifier = req.ip || req.connection.remoteAddress || 'anonymous';
    const rateLimitResult = rateLimitSystem.checkRateLimit(identifier);

    // Adicionar headers de rate limit
    res.set({
      'X-RateLimit-Limit': rateLimitSystem.getConfig().maxRequests.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': new Date(rateLimitResult.resetTime).toISOString()
    });

    if (!rateLimitResult.allowed) {
      if (rateLimitResult.retryAfter) {
        res.set('Retry-After', Math.ceil(rateLimitResult.retryAfter / 1000).toString());
      }
      
      return res.status(429).json({
        error: 'Too Many Requests',
        message: rateLimitResult.reason,
        retryAfter: rateLimitResult.retryAfter
      });
    }

    // Registrar início da operação
    rateLimitSystem.startOperation(identifier);

    // Hook para registrar fim da operação
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      rateLimitSystem.endOperation(identifier, res.statusCode < 400);
      originalEnd.apply(this, args);
    };

    next();
  };
}