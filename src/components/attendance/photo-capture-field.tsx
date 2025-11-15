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
}

export function PhotoCaptureField({
  label = 'Foto do membro',
  description = 'Envie uma imagem do dispositivo ou capture agora usando a câmera.',
  onChange,
  value,
  disabled = false,
}: PhotoCaptureFieldProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(value ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [hasCameraSupport, setHasCameraSupport] = useState(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }
    return Boolean(navigator.mediaDevices?.getUserMedia);
  });
  const cameraUnsupportedMessage = 'Este navegador não oferece suporte à captura por câmera. Utilize o upload de imagem.';

  useEffect(() => {
    setPreview(value ?? null);
  }, [value]);

  useEffect(() => {
    if (typeof navigator === 'undefined') {
      setHasCameraSupport(false);
      return;
    }
    const supported = Boolean(navigator.mediaDevices?.getUserMedia);
    setHasCameraSupport(supported);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = () => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    if (disabled) return;
    if (
      !hasCameraSupport ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError(cameraUnsupportedMessage);
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(mediaStream);
      setIsCameraActive(true);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
      stopCamera();
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    try {
      const blob = await fetch(dataUrl).then((response) => response.blob());
      const captureFile = new File([blob], `captura-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      setPreview(dataUrl);
      onChange({ file: captureFile, dataUrl, preview: dataUrl });
      setError(null);
    } catch (err) {
      console.error('Erro ao processar captura:', err);
      setError('Não foi possível capturar a imagem.');
    } finally {
      stopCamera();
    }
  };

  const handleFileSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Selecione um arquivo de imagem válido.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setPreview(result);
      onChange({ file, dataUrl: result, preview: result });
      setError(null);
      event.target.value = '';
    };
    reader.onerror = () => {
      setError('Não foi possível ler o arquivo selecionado.');
      event.target.value = '';
    };
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
        capture="environment"
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
            <Button type="button" variant="secondary" size="sm" onClick={handleCapture} disabled={disabled}>
              Capturar
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={startCamera}
              disabled={disabled || !hasCameraSupport}
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

        {!hasCameraSupport && (
          <p className="text-xs text-muted-foreground">
            Captura por câmera indisponível neste dispositivo. Faça o upload manual da foto.
          </p>
        )}
      </div>
    </div>
  );
}
