# Integração da API com Next.js

Guia completo para integrar a API REST com o projeto Next.js.

## Configuração Inicial

### 1. Variáveis de Ambiente

Crie ou atualize o arquivo `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001
# Para produção, use:
# NEXT_PUBLIC_API_URL=https://ipda.app.br
```

### 2. Cliente API

O arquivo `lib/api-client.ts` fornece uma classe `ApiClient` com todos os métodos necessários.

Ela automaticamente:

- Gerencia tokens JWT
- Atualiza tokens expirados
- Trata erros de autenticação
- Realiza requisições HTTP com headers corretos

## Exemplos de Uso

### Login

```typescript
import { apiClient } from "@/lib/api-client";

export default function LoginPage() {
  const handleLogin = async (email: string, senha: string) => {
    const response = await apiClient.login(email, senha);

    if (response.success) {
      // Token salvo automaticamente
      router.push("/dashboard");
    } else {
      console.error(response.message);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const email = e.currentTarget.email.value;
        const senha = e.currentTarget.senha.value;
        handleLogin(email, senha);
      }}
    >
      <input name="email" type="email" required />
      <input name="senha" type="password" required />
      <button type="submit">Entrar</button>
    </form>
  );
}
```

### Listar Membros

```typescript
import { useEffect, useState } from "react";
import { apiClient, type Membro } from "@/lib/api-client";

export default function MembrosPage() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarMembros = async () => {
      const response = await apiClient.listarMembros({
        pagina: 1,
        limite: 20,
      });

      if (response.success) {
        setMembros(response.data?.data || []);
      }
      setLoading(false);
    };

    carregarMembros();
  }, []);

  if (loading) return <p>Carregando...</p>;

  return (
    <div>
      <h1>Membros</h1>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Email</th>
            <th>Cargo</th>
            <th>Região</th>
          </tr>
        </thead>
        <tbody>
          {membros.map((membro) => (
            <tr key={membro.id}>
              <td>{membro.nome_completo}</td>
              <td>{membro.email}</td>
              <td>{membro.cargo_igreja}</td>
              <td>{membro.regiao}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Marcar Presença

```typescript
import { apiClient } from "@/lib/api-client";

export default function PresencaForm({ membro_id }: { membro_id: string }) {
  const handleMarcarPresenca = async (status: string) => {
    const response = await apiClient.marcarPresenca(
      membro_id,
      status as "Presente" | "Justificado" | "Ausente",
      undefined
    );

    if (response.success) {
      alert("Presença marcada com sucesso");
    } else {
      alert("Erro ao marcar presença");
    }
  };

  return (
    <div className="flex gap-2">
      <button onClick={() => handleMarcarPresenca("Presente")}>Presente</button>
      <button onClick={() => handleMarcarPresenca("Justificado")}>
        Justificado
      </button>
      <button onClick={() => handleMarcarPresenca("Ausente")}>Ausente</button>
    </div>
  );
}
```

### Obter Resumo do Dia

```typescript
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function Dashboard() {
  const [resumo, setResumo] = useState<any>(null);

  useEffect(() => {
    const carregarResumo = async () => {
      const response = await apiClient.getResumoDia();
      if (response.success) {
        setResumo(response.data);
      }
    };

    carregarResumo();
  }, []);

  if (!resumo) return <p>Carregando...</p>;

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-blue-100 p-4 rounded">
        <h3>Total de Membros</h3>
        <p className="text-2xl">{resumo.total_membros_ativos}</p>
      </div>
      <div className="bg-green-100 p-4 rounded">
        <h3>Presentes</h3>
        <p className="text-2xl">{resumo.presencas.presentes}</p>
      </div>
      <div className="bg-yellow-100 p-4 rounded">
        <h3>Justificados</h3>
        <p className="text-2xl">{resumo.presencas.justificados}</p>
      </div>
      <div className="bg-red-100 p-4 rounded">
        <h3>Ausentes</h3>
        <p className="text-2xl">{resumo.presencas.ausentes}</p>
      </div>
    </div>
  );
}
```

### Hook Personalizado para Autenticação

Crie `hooks/useAuth.ts`:

```typescript
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, type User } from "@/lib/api-client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const carregarUsuario = async () => {
      if (!apiClient.isAuthenticated()) {
        setLoading(false);
        return;
      }

      const response = await apiClient.getCurrentUser();
      if (response.success) {
        setUser(response.data || null);
      } else {
        // Token inválido, fazer logout
        apiClient.logout();
      }
      setLoading(false);
    };

    carregarUsuario();
  }, []);

  const login = async (email: string, senha: string) => {
    const response = await apiClient.login(email, senha);
    if (response.success && response.data) {
      setUser(response.data.user);
      router.push("/dashboard");
    }
    return response;
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    router.push("/login");
  };

  return {
    user,
    loading,
    isAuthenticated: apiClient.isAuthenticated(),
    login,
    logout,
  };
}
```

Uso do hook:

```typescript
import { useAuth } from "@/hooks/useAuth";

