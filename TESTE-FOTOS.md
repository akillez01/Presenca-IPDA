# 🧪 TESTE DE SALVAMENTO DE FOTOS

## Método 1: Teste Manual Rápido

1. Abra a página de cadastro: `https://localhost:3000/register`
2. Preencha o formulário
3. Tire uma foto ou selecione uma imagem
4. Clique em "Registrar"
5. Aguarde a mensagem de sucesso
6. Abra o Console do Navegador (F12) e cole este código:

```javascript
// Verificar o último registro salvo
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "./src/lib/firebase";

const q = query(
  collection(db, "attendance"),
  orderBy("timestamp", "desc"),
  limit(1)
);
const snapshot = await getDocs(q);
const doc = snapshot.docs[0];
const data = doc.data();

console.log("📝 Último registro:", data.fullName);
console.log("📸 Tem foto?", data.photoUrl ? "✅ SIM" : "❌ NÃO");

if (data.photoUrl) {
  if (data.photoUrl.startsWith("data:image/")) {
    console.log("💾 Tipo: BASE64 (local)");
    console.log("📏 Tamanho:", Math.round(data.photoUrl.length / 1024), "KB");
  } else {
    console.log("☁️ Tipo: Firebase Storage");
    console.log("🔗 URL:", data.photoUrl);
  }
}
```

## Método 2: Verificação pelo Firebase Console

1. Acesse: https://console.firebase.google.com/project/reuniao-ministerial/firestore
2. Abra a coleção `attendance`
3. Clique no último documento
4. Procure o campo `photoUrl`
5. Se começar com `data:image/` → foto salva em base64 ✅
6. Se for uma URL do Storage → foto no Firebase Storage ✅
7. Se for `null` ou vazio → sem foto ❌

## Método 3: Teste direto no código

Adicione este log temporário no arquivo `src/app/register/page.tsx` após o cadastro bem-sucedido:

```typescript
if (result.success) {
  console.log("✅ Cadastro realizado!");
  console.log("📸 Foto salva:", normalizedValues.photoUrl ? "SIM" : "NÃO");
  if (normalizedValues.photoUrl) {
    console.log(
      "💾 Tipo:",
      normalizedValues.photoUrl.startsWith("data:") ? "BASE64" : "STORAGE"
    );
  }
  setSuccess("Cadastro realizado com sucesso!");
  form.reset();
  setPhotoSelection(null);
}
```

## O que esperar:

### ✅ Sucesso (com foto):

```
📸 Iniciando upload de foto...
☁️ Tentando Firebase Storage...
⚠️ Firebase Storage não disponível, usando fallback base64
🔄 Convertendo para base64...
✅ Foto convertida para base64 com sucesso! Tamanho: 45 KB
✅ Foto salva localmente (base64)
📝 Último registro: João Silva
📸 Tem foto? ✅ SIM
💾 Tipo: BASE64 (local)
📏 Tamanho: 45 KB
```

### ✅ Sucesso (sem foto):

```
📝 Último registro: Maria Santos
📸 Tem foto? ❌ NÃO
```

## Verificação rápida pelo console do navegador:

Abra o DevTools (F12) na página `/register` e execute:

```javascript
// Após fazer um cadastro, execute:
localStorage.getItem("lastPhotoTest"); // Se não existir, ignore
```

Melhor ainda, após fazer um cadastro, abra o console e veja:

- Se aparecer "✅ Foto convertida para base64" → FUNCIONANDO ✅
- Se aparecer "Cadastro realizado com sucesso" → FUNCIONANDO ✅
