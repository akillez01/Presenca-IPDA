#!/bin/bash

# Script para Corrigir Build Java - Sistema de Presença IPDA

echo "🔧 Corrigindo configurações Java para build..."

# Diretório do projeto
PROJECT_DIR="/home/achilles/Documentos/Projetos2025/Presen-a-IPDA/Presen-a-IPDA"
cd "$PROJECT_DIR"

# Usar Java 17 (mais compatível)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

echo "✅ Java configurado: $(java -version 2>&1 | head -n1)"

# Corrigir configurações Gradle temporariamente
echo "🔧 Aplicando correções temporárias..."

# Backup das configurações originais
cp android/variables.gradle android/variables.gradle.backup
cp android/app/build.gradle android/app/build.gradle.backup

# Forçar Java 17 em todas as configurações
cat > android/gradle.properties << EOF
org.gradle.jvmargs=-Xmx4g -XX:MaxMetaspaceSize=512m
android.useAndroidX=true
android.enableJetifier=true
org.gradle.daemon=true
org.gradle.configureondemand=true
org.gradle.java.home=/usr/lib/jvm/java-17-openjdk-amd64
EOF

# Parar todos os daemons Gradle
echo "🛑 Parando daemons Gradle..."
cd android && ./gradlew --stop
cd ..

# Limpar cache Gradle
echo "🧹 Limpando cache..."
rm -rf android/.gradle
rm -rf ~/.gradle/caches

# Tentar build
echo "🏗️  Tentando build com Java 17..."
cd android
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
./gradlew assembleDebug

if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
    
    # Copiar APK
    cd ..
    cp android/app/build/outputs/apk/debug/app-debug.apk ./sistema-presenca-ipda-novo.apk
    echo "📱 Novo APK: sistema-presenca-ipda-novo.apk"
    
    # Instalar no emulador se estiver rodando
    if adb devices | grep -q "emulator.*device"; then
        DEVICE=$(adb devices | grep emulator | head -1 | awk '{print $1}')
        echo "📦 Instalando no emulador: $DEVICE"
        adb -s "$DEVICE" install -r sistema-presenca-ipda-novo.apk
        echo "🚀 Executando app..."
        adb -s "$DEVICE" shell am start -n br.ipda.presenca/br.ipda.presenca.MainActivity
    fi
else
    echo "❌ Build falhou. Restaurando configurações..."
    
    # Restaurar backups
    if [ -f android/variables.gradle.backup ]; then
        mv android/variables.gradle.backup android/variables.gradle
    fi
    if [ -f android/app/build.gradle.backup ]; then
        mv android/app/build.gradle.backup android/app/build.gradle
    fi
fi

echo ""
echo "🎯 Status:"
echo "   - APK anterior: sistema-presenca-ipda.apk (funcionando)"
echo "   - APK novo: sistema-presenca-ipda-novo.apk (se build ok)"
echo "   - Emulador: $(adb devices | grep emulator | wc -l) dispositivo(s) ativo(s)"