export default function Profile() {
  const { user, loading, logout } = useAuth();

  if (loading) return <p>Carregando...</p>;
  if (!user) return <p>Não autenticado</p>;

  return (
    <div>
      <h1>Bem-vindo, {user.nome_completo}</h1>
      <p>Email: {user.email}</p>
      <button onClick={logout}>Sair</button>
    </div>
  );
}
```

## Substituição do Firebase

### Antes (Firebase):

```typescript
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const snapshot = await getDocs(collection(db, "membros"));
const membros = snapshot.docs.map((doc) => doc.data());
```

### Depois (API REST):

```typescript
import { apiClient } from "@/lib/api-client";

const response = await apiClient.listarMembros();
const membros = response.data?.data || [];
```

## Páginas a Atualizar

### `/presencadecadastrados/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { apiClient, type Membro } from "@/lib/api-client";

export default function PresencaCadastrados() {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const carregarMembros = async () => {
      const response = await apiClient.listarMembros({ limite: 50 });
      if (response.success) {
        setMembros(response.data?.data || []);
      }
      setLoading(false);
    };

    carregarMembros();
  }, []);

  // Resto do componente...
}
```

### `/reports/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function Reports() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const carregarEstatisticas = async () => {
      const response = await apiClient.getResumoDia();
      if (response.success) {
        setStats(response.data);
      }
    };

    carregarEstatisticas();
  }, []);

  // Resto do componente...
}
```

## Tratamento de Erros

```typescript
import { apiClient } from "@/lib/api-client";

async function exemploTratamentoErro() {
  const response = await apiClient.marcarPresenca("id", "Presente");

  if (!response.success) {
    switch (response.error?.status) {
      case 400:
        console.error("Dados inválidos:", response.error.message);
        break;
      case 401:
        console.error("Não autenticado");
        break;
      case 403:
        console.error("Acesso negado");
        break;
      case 404:
        console.error("Recurso não encontrado");
        break;
      default:
        console.error("Erro desconhecido:", response.message);
    }
  }
}
```

## Carregamento em Segundo Plano

```typescript
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

export default function ResumoComAtualizar() {
  const [resumo, setResumo] = useState<any>(null);
  const [atualizando, setAtualizando] = useState(false);

  const atualizar = async () => {
    setAtualizando(true);
    const response = await apiClient.getResumoDia();
    if (response.success) {
      setResumo(response.data);
    }
    setAtualizando(false);
  };

  useEffect(() => {
    atualizar();
    // Atualizar a cada 30 segundos
    const intervalo = setInterval(atualizar, 30000);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div>
      {atualizando && <p>Atualizando...</p>}
      {resumo && <p>Taxa de presença: {resumo.taxa_presenca}</p>}
    </div>
  );
}
```

## Deploy

### Variáveis de Ambiente em Produção

No painel do Plesk ou no arquivo `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://ipda.app.br
```

A aplicação Next.js fará requisições para `https://ipda.app.br/api/*`.

### Configuração de CORS

A API permite requisições de:

- `https://ipda.app.br`
- `https://seivadigital.com.br`
- `http://localhost:3000` (desenvolvimento)

Se precisar adicionar outro domínio, atualize `corsOptions` em `api/src/app.ts`.

## Testing com Postman

1. Importe `api/IPDA-Attendance-API.postman_collection.json` no Postman
2. Configure a variável `base_url` para seu ambiente
3. Faça login para obter tokens
4. Use os tokens nas variáveis `{{token}}` e `{{refreshToken}}`

## Troubleshooting

### "Erro de CORS"

Verifique se o domínio do Next.js está configurado em `corsOptions` na API.

### "Token expirado"

O cliente automaticamente renova tokens expirados. Se continuar falhando, faça login novamente.

### "Conexão recusada"

Verifique se a API está rodando e se `NEXT_PUBLIC_API_URL` está correto.

---

**Versão:** 1.0.0
