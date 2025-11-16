"use client";

import { AuthGuard } from "@/components/auth/auth-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getAllPresencas, getAttendanceByCpf, updateAttendanceStatus } from "@/lib/actions";
import type { AttendanceRecord } from "@/lib/types";
import { BrowserMultiFormatReader } from "@zxing/library";
import { AlertCircle, Camera, CheckCircle, Clock, QrCode, Search, UserCheck, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// Força renderização dinâmica para evitar erros de hydration
export const dynamic = 'force-dynamic';

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
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);

  // Para entrada manual de CPF
  const [manualCpf, setManualCpf] = useState("");
  
  // Controle de câmeras
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(0);
  
  // Reader do ZXing
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const userStoppedRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingCameraRef = useRef(false); // Previne múltiplas chamadas simultâneas

  const loadRecentScans = useCallback(async () => {
    try {
      setRecentLoading(true);
      setRecentError(null);
      const records = await getAllPresencas();

      const sorted = [...records]
        .sort((a, b) => {
          const getTime = (record: any) => {
            const source = record.timestamp ?? record.createdAt ?? null;
            if (source instanceof Date) {
              return source.getTime();
            }
            if (typeof source === "number") {
              return source;
            }
            if (typeof source === "string") {
              const parsed = new Date(source).getTime();
              return isNaN(parsed) ? 0 : parsed;
            }
            return 0;
          };
          return getTime(b) - getTime(a);
        })
        .slice(0, 10)
        .map((record) => {
          const source = record.timestamp ?? record.createdAt ?? null;
          let horario = "";
          if (source instanceof Date) {
            horario = source.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          } else if (source) {
            const parsed = new Date(source);
            if (!isNaN(parsed.getTime())) {
              horario = parsed.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            }
          }
          return {
            cpf: record.cpf,
            nome: record.fullName,
            horario: horario || "--:--",
            status: record.status ?? "Presente"
          };
        });

      setRecentScans(sorted);
    } catch (err) {
      console.error("Erro ao carregar registros recentes:", err);
      setRecentError("Não foi possível carregar os registros recentes.");
    } finally {
      setRecentLoading(false);
      setRecentLoaded(true);
    }
  }, []);

  const startCamera = async () => {
    // Previne múltiplas chamadas simultâneas
    if (isStartingCameraRef.current) {
      console.log('⚠️ startCamera já está em execução, ignorando chamada duplicada');
      return;
    }
    
    isStartingCameraRef.current = true;
    
    try {
      setError("");
      userStoppedRef.current = false;
      
      console.log('📹 [QRScanner] Iniciando câmera...');
      
      // IMPORTANTE: Primeiro solicita permissão da câmera usando getUserMedia
      // Isso garante que os deviceIds sejam populados corretamente
      console.log('🔐 Solicitando permissão de câmera...');
      try {
        const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Para o stream temporário após obter permissão
        permissionStream.getTracks().forEach(track => track.stop());
        console.log('✅ Permissão de câmera concedida');
      } catch (permError) {
        console.error('❌ Permissão de câmera negada:', permError);
        setError('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.');
        return;
      }
      
      // Inicializa o reader do ZXing
      if (!codeReader.current) {
        codeReader.current = new BrowserMultiFormatReader();
      }

      // Agora lista as câmeras (após permissão, os deviceIds estarão disponíveis)
      const videoDevices = await codeReader.current.listVideoInputDevices();
      
      console.log('🎥 Câmeras encontradas:', videoDevices.length);
      videoDevices.forEach((device, idx) => {
        const deviceIdPreview = device.deviceId ? device.deviceId.slice(0, 8) + '...' : 'sem-id';
        console.log(`   ${idx + 1}. ${device.label || 'Video device ' + (idx + 1)} (${deviceIdPreview})`);
      });
      
      if (videoDevices.length === 0) {
        setError('Nenhuma câmera encontrada no dispositivo.');
        return;
      }
      
      // Filtra dispositivos que têm deviceId válido
      const validDevices = videoDevices.filter(device => device.deviceId);
      if (validDevices.length === 0) {
        console.error('❌ Nenhuma câmera com deviceId válido encontrada');
        setError('Erro ao acessar câmera. Tente recarregar a página e conceder permissão novamente.');
        return;
      }

      console.log('✅ Câmeras válidas:', validDevices.length);
      // Salva câmeras válidas disponíveis para permitir troca
      setAvailableCameras(validDevices);
      
      // Estratégia de seleção de câmera:
      // 1. Se usuário já selecionou uma câmera, usa essa
      // 2. Se tem múltiplas câmeras, prefere a última (geralmente webcam externa em desktop)
      // 3. Em mobile, prefere câmera traseira (environment)
      // 4. Fallback para primeira disponível
      let selectedIndex = selectedCameraIndex;
      
      // Primeira vez inicializando ou índice inválido
      if (selectedIndex >= validDevices.length) {
        if (validDevices.length > 1) {
          // Desktop com webcam externa: última câmera geralmente é a externa
          const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
          
          if (isMobile) {
            // Mobile: busca câmera traseira (environment)
            const backCameraIndex = validDevices.findIndex(device => 
              device.label.toLowerCase().includes('back') || 
              device.label.toLowerCase().includes('traseira') ||
              device.label.toLowerCase().includes('environment')
            );
            selectedIndex = backCameraIndex >= 0 ? backCameraIndex : validDevices.length - 1;
            console.log('📱 Mobile: usando câmera', backCameraIndex >= 0 ? 'traseira' : 'última disponível');
          } else {
            // Desktop: última câmera (geralmente webcam externa)
            selectedIndex = validDevices.length - 1;
            console.log('💻 Desktop: usando última câmera (geralmente externa)');
          }
        } else {
          // Apenas uma câmera disponível
          selectedIndex = 0;
          console.log('📹 Apenas uma câmera válida disponível');
        }
        setSelectedCameraIndex(selectedIndex);
      }
      
      const selectedDeviceId = validDevices[selectedIndex].deviceId;
      console.log('✅ Câmera selecionada:', validDevices[selectedIndex]?.label || 'Desconhecida');
      console.log('🎬 Device ID:', selectedDeviceId);
      
      if (!videoRef.current) {
        console.error('❌ videoRef.current é null!');
        setError('Erro interno: elemento de vídeo não encontrado.');
        return;
      }
      
      console.log('📹 Elemento video existe:', !!videoRef.current);
      console.log('🚀 Iniciando decodeFromVideoDevice...');
      
      // Inicia o escaneamento contínuo
      await codeReader.current.decodeFromVideoDevice(
        selectedDeviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            // QR Code detectado
            const qrData = result.getText();
            console.log('📱 QR Code detectado:', qrData);
            setResult(qrData);
            processQRCode(qrData);
          }
          if (error && error.name !== 'NotFoundException') {
            console.warn('⚠️ Erro no scanner:', error);
          }
        }
      );
      
      console.log('✅ Scanner iniciado com sucesso!');
      setIsScanning(true);
      
    } catch (err) {
      console.error('❌ Erro ao acessar câmera:', err);
      console.error('❌ Stack trace:', err instanceof Error ? err.stack : 'N/A');
      setError('Erro ao acessar a câmera. Verifique as permissões do navegador.');
    } finally {
      isStartingCameraRef.current = false;
    }
  };

  const stopCamera = (isAutomatic = false) => {
    console.log('🛑 Parando câmera...', isAutomatic ? '(automático)' : '(manual)');
    isStartingCameraRef.current = false; // Reset da flag
    
    if (codeReader.current) {
      codeReader.current.reset();
    }
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (!isAutomatic) {
      userStoppedRef.current = true;
    }
    setIsScanning(false);
  };

  const switchCamera = () => {
    if (availableCameras.length <= 1) return;
    
    // Para a câmera atual
    stopCamera(false);
    
    // Seleciona próxima câmera (ciclo)
    const nextIndex = (selectedCameraIndex + 1) % availableCameras.length;
    setSelectedCameraIndex(nextIndex);
    
    console.log('🔄 Trocando para câmera:', availableCameras[nextIndex]?.label || 'Desconhecida');
    
    // Reinicia com nova câmera após pequeno delay
    setTimeout(() => {
      startCamera();
    }, 300);
  };

  const processQRCode = async (qrData: string) => {
    if (loading) {
      return;
    }

    try {
      setError("");
      setSuccessMessage("");

      if (!qrData.startsWith('IPDA-PRESENCA:')) {
        setError('QR Code inválido. Use apenas QR Codes gerados pelo sistema IPDA.');
        return;
      }

      const cpf = qrData.replace('IPDA-PRESENCA:', '').trim();
      setResult(qrData);
      await registerPresenceByScan(cpf);
    } catch (err) {
      console.error('Erro ao processar QR Code:', err);
      setError('Erro ao processar QR Code.');
    }
  };

  const registerPresenceByScan = async (cpf: string) => {
    const cleanCpf = (cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('CPF inválido no QR Code.');
      return;
    }

    stopCamera(true);

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const person = await getAttendanceByCpf(cleanCpf);

      if (!person) {
        setError(`Pessoa com CPF ${cleanCpf} não encontrada no sistema.`);
        return;
      }

      await updateAttendanceStatus(person.id, "Presente");

      const novoScan = {
        cpf: person.cpf,
        nome: person.fullName,
        horario: new Date().toLocaleTimeString('pt-BR'),
        status: "Presente"
      };

      setRecentScans(prev => [novoScan, ...prev.slice(0, 9)]);
      setRecentError(null);
      setSuccessMessage(`✅ Presença registrada automaticamente para ${person.fullName}!`);
      setResult("");
      setFoundRecord(null);
      setManualCpf("");
      setJustificativa("");
      setStatus("Presente");
    } catch (err) {
      console.error('Erro ao registrar presença automaticamente:', err);
      setError('Erro ao registrar presença.');
    } finally {
      setLoading(false);
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      restartTimeoutRef.current = setTimeout(() => {
        setSuccessMessage("");
        restartTimeoutRef.current = null;
        if (!userStoppedRef.current) {
          void startCamera();
        }
      }, 1500);
    }
  };

  const lookupAttendanceByCpf = async (cpf: string) => {
    const cleanCpf = (cpf || '').replace(/\D/g, '');

    if (cleanCpf.length !== 11) {
      setFoundRecord(null);
      setError('Digite um CPF válido com 11 dígitos.');
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccessMessage("");

      const record = await getAttendanceByCpf(cleanCpf);

      if (!record) {
        setFoundRecord(null);
        setError(`Pessoa com CPF ${cleanCpf} não encontrada no sistema.`);
        return;
      }

      const normalizedStatus = record.status === 'Justificado'
        ? 'Justificado'
        : record.status === 'Ausente'
          ? 'Ausente'
          : 'Presente';

      setFoundRecord(record);
      setManualCpf(cleanCpf);
      setStatus(normalizedStatus);
      setJustificativa(normalizedStatus !== 'Presente' ? (record.absentReason ?? '') : '');
    } catch (err) {
      console.error('Erro ao buscar CPF:', err);
      setError('Erro ao buscar CPF informado.');
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
  setRecentError(null);
      
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
    if (manualCpf.length !== 11) {
      setFoundRecord(null);
    }
  }, [manualCpf]);

  useEffect(() => {
    void loadRecentScans();
  }, [loadRecentScans]);

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
                      {availableCameras.length > 0 && (
                        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-xs">
                          📹 {availableCameras[selectedCameraIndex]?.label || `Câmera ${selectedCameraIndex + 1}`}
                        </div>
                      )}
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
                    <>
                      <Button onClick={stopCamera} variant="outline" className="flex-1" size="lg">
                        Parar Scanner
                      </Button>
                      {availableCameras.length > 1 && (
                        <Button 
                          onClick={switchCamera} 
                          variant="outline" 
                          size="lg"
                          title="Trocar câmera"
                        >
                          🔄 Trocar
                        </Button>
                      )}
                    </>
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
                    onClick={() => lookupAttendanceByCpf(manualCpf)} 
                    disabled={loading || manualCpf.length !== 11}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Buscar CPF
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
                  {recentLoading && !recentLoaded ? (
                    <div className="text-center text-gray-500 py-4 space-y-2">
                      <div className="flex justify-center">
                        <div className="h-6 w-6 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
                      </div>
                      <p className="text-sm">Carregando registros recentes...</p>
                    </div>
                  ) : recentError ? (
                    <div className="text-center text-red-600 py-4 text-sm">
                      {recentError}
                    </div>
                  ) : recentScans.length === 0 ? (
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
                    <li>• Digite o CPF do membro e clique em "Buscar CPF"</li>
                    <li>• Confirme os dados e escolha status</li>
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
