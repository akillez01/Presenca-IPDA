# 📱 Guia: Executar App no Emulador

## 🚀 Métodos para Abrir o App

### **Método 1: Script Automático (Recomendado)**

```bash
./run-emulator.sh
```

- ✅ Mais fácil e confiável
- ✅ Gerencia emulador automaticamente
- ✅ Instala e executa o app
- ✅ Inclui verificações de erro

### **Método 2: Capacitor CLI**

```bash
npx cap run android
```

- ⚡ Mais rápido se funcionar
- ⚠️ Pode ter problemas de ADB
- 🔄 Sincroniza automaticamente

### **Método 3: Manual Completo**

```bash
# 1. Listar emuladores
emulator -list-avds

# 2. Iniciar emulador
emulator -avd Medium_Phone_API_36.0 &

# 3. Aguardar inicializar
adb devices

# 4. Instalar APK
adb install sistema-presenca-ipda.apk

# 5. Executar app
adb shell am start -n br.ipda.presenca/br.ipda.presenca.MainActivity
```

## 🎯 Emuladores Disponíveis

| Nome                    | Descrição                  |
| ----------------------- | -------------------------- |
| `Medium_Phone_API_36.0` | Android 14 - Phone médio   |
| `Pixel_9_Pro`           | Pixel 9 Pro - Mais recente |
| `SEIVA_BRUTA_Pixel7`    | Pixel 7 - Personalizado    |

## 🛠️ Comandos Úteis

### Gerenciar Emuladores

```bash
# Listar todos
emulator -list-avds

# Iniciar específico
emulator -avd NOME_DO_AVD

# Iniciar sem animação (mais rápido)
emulator -avd NOME_DO_AVD -no-boot-anim

# Limpar dados
emulator -avd NOME_DO_AVD -wipe-data
```

### ADB (Android Debug Bridge)

```bash
# Ver dispositivos conectados
adb devices

# Instalar APK
adb install arquivo.apk

# Instalar forçando atualização
adb install -r arquivo.apk

# Desinstalar app
adb uninstall br.ipda.presenca

# Executar app
adb shell am start -n br.ipda.presenca/br.ipda.presenca.MainActivity

# Ver logs do app
adb logcat | grep IPDA
```

### Capacitor

```bash
# Sincronizar e executar
npx cap run android

# Apenas sincronizar
npx cap sync android

# Abrir no Android Studio
npx cap open android
```

## 🔧 Troubleshooting

### Problema: Emulador não inicia

```bash
# Verificar virtualizações habilitadas
grep -E '(vmx|svm)' /proc/cpuinfo

# Limpar cache Android
rm -rf ~/.android/avd/*/cache/*
```

### Problema: ADB não reconhece dispositivo

```bash
# Reiniciar ADB
adb kill-server
adb start-server

# Verificar dispositivos
adb devices
```

### Problema: App não instala

```bash
# Desinstalar versão anterior
adb uninstall br.ipda.presenca

# Instalar com logs
adb install -r sistema-presenca-ipda.apk
```

### Problema: App não executa

```bash
# Ver logs de erro
adb logcat | grep -E "(IPDA|AndroidRuntime|System.err)"

# Verificar se está instalado
adb shell pm list packages | grep ipda
```

## 📱 Interface do Emulador

### Controles Principais

- **🔙 Back**: Voltar
- **🏠 Home**: Tela inicial
- **📱 Recent**: Apps recentes
- **🔄 Rotate**: Rotacionar tela
- **📶 Network**: Simular rede
- **📍 Location**: Simular GPS

### Atalhos de Teclado

- `Ctrl + M`: Menu
- `F2`: Menu
- `F7`: Power
- `F8`: Home
- `F9`: Recent apps

## 🎯 Dicas de Performance

### Emulador Mais Rápido

```bash
# Usar x86_64 se disponível
# Habilitar GPU acceleration
# Usar -no-boot-anim
# Aumentar RAM do AVD
```

### App Debug

```bash
# Logs específicos do app
adb logcat -s "IPDA"

# Logs de JavaScript (WebView)
adb logcat | grep "Console"

# Performance monitoring
adb shell top | grep ipda
```

## 📋 Status do App

### Verificações Rápidas

```bash
# App está instalado?
adb shell pm list packages | grep br.ipda.presenca

# App está rodando?
adb shell ps | grep br.ipda.presenca

# Qual activity está ativa?
adb shell dumpsys activity | grep mCurrentFocus
```

---

**💡 Dica:** Use `./run-emulator.sh` para a experiência mais simples e confiável!
