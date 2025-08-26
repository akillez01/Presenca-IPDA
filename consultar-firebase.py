#!/usr/bin/env python3
"""
Script Python para consultar dados do Firebase
Requer: pip install firebase-admin
"""

import firebase_admin
from firebase_admin import credentials, firestore
import json
import csv
from datetime import datetime
import sys
import os

# Inicializar Firebase
def init_firebase():
    try:
        # Verificar se já foi inicializado
        if not firebase_admin._apps:
            # Caminho para o arquivo de credenciais
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

def listar_colecoes(db):
    """Lista todas as coleções disponíveis"""
    try:
        print("📚 COLEÇÕES DISPONÍVEIS:")
        collections = db.collections()
        for collection in collections:
            print(f"  - {collection.id}")
        print()
    except Exception as e:
        print(f"❌ Erro ao listar coleções: {e}")

def consultar_presencas(db, limite=10):
    """Consulta os últimos registros de presença"""
    try:
        print(f"👥 ÚLTIMOS {limite} REGISTROS DE PRESENÇA:")
        
        docs = db.collection('attendance').order_by('timestamp', direction=firestore.Query.DESCENDING).limit(limite).stream()
        
        count = 0
        for doc in docs:
            data = doc.to_dict()
            count += 1
            
            timestamp_str = "N/A"
            if 'timestamp' in data and data['timestamp']:
                timestamp_str = data['timestamp'].strftime('%d/%m/%Y %H:%M:%S')
            
            print(f"\n  📋 ID: {doc.id}")
            print(f"     Nome: {data.get('fullName', 'N/A')}")
            print(f"     CPF: {data.get('cpf', 'N/A')}")
            print(f"     Status: {data.get('status', 'Presente')}")
            print(f"     Região: {data.get('region', 'N/A')}")
            print(f"     Data: {timestamp_str}")
            
            if data.get('status') == 'Justificado' and data.get('absentReason'):
                print(f"     Justificativa: {data.get('absentReason')}")
        
        if count == 0:
            print("  ⚠️  Nenhum registro encontrado")
        
        print(f"\n  📊 Total exibido: {count} registros")
        
    except Exception as e:
        print(f"❌ Erro ao consultar presenças: {e}")

def contar_registros(db):
    """Conta e estatísticas dos registros"""
    try:
        print("📊 ESTATÍSTICAS DOS REGISTROS:")
        
        docs = db.collection('attendance').stream()
        
        total = 0
        stats_status = {}
        stats_regiao = {}
        
        for doc in docs:
            data = doc.to_dict()
            total += 1
            
            # Contar por status
            status = data.get('status', 'Presente')
            stats_status[status] = stats_status.get(status, 0) + 1
            
            # Contar por região
            regiao = data.get('region', 'Sem região')
            stats_regiao[regiao] = stats_regiao.get(regiao, 0) + 1
        
        print(f"\n  📈 Total de registros: {total}")
        
        print(f"\n  📊 Por Status:")
        for status, count in sorted(stats_status.items()):
            print(f"     {status}: {count}")
        
        print(f"\n  🌍 Por Região:")
        for regiao, count in sorted(stats_regiao.items()):
            print(f"     {regiao}: {count}")
            
    except Exception as e:
        print(f"❌ Erro ao contar registros: {e}")

def consultar_por_status(db, status):
    """Consulta registros por status específico"""
    try:
        print(f"🔍 REGISTROS COM STATUS: {status}")
        
        docs = db.collection('attendance').where('status', '==', status).order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
        
        count = 0
        for doc in docs:
            data = doc.to_dict()
            count += 1
            
            timestamp_str = "N/A"
            if 'timestamp' in data and data['timestamp']:
                timestamp_str = data['timestamp'].strftime('%d/%m/%Y')
            
            print(f"  • {data.get('fullName', 'N/A')} ({data.get('region', 'N/A')}) - {timestamp_str}")
            
            if status == 'Justificado' and data.get('absentReason'):
                print(f"    Motivo: {data.get('absentReason')}")
        
        if count == 0:
            print(f"  ⚠️  Nenhum registro encontrado com status '{status}'")
        else:
            print(f"\n  📊 Total encontrado: {count} registros")
            
    except Exception as e:
        print(f"❌ Erro ao consultar por status: {e}")

def exportar_csv(db):
    """Exporta todos os dados para CSV"""
    try:
        print("💾 EXPORTANDO DADOS PARA CSV...")
        
        docs = db.collection('attendance').order_by('timestamp', direction=firestore.Query.DESCENDING).stream()
        
        filename = f"firebase-export-{datetime.now().strftime('%Y-%m-%d_%H-%M-%S')}.csv"
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['Nome', 'CPF', 'Status', 'Região', 'Cargo', 'Pastor', 'Data', 'Justificativa']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            
            count = 0
            for doc in docs:
                data = doc.to_dict()
                count += 1
                
                timestamp_str = ""
                if 'timestamp' in data and data['timestamp']:
                    timestamp_str = data['timestamp'].strftime('%d/%m/%Y %H:%M:%S')
                
                writer.writerow({
                    'Nome': data.get('fullName', ''),
                    'CPF': data.get('cpf', ''),
                    'Status': data.get('status', 'Presente'),
                    'Região': data.get('region', ''),
                    'Cargo': data.get('churchPosition', ''),
                    'Pastor': data.get('pastorName', ''),
                    'Data': timestamp_str,
                    'Justificativa': data.get('absentReason', '')
                })
        
        print(f"  ✅ Dados exportados para: {filename}")
        print(f"  📊 Total de registros: {count}")
        
    except Exception as e:
        print(f"❌ Erro ao exportar CSV: {e}")

def main():
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        return
    
    # Processar argumentos
    if len(sys.argv) < 2:
        print("""
🔥 CONSULTA FIREBASE - SISTEMA DE PRESENÇA

📋 Comandos disponíveis:

  python3 consultar-firebase.py colecoes          - Lista todas as coleções
  python3 consultar-firebase.py listar [N]        - Lista últimos N registros
  python3 consultar-firebase.py stats             - Mostra estatísticas gerais  
  python3 consultar-firebase.py status [STATUS]   - Filtra por status
  python3 consultar-firebase.py exportar          - Exporta para CSV
  python3 consultar-firebase.py tudo              - Executa comandos principais

📝 Exemplos:
  python3 consultar-firebase.py listar 20
  python3 consultar-firebase.py status Justificado
  python3 consultar-firebase.py status Presente
        """)
        return
    
    comando = sys.argv[1].lower()
    
    try:
        if comando in ['colecoes', 'collections']:
            listar_colecoes(db)
            
        elif comando in ['listar', 'list']:
            limite = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            consultar_presencas(db, limite)
            
        elif comando in ['stats', 'estatisticas']:
            contar_registros(db)
            
        elif comando == 'status':
            if len(sys.argv) < 3:
                print("❌ Uso: python3 consultar-firebase.py status [Presente|Justificado|Ausente]")
                return
            consultar_por_status(db, sys.argv[2])
            
        elif comando in ['exportar', 'export']:
            exportar_csv(db)
            
        elif comando in ['tudo', 'all']:
            listar_colecoes(db)
            print("="*50)
            contar_registros(db)
            print("="*50)
            consultar_presencas(db, 5)
            
        else:
            print(f"❌ Comando não reconhecido: {comando}")
            print("💡 Use sem argumentos para ver a ajuda")
            
    except Exception as e:
        print(f"❌ Erro ao executar comando: {e}")

if __name__ == "__main__":
    main()
