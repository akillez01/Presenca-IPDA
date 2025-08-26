#!/usr/bin/env python3
"""
Relatório específico para os registros do dia 17 de agosto de 2025
"""

import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timezone, timedelta
import os
from collections import Counter

def init_firebase():
    try:
        if not firebase_admin._apps:
            cred_path = "reuniao-ministerial-firebase-adminsdk-fbsvc-0e7e21e6f7.json"
            if not os.path.exists(cred_path):
                print("❌ Arquivo de credenciais não encontrado:", cred_path)
                return None
            
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        
        return firestore.client()
    except Exception as e:
        print(f"❌ Erro ao inicializar Firebase: {e}")
        return None

def relatorio_dia_17():
    db = init_firebase()
    if not db:
        return
    
    print("📅 " + "="*50)
    print("📊 RELATÓRIO DO DIA 17 DE AGOSTO DE 2025")
    print("📅 " + "="*50)
    print()
    
    try:
        # Definir timezone do Amazonas (UTC-4)
        timezone_amazonas = timezone(timedelta(hours=-4))
        
        # Data específica do dia 17
        inicio = datetime(2025, 8, 17, 0, 0, 0, tzinfo=timezone_amazonas)
        fim = datetime(2025, 8, 17, 23, 59, 59, tzinfo=timezone_amazonas)
        
        print(f"🔍 Buscando registros entre:")
        print(f"   📅 Início: {inicio.strftime('%d/%m/%Y %H:%M:%S %Z')}")
        print(f"   📅 Fim: {fim.strftime('%d/%m/%Y %H:%M:%S %Z')}")
        print()
        
        # Consultar Firebase
        docs = db.collection('attendance').where(
            'timestamp', '>=', inicio
        ).where(
            'timestamp', '<=', fim
        ).stream()
        
        registros = []
        for doc in docs:
            data = doc.to_dict()
            
            # Converter timestamp para timezone do Amazonas
            timestamp = data.get('timestamp')
            if timestamp:
                timestamp_local = timestamp.astimezone(timezone_amazonas)
            else:
                timestamp_local = None
            
            registros.append({
                'id': doc.id,
                'nome': data.get('fullName', 'N/A'),
                'cpf': data.get('cpf', 'N/A'),
                'status': data.get('status', 'Presente'),
                'regiao': data.get('region', 'N/A'),
                'cargo': data.get('churchPosition', 'N/A'),
                'pastor': data.get('pastorName', 'N/A'),
                'timestamp': timestamp_local,
                'justificativa': data.get('absentReason', '')
            })
        
        if not registros:
            print("⚠️  NENHUM REGISTRO ENCONTRADO PARA O DIA 17/08/2025")
            print()
            return
        
        # Ordenar por horário
        registros.sort(key=lambda x: x['timestamp'] if x['timestamp'] else datetime.min.replace(tzinfo=timezone_amazonas))
        
        print(f"📈 TOTAL DE REGISTROS: {len(registros)}")
        print()
        
        # Estatísticas por status
        status_count = Counter(r['status'] for r in registros)
        
        print("📊 DISTRIBUIÇÃO POR STATUS:")
        for status, count in status_count.items():
            emoji = "✅" if status == "Presente" else "📝" if status == "Justificado" else "❌"
            print(f"   {emoji} {status}: {count} pessoa(s)")
        print()
        
        # Estatísticas por região
        regiao_count = Counter(r['regiao'] for r in registros)
        
        print("🌍 DISTRIBUIÇÃO POR REGIÃO:")
        for regiao, count in regiao_count.items():
            print(f"   📍 {regiao}: {count} pessoa(s)")
        print()
        
        print("👥 LISTA DETALHADA DOS REGISTROS:")
        print("=" * 60)
        
        for i, r in enumerate(registros, 1):
            status_emoji = "✅" if r['status'] == "Presente" else "📝" if r['status'] == "Justificado" else "❌"
            horario = r['timestamp'].strftime('%H:%M:%S') if r['timestamp'] else 'N/A'
            
            print(f"\n{i:2d}. {status_emoji} {r['nome']}")
            print(f"    📄 CPF: {r['cpf']}")
            print(f"    🏢 Cargo: {r['cargo']}")
            print(f"    📍 Região: {r['regiao']}")
            print(f"    👨‍🏫 Pastor: {r['pastor']}")
            print(f"    ⏰ Horário: {horario}")
            
            if r['status'] == 'Justificado' and r['justificativa']:
                print(f"    📝 Justificativa: {r['justificativa']}")
            print("    " + "─" * 40)
        
        print()
        print("📋 RESUMO FINAL:")
        print(f"   📅 Data: 17 de Agosto de 2025")
        print(f"   📊 Total de Registros: {len(registros)}")
        
        if registros:
            primeiro_registro = next((r for r in registros if r['timestamp']), None)
            ultimo_registro = next((r for r in reversed(registros) if r['timestamp']), None)
            
            if primeiro_registro:
                print(f"   ⏰ Primeiro Registro: {primeiro_registro['timestamp'].strftime('%H:%M:%S')}")
            if ultimo_registro:
                print(f"   ⏰ Último Registro: {ultimo_registro['timestamp'].strftime('%H:%M:%S')}")
        
        # Percentuais
        total = len(registros)
        for status, count in status_count.items():
            percentual = (count / total) * 100
            print(f"   📈 {status}: {count} ({percentual:.1f}%)")
        
        print()
        print("✅ RELATÓRIO CONCLUÍDO COM SUCESSO!")
        
    except Exception as e:
        print(f"❌ Erro ao consultar registros do dia 17: {e}")

if __name__ == "__main__":
    relatorio_dia_17()
