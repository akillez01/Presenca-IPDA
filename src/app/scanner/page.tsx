"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAttendanceRecords, updateAttendanceStatus } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { BrowserMultiFormatReader } from "@zxing/library";
import { AlertCircle, Camera, CheckCircle, Clock, QrCode, UserCheck, Users, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function QRScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [foundRecord, setFoundRecord] = useState<AttendanceRecord | null>(null);
  const [status, setStatus] = useState<"Presente" | "Justificado" | "Ausente">("Presente");
  const [justificativa, setJustificativa] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [recentScans, setRecentScans] = useState<{cpf: string, nome: string, horario: string, status: string}[]>([]);

  // Para entrada manual de CPF
  const [manualCpf, setManualCpf] = useState("");
  
  // Reader do ZXing
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);

  const startCamera = async () => {
    try {
      setError("");
      
      // Inicializa o reader do ZXing
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      // Obtém lista de câmeras
      const videoDevices = await codeReader.current.listVideoInputDevices();
      
      if (videoDevices.length === 0) {
        setError('Nenhuma câmera encontrada no dispositivo.');
        return;
      }

      // Usa a primeira câmera disponível (normalmente câmera traseira)
      const selectedDeviceId = videoDevices[0].deviceId;
      
      // Inicia o escaneamento contínuo
      await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current!,
        (result, error) => {
          if (result) {
            // QR Code detectado
            const qrData = result.getText();
            setResult(qrData);
            processQRCode(qrData);
          }
          if (error && error.name !== 'NotFoundException') {
            console.warn('Erro no scanner:', error);
          }
        }
      );
      
      setIsScanning(true);
      
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Erro ao acessar a câmera. Verifique as permissões do navegador.');
    }
  };

  const stopCamera = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
  };

  const processQRCode = async (qrData: string) => {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");
      
      // Parse do QR Code - formato: IPDA-PRESENCA:CPF
      if (!qrData.startsWith('IPDA-PRESENCA:')) {
        setError('QR Code inválido. Use apenas QR Codes gerados pelo sistema IPDA.');
        return;
      }

      const cpf = qrData.replace('IPDA-PRESENCA:', '').trim();
      await processCPF(cpf);
      
    } catch (err) {
      console.error('Erro ao processar QR Code:', err);
      setError('Erro ao processar QR Code.');
    } finally {
      setLoading(false);
    }
  };

  const processCPF = async (cpf: string) => {
    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");
      
      // Busca a pessoa pelo CPF
      const allRecords = await getAttendanceRecords();
      const person = allRecords.find(r => r.cpf === cpf);
      
      if (!person) {
        setError(`Pessoa com CPF ${cpf} não encontrada no sistema.`);
        return;
      }

      // Registra automaticamente como "Presente" quando QR Code é escaneado
      await updateAttendanceStatus(person.id, "Presente");
      
      // Adiciona aos escaneamentos recentes
      const novoScan = {
        cpf: person.cpf,
        nome: person.fullName,
        horario: new Date().toLocaleTimeString('pt-BR'),
        status: "Presente"
      };
      
      setRecentScans(prev => [novoScan, ...prev.slice(0, 9)]); // Mantém apenas os 10 mais recentes
      
      setSuccessMessage(`✅ Presença registrada automaticamente para ${person.fullName}!`);
      setResult("");
      
      // Limpa a mensagem após 3 segundos e volta a escanear
      setTimeout(() => {
        setSuccessMessage("");
        if (!isScanning) {
          startCamera(); // Reinicia o scanner automaticamente
        }
      }, 3000);
      
    } catch (err) {
      console.error('Erro ao buscar pessoa:', err);
      setError('Erro ao registrar presença.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAttendance = async () => {
    if (!foundRecord) return;

    try {
      setLoading(true);
      setError("");
      
      // Usa updateAttendanceStatus para atualizar o status da presença
      await updateAttendanceStatus(
        foundRecord.id, 
        status, 
        status !== 'Presente' ? justificativa : undefined
      );
      
      // Adiciona aos escaneamentos recentes
      const novoScan = {
        cpf: foundRecord.cpf,
        nome: foundRecord.fullName,
        horario: new Date().toLocaleTimeString('pt-BR'),
        status: status
      };
      
      setRecentScans(prev => [novoScan, ...prev.slice(0, 9)]);
      
      setSuccessMessage(`✅ Presença registrada com sucesso para ${foundRecord.fullName}!`);
      setFoundRecord(null);
      setManualCpf("");
      setJustificativa("");
      setStatus("Presente");
      
      // Limpa a mensagem após 3 segundos
      setTimeout(() => {
        setSuccessMessage("");
      }, 3000);
      
    } catch (err) {
      console.error('Erro ao registrar presença:', err);
      setError('Erro ao registrar presença.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-2 sm:py-4 px-1 sm:px-2 md:px-4">
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader className="text-center p-4 sm:p-6">
              <CardTitle className="flex items-center justify-center gap-2 text-lg sm:text-xl md:text-2xl">
                <QrCode className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                <span className="hidden sm:inline">Scanner de QR Code - Registro Automático de Presença</span>
                <span className="sm:hidden">Scanner QR Code</span>
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                <span className="hidden sm:inline">Escaneie o QR Code que os membros trouxeram para registrar presença automaticamente</span>
                <span className="sm:hidden">Escaneie o QR Code para registro</span>
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Mensagens */}
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {successMessage && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span>{successMessage}</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Scanner de QR Code */}
            <Card className="lg:col-span-2">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Camera className="h-5 w-5" />
                  Scanner de QR Code Automático
                </CardTitle>
                <CardDescription>
                  Aponte a câmera para o QR Code do membro para registrar presença automaticamente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Área da câmera */}
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-80 bg-gray-900 rounded-lg object-cover"
                    style={{ display: isScanning ? 'block' : 'none' }}
                  />
                  
                  {!isScanning && (
                    <div className="w-full h-80 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500">
                      <Camera className="h-16 w-16 mb-4" />
                      <p className="text-lg font-medium">Câmera desligada</p>
                      <p className="text-sm">Clique em "Iniciar Scanner" para começar</p>
                    </div>
                  )}
                  
                  {/* Overlay de escaneamento */}
                  {isScanning && (
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                        <div className="w-48 h-48 border-4 border-blue-500 border-dashed rounded-lg"></div>
                      </div>
                      <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                        <Zap className="h-4 w-4 inline mr-1" />
                        Scanner Ativo
                      </div>
                    </div>
                  )}
                </div>

                {/* Controles da câmera */}
                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startCamera} className="flex-1" size="lg">
                      <Camera className="h-4 w-4 mr-2" />
                      Iniciar Scanner
                    </Button>
                  ) : (
                    <Button onClick={stopCamera} variant="outline" className="flex-1" size="lg">
                      Parar Scanner
                    </Button>
                  )}
                </div>

                {/* Status do último scan */}
                {result && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Label className="text-sm font-medium">Último QR Code detectado:</Label>
                    <p className="text-sm font-mono break-all">{result}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entrada Manual + Histórico */}
            <div className="space-y-6">
              
              {/* Entrada Manual */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5" />
                    Entrada Manual de CPF
                  </CardTitle>
                  <CardDescription>
                    Use se o QR Code não funcionar
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  
                  {/* Campo CPF */}
                  <div>
                    <Label htmlFor="manual-cpf">CPF (apenas números)</Label>
                    <Input
                      id="manual-cpf"
                      type="text"
                      placeholder="12345678901"
                      value={manualCpf}
                      onChange={(e) => setManualCpf(e.target.value.replace(/\D/g, ''))}
                      maxLength={11}
                    />
                  </div>

                  {/* Botão buscar */}
                  <Button 
                    onClick={() => processCPF(manualCpf)} 
                    disabled={loading || manualCpf.length !== 11}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <QrCode className="h-4 w-4 mr-2" />
                        Registrar por CPF
                      </>
                    )}
                  </Button>

                  {/* Dados da pessoa encontrada (para entrada manual com opções) */}
                  {foundRecord && (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold">👤 Pessoa Encontrada:</h3>
                      
                      <div className="grid grid-cols-1 gap-2 text-sm">
                        <div><strong>Nome:</strong> {foundRecord.fullName}</div>
                        <div><strong>CPF:</strong> {foundRecord.cpf}</div>
                        <div><strong>Pastor:</strong> {foundRecord.pastorName}</div>
                        <div><strong>Cargo:</strong> {foundRecord.churchPosition}</div>
                        <div><strong>Região:</strong> {foundRecord.region}</div>
                        <div><strong>Cidade:</strong> {foundRecord.city}</div>
                      </div>

                      {/* Seleção de status */}
                      <div>
                        <Label htmlFor="status">Status da Presença</Label>
                        <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Presente">✅ Presente</SelectItem>
                            <SelectItem value="Justificado">⚠️ Justificado</SelectItem>
                            <SelectItem value="Ausente">❌ Ausente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Justificativa (se não presente) */}
                      {status !== 'Presente' && (
                        <div>
                          <Label htmlFor="justificativa">Justificativa</Label>
                          <Input
                            id="justificativa"
                            placeholder="Digite a justificativa..."
                            value={justificativa}
                            onChange={(e) => setJustificativa(e.target.value)}
                          />
                        </div>
                      )}

                      {/* Botão registrar */}
                      <Button 
                        onClick={handleSubmitAttendance}
                        disabled={loading}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                            Registrando...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Registrar Presença
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Histórico de Escaneamentos Recentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Registros Recentes
                  </CardTitle>
                  <CardDescription>
                    Últimas presenças registradas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {recentScans.length === 0 ? (
                    <div className="text-center text-gray-500 py-4">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum registro ainda</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {recentScans.map((scan, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{scan.nome}</p>
                            <p className="text-xs text-gray-600">CPF: {scan.cpf}</p>
                          </div>
                          <div className="text-right">
                            <div className={`text-xs px-2 py-1 rounded-full ${
                              scan.status === 'Presente' ? 'bg-green-100 text-green-700' :
                              scan.status === 'Justificado' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {scan.status}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{scan.horario}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Como Usar o Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">🎯 Para Membros:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Baixe seu QR Code nos relatórios</li>
                    <li>• Salve no celular ou imprima</li>
                    <li>• Apresente na entrada da sede</li>
                    <li>• Aguarde o responsável escanear</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">🎯 Scanner Automático:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Clique em "Iniciar Scanner"</li>
                    <li>• Aponte para o QR Code do membro</li>
                    <li>• Presença é registrada automaticamente</li>
                    <li>• Sistema continua escaneando</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">⌨️ Entrada Manual:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Use se QR Code não funcionar</li>
                    <li>• Digite o CPF do membro</li>
                    <li>• Escolha status (Presente/Justificado/Ausente)</li>
                    <li>• Clique em "Registrar Presença"</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
