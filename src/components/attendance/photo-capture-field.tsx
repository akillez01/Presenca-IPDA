'use client';

import { Camera, CameraOff, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface PhotoSelection {
  file?: File;
  dataUrl?: string | null;
  preview?: string | null;
}

interface PhotoCaptureFieldProps {
  label?: string;
  description?: string;
  onChange: (selection: PhotoSelection | null) => void;
  value?: string | null;
  disabled?: boolean;
  insecureFallbackMessage?: string;
}

export function PhotoCaptureField({
  label = 'Foto do membro',
  description = 'Envie uma imagem do dispositivo ou capture agora usando a câmera.',
  onChange,
  value,
  disabled = false,
  insecureFallbackMessage,
}: PhotoCaptureFieldProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraApiAvailable, setCameraApiAvailable] = useState(() => {
    if (typeof navigator === 'undefined') {
      return false;
    }
    return typeof navigator.mediaDevices?.getUserMedia === 'function';
  });
  const [isSecureContext, setIsSecureContext] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.isSecureContext;
  });
  const cameraUnsupportedMessage = 'Este navegador não oferece suporte à captura por câmera. Utilize o upload de imagem.';
  const insecureContextMessage = insecureFallbackMessage || 'Para usar a câmera, acesse o sistema via HTTPS ou localhost. Navegadores bloqueiam o uso de câmera em conexões HTTP inseguros.';

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setCameraApiAvailable(false);
      return;
    }
    const secure = typeof window !== 'undefined' && window.isSecureContext;
    setIsSecureContext(secure);
    const apiIsAvailable = typeof navigator.mediaDevices?.getUserMedia === 'function';
    setCameraApiAvailable(apiIsAvailable);
    if (!secure && apiIsAvailable) {
      setError(insecureContextMessage);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configura o vídeo quando o stream e o videoRef estão prontos
  useEffect(() => {
    if (!stream || !videoRef.current || !isCameraActive) return;
    
    console.log('🎬 useEffect: Configurando video com stream...');
    const videoElement = videoRef.current;
    
    let isReadySet = false;
    const checkVideoReady = () => {
      if (isReadySet) return true;
      
      const isReady = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
      if (isReady) {
        console.log('✅ Vídeo pronto para captura:', {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          readyState: videoElement.readyState
        });
        setIsVideoReady(true);
        isReadySet = true;
      }
      return isReady;
    };

    const setupVideoReadyListeners = () => {
      const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing'];
      
      const handler = () => {
        console.log('🎬 Evento de vídeo disparado');
        checkVideoReady();
      };
      
      events.forEach(event => {
        videoElement.addEventListener(event, handler, { once: true });
      });
      
      let attempts = 0;
      const maxAttempts = 60;
      const pollInterval = setInterval(() => {
        attempts++;
        console.log(`🔍 Polling vídeo (${attempts}/${maxAttempts})...`);
        
        if (checkVideoReady() || attempts >= maxAttempts) {
          clearInterval(pollInterval);
          if (attempts >= maxAttempts && !isReadySet) {
            console.warn('⚠️ Timeout aguardando vídeo ficar pronto');
          }
        }
      }, 50);
    };

    const playStream = async () => {
      try {
        console.log('▶️ Tentando iniciar reprodução do vídeo...');
        await videoElement.play();
        console.log('✅ Reprodução iniciada com sucesso');
        
        if (!checkVideoReady()) {
          console.log('📡 Configurando listeners para detectar quando vídeo estiver pronto...');
          setupVideoReadyListeners();
        }
      } catch (playError) {
        console.warn('⚠️ Reprodução automática falhou:', playError);
        console.log('🔄 Tentando novamente em 250ms...');
        setTimeout(async () => {
          try {
            await videoElement.play();
            console.log('✅ Reprodução iniciada na segunda tentativa');
            
            if (!checkVideoReady()) {
              console.log('📡 Configurando listeners (2ª tentativa)...');
              setupVideoReadyListeners();
            }
          } catch (retryError) {
            console.error('❌ Falha definitiva na reprodução:', retryError);
            setError('Não foi possível iniciar a visualização da câmera.');
          }
        }, 250);
      }
    };

    videoElement.srcObject = stream;
    videoElement.muted = true;
    videoElement.autoplay = true;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.setAttribute('webkit-playsinline', 'true');
    videoElement.style.visibility = 'visible';
    videoElement.style.opacity = '1';
    console.log('📺 Elemento <video> configurado no useEffect, iniciando play...');

    void playStream();
  }, [stream, isCameraActive]);

  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      const videoElement = videoRef.current;
      videoElement.pause();
      videoElement.srcObject = null;
    }
    setStream(null);
    setIsCameraActive(false);
    setIsVideoReady(false); // Reset do estado quando parar a câmera
  };

  const startCamera = async () => {
    if (disabled) return;
    
    // Debug: Log do ambiente
    console.group('📹 [PhotoCapture] Iniciando câmera');
    console.log('🔍 Navigator disponível:', typeof navigator !== 'undefined');
    console.log('🔍 getUserMedia disponível:', typeof navigator?.mediaDevices?.getUserMedia === 'function');
    console.log('🔍 Contexto seguro (HTTPS):', typeof window !== 'undefined' && window.isSecureContext);
    console.log('🔍 User Agent:', navigator?.userAgent || 'N/A');
    
    if (!cameraApiAvailable || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.error('❌ API de câmera não disponível');
      console.groupEnd();
      setError(cameraUnsupportedMessage);
      return;
    }
    if (!isSecureContext) {
      console.error('❌ Contexto inseguro (precisa HTTPS)');
      console.groupEnd();
      setError(insecureContextMessage);
      return;
    }
    
    try {
      // Listar dispositivos disponíveis
      let videoDevices: MediaDeviceInfo[] = [];
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        videoDevices = devices.filter(d => d.kind === 'videoinput');
        console.log('🎥 Dispositivos de vídeo encontrados:', videoDevices.length);
        videoDevices.forEach((device, idx) => {
          console.log(`   ${idx + 1}. ${device.label || 'Câmera ' + (idx + 1)} (${device.deviceId.slice(0, 8)}...)`);
        });
        setAvailableCameras(videoDevices);
      } catch (enumError) {
        console.warn('⚠️ Não foi possível listar dispositivos:', enumError);
      }
      
      // Garante que qualquer stream anterior seja finalizado antes de solicitar um novo
      stopCamera();

      let mediaStream: MediaStream | null = null;

      // Estratégia: tenta em ordem de preferência
      const constraintStrategies: MediaStreamConstraints[] = [];
      
      // 1. Se usuário selecionou uma câmera específica, usa ela
      if (selectedCameraId) {
        console.log('🎯 Usando câmera selecionada pelo usuário:', selectedCameraId.slice(0, 8) + '...');
        constraintStrategies.push({ 
          video: { deviceId: { exact: selectedCameraId } } 
        });
      }
      // 2. Se tem webcam externa (última na lista), tenta ela primeiro
      else if (videoDevices.length > 1) {
        console.log('🔄 Múltiplas câmeras detectadas, priorizando última (geralmente externa)');
        const externalCamera = videoDevices[videoDevices.length - 1];
        constraintStrategies.push({ 
          video: { deviceId: { exact: externalCamera.deviceId } } 
        });
      }
      
      // 3. Tenta câmera traseira (mobile)
      constraintStrategies.push({ video: { facingMode: 'environment' } });
      
      // 4. Tenta qualquer câmera
      constraintStrategies.push({ video: true });
      
      // 5. Tenta câmera frontal
      constraintStrategies.push({ video: { facingMode: 'user' } });

      // Tenta cada estratégia
      for (let i = 0; i < constraintStrategies.length && !mediaStream; i++) {
        const constraints = constraintStrategies[i];
        console.log(`🔄 Tentativa ${i + 1}/${constraintStrategies.length}:`, constraints);
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log(`✅ Câmera obtida na tentativa ${i + 1}`);
          break;
        } catch (error) {
          console.warn(`⚠️ Tentativa ${i + 1} falhou:`, error instanceof Error ? error.message : error);
        }
      }

      if (!mediaStream || !mediaStream.getVideoTracks().length) {
        console.error('❌ Nenhuma câmera disponível após todas as tentativas');
        console.groupEnd();
        setError('Não foi possível acessar nenhuma câmera. Verifique as permissões.');
        return;
      }

      // Log das tracks do stream
      const videoTracks = mediaStream.getVideoTracks();
      console.log('📹 Stream obtido:');
      console.log('   - Tracks de vídeo:', videoTracks.length);
      videoTracks.forEach((track, idx) => {
        console.log(`   - Track ${idx + 1}:`, {
          label: track.label,
          enabled: track.enabled,
          readyState: track.readyState,
          settings: track.getSettings()
        });
      });

      console.log('🔧 Configurando estados...');
      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);
      console.log('✅ Estados configurados');

      console.log('🎬 videoRef.current existe?', !!videoRef.current);
      if (videoRef.current) {
        console.log('📺 Iniciando configuração do elemento video...');
        const videoElement = videoRef.current;
        videoElement.srcObject = mediaStream;
        videoElement.muted = true;
        videoElement.autoplay = true;
        videoElement.setAttribute('playsinline', 'true');
        videoElement.setAttribute('webkit-playsinline', 'true');
        videoElement.style.visibility = 'visible';
        videoElement.style.opacity = '1';
        console.log('📺 Elemento <video> configurado');

        let isReadySet = false;
        const checkVideoReady = () => {
          if (isReadySet) return true; // Evita múltiplas chamadas
          
          const isReady = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
          if (isReady) {
            console.log('✅ Vídeo pronto para captura:', {
              width: videoElement.videoWidth,
              height: videoElement.videoHeight,
              readyState: videoElement.readyState
            });
            setIsVideoReady(true);
            isReadySet = true;
          }
          return isReady;
        };

        // Múltiplos eventos para garantir detecção
        const setupVideoReadyListeners = () => {
          const events = ['loadedmetadata', 'loadeddata', 'canplay', 'playing'];
          
          const handler = () => {
            console.log('🎬 Evento de vídeo disparado');
            checkVideoReady();
          };
          
          events.forEach(event => {
            videoElement.addEventListener(event, handler, { once: true });
          });
          
          // Polling como fallback (verifica a cada 50ms por até 3 segundos)
          let attempts = 0;
          const maxAttempts = 60;
          const pollInterval = setInterval(() => {
            attempts++;
            console.log(`🔍 Polling vídeo (${attempts}/${maxAttempts})...`);
            
            if (checkVideoReady() || attempts >= maxAttempts) {
              clearInterval(pollInterval);
              if (attempts >= maxAttempts && !isReadySet) {
                console.warn('⚠️ Timeout aguardando vídeo ficar pronto');
              }
            }
          }, 50);
        };

        const playStream = async () => {
          try {
            console.log('▶️ Tentando iniciar reprodução do vídeo...');
            await videoElement.play();
            console.log('✅ Reprodução iniciada com sucesso');
            
            // Verifica imediatamente
            if (!checkVideoReady()) {
              console.log('📡 Configurando listeners para detectar quando vídeo estiver pronto...');
              setupVideoReadyListeners();
            }
            
            console.groupEnd();
          } catch (playError) {
            console.warn('⚠️ Reprodução automática falhou:', playError);
            console.log('🔄 Tentando novamente em 250ms...');
            setTimeout(() => {
              void videoElement.play()
                .then(() => {
                  console.log('✅ Reprodução iniciada na segunda tentativa');
                  
                  if (!checkVideoReady()) {
                    console.log('� Configurando listeners (2ª tentativa)...');
                    setupVideoReadyListeners();
                  }
                  
                  console.groupEnd();
                })
                .catch((retryError) => {
                  console.error('❌ Falha definitiva na reprodução:', retryError);
                  console.groupEnd();
                  setError('Não foi possível iniciar a visualização da câmera. Verifique permissões do navegador.');
                });
            }, 250);
          }
        };

        // Chama playStream (código movido para useEffect mas mantido como fallback)
        console.log('🚀 Iniciando reprodução do vídeo diretamente...');
        void playStream();
      }
      
      console.groupEnd();
    } catch (err) {
      console.error('❌ [PhotoCapture] Erro ao acessar câmera:', err);
      if (err instanceof DOMException) {
        console.error('   - Nome do erro:', err.name);
        console.error('   - Mensagem:', err.message);
      }
      console.groupEnd();
      
      const message = err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Permissão de câmera negada. Verifique as configurações do navegador e tente novamente.'
        : err instanceof DOMException && err.name === 'NotFoundError'
        ? 'Nenhuma câmera encontrada neste dispositivo.'
        : err instanceof DOMException && err.name === 'NotReadableError'
        ? 'A câmera está sendo usada por outro aplicativo. Feche outros aplicativos e tente novamente.'
        : 'Não foi possível acessar a câmera. Verifique as permissões ou se outro aplicativo está utilizando a câmera.';
      setError(message);
      stopCamera();
    }
  };

  const handleCapture = async () => {
    console.group('📸 [PhotoCapture] Capturando foto');
    if (!videoRef.current) {
      console.error('❌ Referência do vídeo não encontrada');
      console.groupEnd();
      return;
    }
    
    const video = videoRef.current;
    console.log('📹 Dimensões do vídeo:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState
    });
    
    // Verifica se o vídeo tem dimensões válidas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('❌ Vídeo sem dimensões válidas. Aguarde o vídeo carregar completamente.');
      console.groupEnd();
      setError('Aguarde o vídeo carregar completamente antes de capturar.');
      return;
    }
    
    const canvas = document.createElement('canvas');
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    console.log('🖼️ Canvas criado:', { width, height });
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('❌ Não foi possível obter contexto 2D do canvas');
      console.groupEnd();
      return;
    }
    
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    console.log('✅ DataURL gerado:', {
      tamanho: Math.round(dataUrl.length / 1024) + ' KB',
      formato: dataUrl.substring(0, 30) + '...'
    });

    try {
      const blob = await fetch(dataUrl).then((response) => response.blob());
      const captureFile = new File([blob], `captura-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      console.log('📦 Arquivo criado:', {
        nome: captureFile.name,
        tipo: captureFile.type,
        tamanho: Math.round(captureFile.size / 1024) + ' KB'
      });
      
      setPreview(dataUrl);
      onChange({ file: captureFile, dataUrl, preview: dataUrl });
      setError(null);
      console.log('✅ Captura concluída com sucesso');
      console.groupEnd();
    } catch (err) {
      console.error('❌ Erro ao processar captura:', err);
      console.groupEnd();
      setError('Não foi possível capturar a imagem.');
    } finally {
      stopCamera();
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.group('📁 [PhotoCapture] Selecionando arquivo');
    if (disabled) {
      console.log('⚠️ Componente desabilitado');
      console.groupEnd();
      return;
    }
    
    const file = event.target.files?.[0];
    if (!file) {
      console.log('ℹ️ Nenhum arquivo selecionado');
      console.groupEnd();
      return;
    }

    console.log('📄 Arquivo selecionado:', {
      nome: file.name,
      tipo: file.type,
      tamanho: Math.round(file.size / 1024) + ' KB'
    });

    if (!file.type.startsWith('image/')) {
      console.error('❌ Tipo de arquivo inválido:', file.type);
      console.groupEnd();
      setError('Selecione um arquivo de imagem válido.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      console.log('✅ Arquivo lido com sucesso:', {
        tamanhoDataURL: result ? Math.round(result.length / 1024) + ' KB' : 'N/A'
      });
      setPreview(result);
      onChange({ file, dataUrl: result, preview: result });
      setError(null);
      event.target.value = '';
      console.groupEnd();
    };
    reader.onerror = (err) => {
      console.error('❌ Erro ao ler arquivo:', err);
      console.groupEnd();
      setError('Não foi possível ler o arquivo selecionado.');
      event.target.value = '';
    };
    
    console.log('📖 Iniciando leitura do arquivo...');
    reader.readAsDataURL(file);
  };

  const handleClear = () => {
    setPreview(null);
    onChange(null);
    setError(null);
    stopCamera();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        // Removido capture="environment" para permitir escolha entre câmera e galeria
        // Em mobile, o atributo capture força apenas câmera, bloqueando galeria
        className="hidden"
        onChange={handleFileSelection}
        disabled={disabled}
      />
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Camera className="h-4 w-4" />
          {label}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="border rounded-md p-4 space-y-3 bg-muted/40">
        <div className="flex justify-center">
          <div className="relative w-40 sm:w-44">
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-dashed border-muted-foreground/40 bg-background">
              {isCameraActive ? (
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted />
              ) : preview ? (
                <img src={preview} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
              ) : (
                <img
                  src="/images/placeholder-avatar-3x4.svg"
                  alt="Pré-visualização não disponível"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <span className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Selecionar foto
            </span>
          </Button>

          {isCameraActive ? (
            <>
              <Button 
                type="button" 
                variant="secondary" 
                size="sm" 
                onClick={handleCapture} 
                disabled={disabled || !isVideoReady}
                title={!isVideoReady ? 'Aguardando vídeo carregar...' : 'Capturar foto'}
              >
                {!isVideoReady ? '⏳ Aguarde...' : 'Capturar'}
              </Button>
              {availableCameras.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentIndex = availableCameras.findIndex(c => c.deviceId === selectedCameraId);
                    const nextIndex = (currentIndex + 1) % availableCameras.length;
                    setSelectedCameraId(availableCameras[nextIndex].deviceId);
                    startCamera();
                  }}
                  disabled={disabled}
                  title="Trocar câmera"
                >
                  🔄 Trocar
                </Button>
              )}
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={startCamera}
              disabled={disabled || !cameraApiAvailable}
            >
              Usar câmera
            </Button>
          )}

          {isCameraActive && (
            <Button type="button" variant="ghost" size="sm" onClick={stopCamera} disabled={disabled}>
              <CameraOff className="h-4 w-4" />
            </Button>
          )}

          {preview && (
            <Button type="button" variant="destructive" size="sm" onClick={handleClear} disabled={disabled}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!cameraApiAvailable && (
          <p className="text-xs text-muted-foreground">
            Captura por câmera indisponível neste dispositivo. Faça o upload manual da foto.
          </p>
        )}

        {cameraApiAvailable && !isSecureContext && (
          <p className="text-xs text-muted-foreground">{insecureContextMessage}</p>
        )}
      </div>
    </div>
  );
}
