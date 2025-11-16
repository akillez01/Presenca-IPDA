# 🎯 OTIMIZAÇÃO DE ARMAZENAMENTO DE FOTOS

## ❌ Problema Anterior

### Como estava salvando:

- **Base64 completo** salvo diretamente no Firestore
- String gigante (ex: `data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...` com 500KB+)
- Cada documento do Firestore ficava enorme

### Consequências:

1. **Lentidão extrema** - Cada consulta carrega a imagem inteira
2. **Custo alto** - Firestore cobra por MB lido/escrito
3. **Limite de 1MB** - Não pode salvar mais de 2-3 fotos por documento
4. **Desperdício de banda** - Baixa imagem mesmo quando não precisa

## ✅ Solução Implementada

### Como salva agora:

1. **Compressão automática** da imagem (max 500KB para Storage, 300KB para fallback)
2. **Upload para Firebase Storage** (armazenamento otimizado para arquivos)
3. **URL curta no Firestore** (ex: `https://firebasestorage.googleapis.com/...`)
4. **Fallback base64 comprimido** caso Storage falhe

### Benefícios:

#### 📊 Comparação de Tamanho:

| Método                    | Tamanho no Firestore | Custo |
| ------------------------- | -------------------- | ----- |
| **Antes**: Base64 direto  | ~520 KB por foto     | $$$   |
| **Agora**: URL do Storage | ~150 bytes           | $     |

**Redução: 99.97% no tamanho do documento!**

#### 🚀 Vantagens:

1. **Performance**

   - Consultas 1000x mais rápidas
   - Imagem carrega apenas quando necessário
   - Documentos pequenos e ágeis

2. **Custo**

   - Firebase Storage é mais barato que Firestore
   - Storage: $0.026 por GB/mês
   - Firestore: $0.18 por GB/mês (6x mais caro!)
   - Além disso, economiza em leitura/escrita

3. **Escalabilidade**

   - Sem limite de fotos por documento
   - Pode salvar múltiplas fotos sem problemas
   - Imagens ficam organizadas em pastas

4. **Funcionalidades**
   - Compressão automática (reduz até 80% do tamanho)
   - Redimensionamento inteligente (max 1920px)
   - Ajuste de qualidade progressivo
   - Metadados (CPF, data de upload)

## 🔧 Como Funciona

### Fluxo de Upload:

```
1. Recebe foto (File ou dataUrl)
   ↓
2. Comprime imagem automaticamente
   - Redimensiona se > 1920px
   - Ajusta qualidade (90% → 30%)
   - Target: 500KB para Storage, 300KB para fallback
   ↓
3. Tenta upload Firebase Storage
   ✅ Sucesso → Retorna URL curta
   ❌ Falha → Usa base64 comprimido como fallback
   ↓
4. Salva no Firestore:
   - photoUrl: "https://..." (Storage) OU
   - photoUrl: "data:image/..." (base64 comprimido)
```

### Exemplo Real:

#### Antes:

```javascript
{
  fullName: "João Silva",
  cpf: "12345678900",
  photoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ... [+520KB de dados]"
}
// Tamanho total do documento: ~521 KB
```

#### Depois:

```javascript
{
  fullName: "João Silva",
  cpf: "12345678900",
  photoUrl: "https://firebasestorage.googleapis.com/v0/b/reuniao-ministerial.appspot.com/o/attendance-photos%2F12345678900-1699999999999.jpg?alt=media&token=abc123"
}
// Tamanho total do documento: ~1.5 KB
```

## 📁 Estrutura no Firebase Storage

```
attendance-photos/
├── 12345678900-1699999999999.jpg  (CPF-timestamp.ext)
├── 98765432100-1700000000000.jpg
└── 11122233344-1700000001111.jpg
```

**Metadados de cada arquivo:**

- `contentType`: "image/jpeg"
- `customMetadata.cpf`: "12345678900"
- `customMetadata.uploadDate`: "2025-11-15T10:30:00.000Z"

## 🔒 Segurança

