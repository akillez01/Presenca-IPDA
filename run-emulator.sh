#!/bin/bash

# Script para Executar App no Emulador Android
# Sistema de Presença IPDA

echo "📱 Iniciando App no Emulador Android"
echo "===================================="

# Configurações
PROJECT_DIR="/home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA"
APK_FILE="sistema-presenca-ipda.apk"
JAVA_HOME="/usr/lib/jvm/java-21-openjdk-amd64"

cd "$PROJECT_DIR"

# Verificar se APK existe
if [ ! -f "$APK_FILE" ]; then
    echo "❌ APK não encontrado. Execute primeiro: ./build-apk.sh"
    exit 1
fi

echo "✅ APK encontrado: $APK_FILE"

# Listar emuladores disponíveis
echo ""
echo "📋 Emuladores disponíveis:"
emulator -list-avds

# Perguntar qual emulador usar
echo ""
echo "🔸 Escolha um emulador (ou pressione Enter para usar Medium_Phone_API_36.0):"
read -p "> " AVD_NAME

# Usar padrão se não especificado
if [ -z "$AVD_NAME" ]; then
    AVD_NAME="Medium_Phone_API_36.0"
fi

echo "🚀 Iniciando emulador: $AVD_NAME"

# Função para iniciar emulador
start_emulator() {
    echo "📱 Iniciando emulador $AVD_NAME..."
    emulator -avd "$AVD_NAME" -no-boot-anim -no-snapshot -wipe-data &
    EMULATOR_PID=$!
    
    echo "⏳ Aguardando emulador inicializar..."
    
    # Aguardar até emulador aparecer em adb devices
    for i in {1..60}; do
        if adb devices | grep -q "emulator.*device"; then
            echo "✅ Emulador iniciado com sucesso!"
            return 0
        fi
        echo "   Tentativa $i/60 - Aguardando..."
        sleep 3
    done
    
    echo "❌ Timeout: Emulador não inicializou em 3 minutos"
    return 1
}

# Função para instalar e executar app
install_and_run() {
    local DEVICE=$(adb devices | grep emulator | head -1 | awk '{print $1}')
    
    if [ -z "$DEVICE" ]; then
        echo "❌ Nenhum emulador encontrado"
        return 1
    fi
    
    echo "⏳ Aguardando emulador ficar completamente pronto..."
    
    # Aguardar boot completo
    for i in {1..30}; do
        if adb -s "$DEVICE" shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
            echo "✅ Emulador completamente inicializado!"
            break
        fi
        echo "   Aguardando boot completo... ($i/30)"
        sleep 5
    done
    
    echo "📦 Instalando APK no dispositivo: $DEVICE"
    
    # Desinstalar versão anterior se existir
    adb -s "$DEVICE" uninstall br.ipda.presenca 2>/dev/null
    
    # Aguardar um pouco mais antes da instalação
    sleep 3
    
    # Instalar nova versão
    if adb -s "$DEVICE" install "$APK_FILE"; then
        echo "✅ APK instalado com sucesso!"
        
        echo "🚀 Iniciando aplicativo..."
        sleep 2
        adb -s "$DEVICE" shell am start -n br.ipda.presenca/br.ipda.presenca.MainActivity
        
        if [ $? -eq 0 ]; then
            echo "🎉 App iniciado com sucesso!"
            echo ""
            echo "📱 O app está rodando no emulador!"
            echo "🔧 Para debugar, use: adb -s $DEVICE logcat | grep IPDA"
        else
            echo "❌ Falha ao iniciar app"
        fi
    else
        echo "❌ Falha na instalação do APK"
        echo "🔧 Tentando instalar novamente em 10 segundos..."
        sleep 10
        if adb -s "$DEVICE" install -r "$APK_FILE"; then
            echo "✅ APK instalado na segunda tentativa!"
            sleep 2
            adb -s "$DEVICE" shell am start -n br.ipda.presenca/br.ipda.presenca.MainActivity
        else
            echo "❌ Falha definitiva na instalação"
            return 1
        fi
    fi
}

# Verificar se já existe emulador rodando
if adb devices | grep -q "emulator.*device"; then
    EXISTING_DEVICE=$(adb devices | grep emulator | head -1 | awk '{print $1}')
    echo "📱 Emulador já rodando: $EXISTING_DEVICE"
    echo "🔸 Usar emulador existente? (y/n, padrão: y):"
    read -p "> " USE_EXISTING
    
    if [ "$USE_EXISTING" != "n" ]; then
        install_and_run
        exit 0
    fi
fi

# Iniciar novo emulador
if start_emulator; then
    sleep 5  # Aguardar um pouco mais para garantir que está pronto
    install_and_run
else
    echo "❌ Falha ao iniciar emulador"
    exit 1
fi

echo ""
echo "🎯 Dicas:"
echo "   - Use Ctrl+C para parar o script"
echo "   - O emulador continuará rodando em background"
echo "   - Para fechar: adb -s <device> emu kill"
echo "   - Para logs: adb logcat"