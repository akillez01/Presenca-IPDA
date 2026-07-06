/**
 * Cliente HTTP para API de Presença (IPDA)
 * Integração com Next.js App Router
 */

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: any;
}

interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    nome_completo: string;
    email: string;
    papel: string;
  };
}

interface Presenca {
  id: string;
  membro_id: string;
  status: 'Presente' | 'Justificado' | 'Ausente';
  data_presenca: string;
  hora_presenca: string;
  justificativa?: string;
}

interface Membro {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string;
  telefone: string;
  cargo_igreja: string;
  regiao: string;
  turno: string;
  ativo: boolean;
}

interface User {
  id: string;
  nome_completo: string;
  email: string;
  papel: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.loadTokens();
  }

  /**
   * Carrega tokens do localStorage (apenas no browser)
   */
  private loadTokens() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
      this.refreshToken = localStorage.getItem('refreshToken');
    }
  }

  /**
   * Salva tokens no localStorage
   */
  private saveTokens(token: string, refreshToken: string) {
    if (typeof window !== 'undefined') {
      this.token = token;
      this.refreshToken = refreshToken;
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  /**
   * Limpa tokens
   */
  private clearTokens() {
    this.token = null;
    this.refreshToken = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    }
  }

  /**
   * Realiza requisição HTTP
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const optionHeaders = new Headers(options.headers);
    optionHeaders.forEach((value, key) => {
      headers[key] = value;
    });

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        // Se token expirou, tenta renovar
        if (response.status === 401 && this.refreshToken) {
          await this.refreshAccessToken();
          // Tenta novamente com novo token
          return this.request<T>(endpoint, options);
        }

        return {
          success: false,
          message: data.message || 'Erro na requisição',
          error: data,
        };
      }

      return data;
    } catch (error) {
      console.error('Erro na requisição:', error);
      return {
        success: false,
        message: 'Erro de conexão',
        error,
      };
    }
  }

  /**
   * Renova o token de acesso
   */
  private async refreshAccessToken() {
    if (!this.refreshToken) {
      this.clearTokens();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (data.success && data.data) {
        this.saveTokens(data.data.token, data.data.refreshToken);
      } else {
        this.clearTokens();
      }
    } catch (error) {
      console.error('Erro ao renovar token:', error);
      this.clearTokens();
    }
  }

  // ==================== AUTENTICAÇÃO ====================

  async login(email: string, senha: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });

    if (response.success && response.data) {
      this.saveTokens(response.data.token, response.data.refreshToken);
    }

    return response;
  }

  async register(
    nome_completo: string,
    email: string,
    senha: string,
    papel: string
  ): Promise<ApiResponse<User>> {
    return this.request<User>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ nome_completo, email, senha, papel }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/api/auth/me');
  }

  async logout() {
    this.clearTokens();
  }

  // ==================== PRESENÇA ====================

  async marcarPresenca(
    membro_id: string,
    status: 'Presente' | 'Justificado' | 'Ausente',
    justificativa?: string
  ): Promise<ApiResponse<Presenca>> {
    return this.request<Presenca>('/api/presenca/marcar', {
      method: 'POST',
      body: JSON.stringify({
        membro_id,
        status,
        justificativa,
      }),
    });
  }

  async listarPresencas(filters?: {
    data?: string;
    regiao?: string;
    pastor_id?: string;
    status?: string;
  }): Promise<ApiResponse<Presenca[]>> {
    const params = new URLSearchParams();
    if (filters?.data) params.append('data', filters.data);
    if (filters?.regiao) params.append('regiao', filters.regiao);
    if (filters?.pastor_id) params.append('pastor_id', filters.pastor_id);
    if (filters?.status) params.append('status', filters.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Presenca[]>(`/api/presenca/listar${query}`);
  }

  async getEstatisticasPresenca(data_inicio?: string, data_fim?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (data_inicio) params.append('data_inicio', data_inicio);
    if (data_fim) params.append('data_fim', data_fim);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/api/presenca/estatisticas${query}`);
  }

  async atualizarPresenca(
    id: string,
    status?: string,
    justificativa?: string
  ): Promise<ApiResponse<Presenca>> {
    return this.request<Presenca>(`/api/presenca/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status, justificativa }),
    });
  }

  async deletarPresenca(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/presenca/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== MEMBROS ====================

  async listarMembros(filters?: {
    pagina?: number;
    limite?: number;
    regiao?: string;
    cargo_igreja?: string;
    status?: string;
  }): Promise<ApiResponse<{ data: Membro[]; paginacao: any }>> {
    const params = new URLSearchParams();
    if (filters?.pagina) params.append('pagina', filters.pagina.toString());
    if (filters?.limite) params.append('limite', filters.limite.toString());
    if (filters?.regiao) params.append('regiao', filters.regiao);
    if (filters?.cargo_igreja) params.append('cargo_igreja', filters.cargo_igreja);
    if (filters?.status) params.append('status', filters.status);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<{ data: Membro[]; paginacao: any }>(`/api/membros${query}`);
  }

  async criarMembro(membro: Partial<Membro>): Promise<ApiResponse<Membro>> {
    return this.request<Membro>('/api/membros', {
      method: 'POST',
      body: JSON.stringify(membro),
    });
  }

  async obterMembro(id: string): Promise<ApiResponse<Membro & { presencas_recentes: any; estatisticas_mes: any }>> {
    return this.request<Membro & { presencas_recentes: any; estatisticas_mes: any }>(`/api/membros/${id}`);
  }

  async atualizarMembro(id: string, dados: Partial<Membro>): Promise<ApiResponse<Membro>> {
    return this.request<Membro>(`/api/membros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(dados),
    });
  }

  async deletarMembro(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/api/membros/${id}`, {
      method: 'DELETE',
    });
  }

  // ==================== ESTATÍSTICAS ====================

  async getResumoDia(data?: string): Promise<ApiResponse<any>> {
    const query = data ? `?data=${data}` : '';
    return this.request<any>(`/api/stats/resumo${query}`);
  }

  async getEstatisticasPorRegiao(data?: string): Promise<ApiResponse<any>> {
    const query = data ? `?data=${data}` : '';
    return this.request<any>(`/api/stats/por-regiao${query}`);
  }

  async getEstatisticasPorPastor(data?: string): Promise<ApiResponse<any>> {
    const query = data ? `?data=${data}` : '';
    return this.request<any>(`/api/stats/por-pastor${query}`);
  }

  async getHistoricoPresenca(data_inicio?: string, data_fim?: string, dias?: number): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (data_inicio) params.append('data_inicio', data_inicio);
    if (data_fim) params.append('data_fim', data_fim);
    if (dias) params.append('dias', dias.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/api/stats/historico${query}`);
  }

  async getMembrosSemPresenca(data?: string, regiao?: string): Promise<ApiResponse<any>> {
    const params = new URLSearchParams();
    if (data) params.append('data', data);
    if (regiao) params.append('regiao', regiao);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/api/stats/membros-sem-presenca${query}`);
  }

  // ==================== UTILITÁRIOS ====================

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getToken(): string | null {
    return this.token;
  }
}

// Exportar instância única
export const apiClient = new ApiClient();

// Exportar tipos
export type { ApiResponse, LoginResponse, Membro, Presenca, User };
