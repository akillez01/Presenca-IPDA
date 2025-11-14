#!/bin/bash

# Script para build APK com Java 21 (compatibilidade Capacitor)
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME

echo "=== Configuração Java 21 para Capacitor ==="
echo "JAVA_HOME: $JAVA_HOME"
java -version
echo ""

echo "=== Sincronizando assets web ==="
npx cap sync android

echo "=== Iniciando build do APK ==="
cd android
./gradlew clean assembleDebug \
    -Dorg.gradle.java.home=/usr/lib/jvm/java-21-openjdk-amd64 \
    --no-daemon \
    --stacktrace

echo ""
echo "=== Verificando APK gerado ==="
if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
    echo "✅ APK GERADO COM SUCESSO!"
    echo "📱 Localização: android/app/build/outputs/apk/debug/app-debug.apk"
    ls -lah app/build/outputs/apk/debug/app-debug.apk
else
    echo "❌ APK não foi gerado"
fi
