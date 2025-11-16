# 🔍 Diagnóstico: Problemas com Câmera no Mobile

## Problemas Identificados

### 1. **Contexto Seguro (HTTPS)**

O componente `PhotoCaptureField` verifica:

```typescript
const isSecureContext = window.isSecureContext;
```

**Status:** ✅ Configurado corretamente

- `NEXT_PUBLIC_APP_URL="https://ipda.app.br"`
- `NEXT_PUBLIC_SECURE_COOKIES="true"`
- `NEXT_PUBLIC_FORCE_HTTPS="true"`

### 2. **Atributo `capture` no Input File**

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment" // ⚠️ PROBLEMA POTENCIAL
  className="hidden"
/>
```

**Problema:** O atributo `capture="environment"` pode:

- Não funcionar em todos os navegadores mobile
- Forçar apenas câmera traseira (pode não existir em tablets)
- Bloquear a seleção de galeria em alguns dispositivos

### 3. **Verificação de Permissões**

O código tenta múltiplas configurações:

1. `{ video: { facingMode: 'environment' } }` - Câmera traseira
2. `{ video: true }` - Qualquer câmera
3. `{ video: { facingMode: 'user' } }` - Câmera frontal

## Soluções Recomendadas

### Solução 1: Melhorar o Input File (Mobile-First)

```tsx
<input
  type="file"
  accept="image/*"
  capture="environment" // Remover ou tornar opcional
  className="hidden"
/>
```

### Solução 2: Adicionar Logs de Debug

Adicionar console.log detalhado para:

- Verificar se `getUserMedia` está disponível
- Verificar se o contexto é seguro
- Verificar permissões negadas
- Verificar dispositivos de mídia disponíveis

### Solução 3: Fallback Inteligente

Se a câmera via `getUserMedia` falhar, usar apenas:

```tsx
<input
  type="file"
  accept="image/*"
  capture // Sem especificar 'environment'
/>
```

### Solução 4: Detectar Ambiente Mobile

```typescript
const isMobile =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
```

## Checklist de Teste

### Ambiente de Desenvolvimento (localhost)

- [ ] Chrome Desktop - getUserMedia
- [ ] Firefox Desktop - getUserMedia
- [ ] Safari Desktop - getUserMedia

### Ambiente Mobile (HTTP)

- [ ] Chrome Android - Input file
- [ ] Safari iOS - Input file
- [ ] Firefox Android - Input file

### Ambiente Mobile (HTTPS - ipda.app.br)

- [ ] Chrome Android - getUserMedia
- [ ] Safari iOS - getUserMedia
- [ ] Firefox Android - getUserMedia
- [ ] Chrome Android - Input file (fallback)
- [ ] Safari iOS - Input file (fallback)

## Comandos de Diagnóstico

### 1. Verificar certificado SSL

```bash
curl -vI https://ipda.app.br 2>&1 | grep -E "(SSL|TLS|Certificate)"
```

### 2. Verificar headers de segurança

```bash
curl -I https://ipda.app.br | grep -E "(Content-Security-Policy|Permissions-Policy)"
```

### 3. Testar acesso local via HTTPS

```bash
# Gerar certificado local
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Rodar Next.js com HTTPS
next dev --experimental-https
```

## Próximos Passos

1. ✅ **Adicionar modo debug** ao componente PhotoCaptureField
2. ✅ **Remover/ajustar** atributo `capture="environment"`
3. ✅ **Adicionar detecção** de dispositivo mobile
4. ✅ **Melhorar mensagens** de erro para o usuário
5. ✅ **Testar em múltiplos** dispositivos e navegadores
6. ✅ **Adicionar analytics** para rastrear falhas de câmera

## Código de Debug Sugerido

```typescript
// Adicionar ao início do startCamera()
console.group("📹 Iniciando câmera");
console.log("Navigator disponível:", typeof navigator !== "undefined");
console.log(
  "getUserMedia disponível:",
  typeof navigator?.mediaDevices?.getUserMedia === "function"
);
console.log("Contexto seguro:", window.isSecureContext);
console.log("User Agent:", navigator.userAgent);
console.log(
  "Dispositivos de mídia:",
  await navigator.mediaDevices?.enumerateDevices()
);
console.groupEnd();
```
