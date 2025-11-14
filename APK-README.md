# 📱 APK - Sistema de Presença IPDA

## 🎯 Sobre o App

O **Sistema de Presença IPDA** é um aplicativo Android nativo gerado a partir da aplicação web Next.js usando **Capacitor**. O app oferece todas as funcionalidades da versão web em um formato móvel otimizado.

## 📦 Arquivos APK

### APK Debug (Desenvolvimento)

- **Arquivo:** `sistema-presenca-ipda-debug.apk` (9.5 MB)
- **Uso:** Testes e desenvolvimento
- **Assinatura:** Debug (não para produção)

### APK Release (Produção)

- **Arquivo:** `sistema-presenca-ipda-release.apk`
- **Uso:** Distribuição final
- **Assinatura:** Requer keystore de produção

## 🔧 Requisitos do Sistema

- **Android:** 7.0+ (API 24)
- **Espaço:** ~15 MB
- **Permissões:**
  - Internet (conexão Firebase)
  - Câmera (scanner QR Code)
  - Armazenamento (cache offline)
  - Rede (verificar conectividade)

## 🚀 Instalação

### Via ADB (Android Debug Bridge)

```bash
adb install sistema-presenca-ipda-debug.apk
```

### Via Transferência Direta

1. Copie o APK para o dispositivo
2. Ative "Fontes desconhecidas" nas configurações
3. Abra o arquivo APK no dispositivo
4. Confirme a instalação

## ⚙️ Como Buildar

### Automático

```bash
./build-apk.sh
```

### Manual

```bash
# 1. Build da aplicação web
npm run build

# 2. Sincronizar com Capacitor
npx cap sync android

# 3. Compilar APK
cd android && ./gradlew assembleDebug
```

## 📋 Configurações do App

| Propriedade     | Valor                    |
| --------------- | ------------------------ |
| **App ID**      | `br.ipda.presenca`       |
| **Nome**        | Sistema de Presença IPDA |
| **Versão**      | 1.0 (Build 1)            |
| **Min SDK**     | 24 (Android 7.0)         |
| **Target SDK**  | 34 (Android 14)          |
| **Compile SDK** | 35 (Android 15)          |

## 🔌 Plugins Capacitor

- **Core:** Funcionalidades básicas
- **Status Bar:** Barra de status personalizada
- **Splash Screen:** Tela de carregamento
- **Camera:** Acesso à câmera (QR Code)
- **Filesystem:** Armazenamento local

## 🎨 Recursos PWA

- **Ícones:** Múltiplos tamanhos (72x72 até 1024x1024)
- **Manifest:** Configuração PWA completa
- **Service Worker:** Cache offline
- **Shortcuts:** Atalhos de app

## 🔐 Assinatura de Release

Para gerar APK de produção, configure o keystore:

```bash
# Gerar keystore
keytool -genkey -v -keystore release.keystore -alias ipda -keyalg RSA -keysize 2048 -validity 10000

# Configurar em android/app/build.gradle
signingConfigs {
    release {
        storeFile file('release.keystore')
        storePassword 'SUA_SENHA'
        keyAlias 'ipda'
        keyPassword 'SUA_SENHA'
    }
}
```

## 📱 Funcionalidades do App

### ✅ Completas

- ✅ Registro de presença
- ✅ Scanner QR Code
- ✅ Dashboard administrativo
- ✅ Relatórios
- ✅ Autenticação Firebase
- ✅ Cache offline
- ✅ Sincronização automática

### 🚧 Em Desenvolvimento

- 🔄 Notificações push
- 🔄 Modo escuro
- 🔄 Backup automático
- 🔄 Múltiplos idiomas

## 🐛 Troubleshooting

### Erro de Instalação

```
Fonte desconhecida não permitida
```

**Solução:** Ativar "Instalar apps desconhecidos" nas configurações

### Erro de Permissões

```
App não funciona corretamente
```

**Solução:** Verificar permissões de Internet e Câmera

### Erro de Build

```
Java version incompatible
```

**Solução:** Usar Java 21 (`export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64`)

## 📞 Suporte

Para problemas ou dúvidas:

1. Verificar logs no dispositivo
2. Testar em modo debug
3. Consultar documentação Capacitor
4. Reportar issues específicos

## 🔄 Atualizações

Para atualizar o APK:

1. Faça alterações no código web
2. Execute novo build: `./build-apk.sh`
3. Distribua novo APK
4. Usuários devem desinstalar versão anterior

---

_APK gerado em: $(date '+%Y-%m-%d %H:%M:%S')_
