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
import { AlertCircle, Camera, CheckCircle, QrCode, UserCheck, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function QRScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [foundRecord, setFoundRecord] = useState<AttendanceRecord | null>(null);
  const [status, setStatus] = useState<"Presente" | "Justificado" | "Ausente">("Presente");
  const [justificativa, setJustificativa] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Para entrada manual de CPF
  const [manualCpf, setManualCpf] = useState("");

  const startCamera = async () => {
    try {
      setError("");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Usa câmera traseira se disponível
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setStream(mediaStream);
      setIsScanning(true);
      
      // Inicia o processo de escaneamento
      scanQRCode();
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Erro ao acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsScanning(false);
  };

  const scanQRCode = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        console.log('QR Code detectado:', code.data);
        setResult(code.data);
        
        // Para o scanner e processa o QR Code automaticamente
        stopCamera();
        processQRCode(code.data);
      } else {
        // Continua escaneando se não encontrou QR Code
        setTimeout(() => {
          if (isScanning) {
            scanQRCode();
          }
        }, 100);
      }
    } catch (err) {
      console.error('Erro ao escanear QR Code:', err);
      setTimeout(() => {
        if (isScanning) {
          scanQRCode();
        }
      }, 100);
    }
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

      setFoundRecord(person);
      
    } catch (err) {
      console.error('Erro ao buscar pessoa:', err);
      setError('Erro ao buscar dados da pessoa.');
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
      <div className="min-h-screen bg-gray-50 py-4 px-2 md:px-4">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Header */}
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <QrCode className="h-8 w-8 text-blue-600" />
                Scanner de QR Code - Registro de Presença
              </CardTitle>
              <CardDescription>
                Escaneie o QR Code gerado nos relatórios ou digite o CPF manualmente para registrar presença
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Scanner de QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Scanner de QR Code
                </CardTitle>
                <CardDescription>
                  Use a câmera para escanear QR Codes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Área da câmera */}
                <div className="relative">
                  <video
                    ref={videoRef}
                    className="w-full h-64 bg-gray-900 rounded-lg object-cover"
                    style={{ display: isScanning ? 'block' : 'none' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="hidden"
                  />
                  
                  {!isScanning && (
                    <div className="w-full h-64 bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-500">
                      <Camera className="h-16 w-16 mb-4" />
                      <p>Câmera desligada</p>
                      <p className="text-sm">Clique em "Iniciar Câmera" para começar</p>
                    </div>
                  )}
                </div>

                {/* Controles da câmera */}
                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startCamera} className="flex-1" size="lg">
                      <Camera className="h-4 w-4 mr-2" />
                      Iniciar Câmera
                    </Button>
                  ) : (
                    <Button onClick={stopCamera} variant="outline" className="flex-1" size="lg">
                      Parar Câmera
                    </Button>
                  )}
                </div>

                {/* Resultado do scan */}
                {result && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <Label className="text-sm font-medium">QR Code detectado:</Label>
                    <p className="text-sm font-mono">{result}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Entrada Manual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  Entrada Manual de CPF
                </CardTitle>
                <CardDescription>
                  Digite o CPF para buscar e registrar presença
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
                      Buscando...
                    </>
                  ) : (
                    <>
                      <QrCode className="h-4 w-4 mr-2" />
                      Buscar por CPF
                    </>
                  )}
                </Button>

                {/* Dados da pessoa encontrada */}
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
          </div>

          {/* Instruções */}
          <Card>
            <CardHeader>
              <CardTitle>📋 Como Usar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-semibold mb-2">🎯 Scanner de QR Code:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Clique em "Iniciar Câmera"</li>
                    <li>• Permita o acesso à câmera</li>
                    <li>• Aponte para o QR Code gerado nos relatórios</li>
                    <li>• O sistema detectará e processará automaticamente</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">⌨️ Entrada Manual:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Digite o CPF (apenas números)</li>
                    <li>• Clique em "Buscar por CPF"</li>
                    <li>• Selecione o status da presença</li>
                    <li>• Adicione justificativa se necessário</li>
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
