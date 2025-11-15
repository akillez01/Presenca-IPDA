"use client";

import { PhotoCaptureField } from "@/components/attendance/photo-capture-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSystemConfig } from "@/hooks/use-realtime";
import { addAttendance } from "@/lib/actions";
import { deleteAttendancePhoto, uploadAttendancePhoto } from "@/lib/attendance-photo";
import { attendanceSchema, type AttendanceFormValues } from "@/lib/schemas";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

// Interface para configuração dos campos
interface FieldInfo {
  name: keyof AttendanceFormValues;
  label: string;
  placeholder: string;
  options?: string[];
}

type PhotoSelectionState = {
  file?: File;
  dataUrl?: string | null;
  preview?: string | null;
} | null;

// Função para criar campos do formulário dinamicamente
const createFormFields = (config: any): FieldInfo[] => [
  { name: "fullName", label: "Nome e Sobrenome", placeholder: "Digite o nome completo" },
  { name: "cpf", label: "CPF", placeholder: "Apenas números" },
  { 
    name: "reclassification", 
    label: "Reclassificação", 
    placeholder: "Selecione", 
    options: config?.reclassificationOptions || ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional']
  },
  { name: "pastorName", label: "Nome do Pastor", placeholder: "Digite o nome do pastor" },
  { name: "region", label: "Região", placeholder: "Digite a região" },
  { 
    name: "churchPosition", 
    label: "Cargo na Igreja", 
    placeholder: "Selecione", 
    options: (() => {
      const base = [
        'Conselheiro(a)',
        'Financeiro(a)',
        'Secretário(a)',
        'Pastor',
        'Presbítero',
        'Diácono',
        'Dirigente 1',
        'Dirigente 2',
        'Dirigente 3',
        'Cooperador(a)',
        'Líder Reação',
        'Líder Simplifique',
        'Líder Creative',
        'Líder Discipulus',
        'Líder Adore',
        'Auxiliar Expansão (a)',
        'Etda Professor(a)',
        'Coordenador Etda (a)',
        'Líder Galileu (a)',
        'Líder Adote uma alma (a)',
        'Membro',
        'Outro'
      ];
      if (config?.churchPositionOptions && config.churchPositionOptions.length > 0) {
        // Garante que 'Secretário(a)' sempre aparece
        const opts = [...config.churchPositionOptions];
        if (!opts.includes('Secretário(a)')) opts.splice(2, 0, 'Secretário(a)');
        return opts;
      }
      return base;
    })()
  },
  { name: "city", label: "Cidade", placeholder: "Digite a cidade" },
  { 
    name: "shift", 
    label: "Turno", 
    placeholder: "Selecione", 
    options: config?.shiftOptions || ['Manhã', 'Tarde', 'Noite']
  },
  // { 
  //   name: "status", 
  //   label: "Status", 
  //   placeholder: "Selecione", 
  //   options: config?.statusOptions || ['Presente', 'Ausente', 'Justificado']
  // },
] as const;

function PublicAttendanceFormContent() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoSelection, setPhotoSelection] = useState<PhotoSelectionState>(null);
  const { config, loading } = useSystemConfig();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      pastorName: "",
      city: "",
      reclassification: undefined,
      region: undefined,
      churchPosition: undefined,
      shift: undefined,
      status: 'Presente',
    },
  });

  const formFields = createFormFields(config);

  async function onSubmit(values: AttendanceFormValues) {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    let uploadedPhoto: { downloadURL: string; storagePath: string } | null = null;
    try {
      const payload: AttendanceFormValues = {
        ...values,
        status: values.status || 'Presente',
        photoUrl: undefined,
      };

      if (photoSelection?.file || photoSelection?.dataUrl) {
        try {
          setIsUploadingPhoto(true);
          uploadedPhoto = await uploadAttendancePhoto({
            cpf: values.cpf,
            file: photoSelection.file,
            dataUrl: photoSelection.dataUrl ?? undefined,
          });
          payload.photoUrl = uploadedPhoto.downloadURL;
        } catch (photoError) {
          console.error('❌ Erro ao enviar foto:', photoError);
          setError('Não foi possível enviar a foto. Verifique a conexão e tente novamente.');
          return;
        } finally {
          setIsUploadingPhoto(false);
        }
      }

      const result = await addAttendance(payload);
      if (result.success) {
        setSuccess(`✅ Obrigado, ${values.fullName}! Sua presença foi registrada com sucesso. Deus abençoe!`);
        form.reset();
        setPhotoSelection(null);
      } else {
        if (uploadedPhoto) {
          try {
            await deleteAttendancePhoto(uploadedPhoto.storagePath);
          } catch (cleanupError) {
            console.warn('⚠️ Falha ao remover foto após erro de cadastro público:', cleanupError);
          }
        }
        setError(result.error || "❌ Não foi possível registrar sua presença. Tente novamente ou procure um responsável.");
      }
    } catch (error) {
      if (uploadedPhoto) {
        try {
          await deleteAttendancePhoto(uploadedPhoto.storagePath);
        } catch (cleanupError) {
          console.warn('⚠️ Falha ao remover foto após erro inesperado no cadastro público:', cleanupError);
        }
      }
      setError("❌ Ocorreu um problema ao se comunicar com o serviço. Tente novamente mais tarde.");
    } finally {
      setIsUploadingPhoto(false);
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="max-w-3xl mx-auto">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Registro de Presença - IPDA</CardTitle>
        <CardDescription>
          Bem-vindo! Preencha os campos abaixo para registrar sua presença nesta reunião/culto. Não é necessário login.
          {config && (
            <span className="block text-xs text-muted-foreground mt-1">
              Última atualização das opções: {config.lastUpdated.toLocaleString('pt-BR')}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && <div className="mb-4 text-green-700 font-bold text-lg text-center bg-green-100 border border-green-300 rounded p-2 shadow-sm">{success}</div>}
        {error && <div className="mb-4 text-red-700 font-bold text-lg text-center bg-red-100 border border-red-300 rounded p-2 shadow-sm">{error}</div>}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formFields.map((fieldInfo) => (
                <FormField
                  key={fieldInfo.name}
                  control={form.control}
                  name={fieldInfo.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{fieldInfo.label}</FormLabel>
                      {fieldInfo.options ? (
                         <Select onValueChange={field.onChange} value={field.value ?? ""}>
                           <FormControl>
                             <SelectTrigger>
                               <SelectValue placeholder={fieldInfo.placeholder} />
                             </SelectTrigger>
                           </FormControl>
                           <SelectContent>
                             {fieldInfo.options.map((option: string) => (
                               <SelectItem key={option} value={option}>{option}</SelectItem>
                             ))}
                           </SelectContent>
                         </Select>
                      ) : (
                        <FormControl>
                          <Input placeholder={fieldInfo.placeholder} {...field} />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <PhotoCaptureField
              value={photoSelection?.preview ?? null}
              onChange={setPhotoSelection}
              disabled={isSubmitting || isUploadingPhoto}
              description="Anexe ou capture a foto do membro. Etapa opcional, mas ajuda na identificação."
            />
            {isUploadingPhoto && (
              <p className="text-xs text-muted-foreground">Enviando foto, aguarde...</p>
            )}
            <div className="flex justify-end">
                <Button type="submit" className="gap-2" disabled={isSubmitting || isUploadingPhoto}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registrando
                    </>
                  ) : (
                    <>
                      Registrar <Send className="h-4 w-4" />
                    </>
                  )}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function PublicAttendanceFormPage() {
  return <PublicAttendanceFormContent />;
}