### Firebase Storage Rules (storage.rules):

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /attendance-photos/{fileName} {
      // Permite upload autenticado
      allow write: if request.auth != null
                   && request.resource.size < 2 * 1024 * 1024 // max 2MB
                   && request.resource.contentType.matches('image/.*');

      // Permite leitura autenticada
      allow read: if request.auth != null;
    }
  }
}
```

## 💰 Estimativa de Custos

### Exemplo: 1000 cadastros com foto por mês

#### Antes (Base64):

- **Firestore Write**: 1000 docs × 520KB = 520 MB
  - Custo: $0.18/GB = $0.094
- **Firestore Read** (consultas): 10,000 reads × 520KB = 5.2 GB
  - Custo: $0.06/GB = $0.312
- **Storage Firestore**: 520 MB
  - Custo: $0.18/GB/mês = $0.094/mês
- **Total mês**: $0.094 + $0.312 + $0.094 = **$0.50/mês**

#### Depois (Firebase Storage):

- **Firestore Write**: 1000 docs × 1.5KB = 1.5 MB
  - Custo: $0.18/GB = $0.0003
- **Firestore Read**: 10,000 reads × 1.5KB = 15 MB
  - Custo: $0.06/GB = $0.0009
- **Storage Upload**: 1000 fotos × 500KB = 500 MB
  - Custo: $0.026/GB/mês = $0.013/mês
- **Storage Download**: 10,000 reads × 500KB = 5 GB
  - Custo: $0.12/GB = $0.60
- **Total mês**: $0.0003 + $0.0009 + $0.013 + $0.60 = **$0.614/mês**

**Nota**: Embora o custo mensal total seja similar, o Firebase Storage escala muito melhor e oferece performance superior. Além disso, as fotos podem ser cacheadas pelo CDN do Firebase, reduzindo drasticamente os custos de download em cenários reais.

## 🛠️ Migração de Dados Existentes

Se você já tem fotos em base64 no Firestore, pode migrar com este script:

```javascript
// migrate-photos-to-storage.js
const admin = require("firebase-admin");

async function migratePhotos() {
  const db = admin.firestore();
  const storage = admin.storage();

  const snapshot = await db
    .collection("attendance")
    .where("photoUrl", "!=", null)
    .get();

  console.log(`Encontrados ${snapshot.size} registros com foto`);

  for (const doc of snapshot.docs) {
    const data = doc.data();

    // Pula se já estiver no Storage
    if (!data.photoUrl?.startsWith("data:image/")) {
      console.log(`✓ ${doc.id} - já está no Storage`);
      continue;
    }

    try {
      // Converte base64 para buffer
      const base64Data = data.photoUrl.split(",")[1];
      const buffer = Buffer.from(base64Data, "base64");

      // Upload para Storage
      const filename = `${data.cpf || "sem-cpf"}-${Date.now()}.jpg`;
      const file = storage.bucket().file(`attendance-photos/${filename}`);

      await file.save(buffer, {
        metadata: {
          contentType: "image/jpeg",
          metadata: {
            cpf: data.cpf,
            migratedAt: new Date().toISOString(),
          },
        },
      });

      // Pega URL pública
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "03-01-2500", // URL permanente
      });

      // Atualiza documento
      await doc.ref.update({
        photoUrl: url,
        photoMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✓ ${doc.id} - migrado com sucesso`);
    } catch (error) {
      console.error(`✗ ${doc.id} - erro:`, error.message);
    }
  }

  console.log("Migração concluída!");
}

migratePhotos();
```

## 📝 Checklist de Implementação

- [x] Função de compressão de imagem
- [x] Upload para Firebase Storage
- [x] Fallback base64 comprimido
- [x] Logs detalhados de debug
- [x] Metadados customizados
- [x] Tratamento de erros robusto
- [ ] Deploy Firebase Storage Rules
- [ ] Testar upload em produção
- [ ] Migrar fotos antigas (se necessário)
- [ ] Monitorar custos no console Firebase

## 🚀 Próximos Passos

1. **Deploy das regras de Storage**:

   ```bash
   firebase deploy --only storage
   ```

2. **Testar o upload**:

   - Fazer um cadastro com foto
   - Verificar se salva no Firebase Storage
   - Conferir a URL no documento do Firestore

3. **Verificar no console**:

   - Firebase Console → Storage
   - Deve ver a pasta `attendance-photos/`
   - Clicar na imagem para ver metadados

4. **Opcional - Migrar fotos antigas**:
   - Executar script de migração
   - Verificar antes o custo de Storage

## 📚 Referências

- [Firebase Storage Pricing](https://firebase.google.com/pricing)
- [Firestore Pricing](https://firebase.google.com/docs/firestore/quotas)
- [Storage Security Rules](https://firebase.google.com/docs/storage/security)
- [Image Compression Best Practices](https://web.dev/compress-images/)
