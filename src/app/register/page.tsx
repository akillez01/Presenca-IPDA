"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
    Building,
    Calendar,
    Clock,
    Fingerprint,
    Loader2,
    Map,
    MapPin,
    Phone,
    Send,
    User,
    UserCog,
    UserSquare
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { useToast } from "@/hooks/use-toast";
import { addMember } from "@/lib/actions";
import { deleteAttendancePhoto, uploadAttendancePhoto } from "@/lib/attendance-photo";
import { attendanceSchema, type AttendanceFormValues } from "@/lib/schemas";

// Interface para configuração dos campos
interface FieldInfo {
  name: keyof AttendanceFormValues;
  label: string;
  icon: any;
  placeholder: string;
  inputType?: 'text' | 'date';
  options?: string[];
}

type PhotoSelectionState = {
  file?: File;
  dataUrl?: string | null;
  preview?: string | null;
} | null;

// Função para criar campos do formulário dinamicamente
const createFormFields = (config: any): FieldInfo[] => [
  { name: "birthday", label: "Nascimento", icon: Calendar, placeholder: "Selecione a data", inputType: 'date' },
  { name: "fullName", label: "Nome e Sobrenome", icon: User, placeholder: "Digite o nome completo" },
  { name: "cpf", label: "CPF", icon: Fingerprint, placeholder: "Apenas números" },
  { 
    name: "reclassification", 
    label: "Reclassificação", 
    icon: UserCog, 
    placeholder: "Selecione", 
    options: config?.reclassificationOptions || ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional']
  },
  { name: "pastorName", label: "Nome do Pastor", icon: UserSquare, placeholder: "Digite o nome do pastor" },
  { name: "cfoCourse", label: "Curso", icon: UserSquare, placeholder: "Selecione", options: ["SIM", "NÃO"] },
  { 
    name: "region", 
    label: "Região", 
    icon: Map, 
    placeholder: "Digite a região"
  },
  { 
    name: "churchPosition", 
    label: "Cargo na Igreja", 
    icon: Building, 
    placeholder: "Selecione", 
    options: config?.churchPositionOptions || [
      'Conselheiro(a)',
      'Financeiro(a)',
      'Pastor',
      'Presbítero',
      'Diácono',
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
      'Outro',
      'Secretario(a)',
      'Auxiliar Adore',
      'Auxiliar Reação',
      'Auxiliar Simplifique ',
      'Auxiliar Discípulos',
      'Auxiliar Creative',
      'Regente',
      'Dirigente',
      'Dirigente 2',
      'Dirigente 3',
      'Atendente Livraria',
      'FInanceiro (a) Reviver'
    ]
  },
  { name: "city", label: "Cidade", icon: MapPin, placeholder: "Digite a cidade" },
  { 
    name: "shift", 
    label: "Turno", 
    icon: Clock, 
    placeholder: "Selecione", 
    options: config?.shiftOptions || ['Manhã', 'Tarde']
  },
  { name: "totvs", label: "TOTVS", icon: UserSquare, placeholder: "Digite o código TOTVS" },
  { name: "etda", label: "ETDA", icon: UserSquare, placeholder: "Digite o código ETDA" },
  { name: "phone", label: "Telefone / WhatsApp", icon: Phone, placeholder: "(XX) XXXXX-XXXX" },
] as const;

const httpsRequirementMessage =
  'Para usar a câmera neste ambiente hospedado, acesse a versão segura (HTTPS) do sistema. Sem HTTPS, os navegadores bloqueiam o uso da webcam.';

function AttendanceFormContent() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoSelection, setPhotoSelection] = useState<PhotoSelectionState>(null);
  const { config, loading } = useSystemConfig();

  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceSchema),
    defaultValues: {
      fullName: "",
      cpf: "",
      pastorName: "",
      cfoCourse: undefined,
      birthday: "",
      city: "",
      reclassification: undefined,
      region: "",
      churchPosition: undefined,
      shift: undefined,
      totvs: "",
      etda: "",
      phone: "",
      status: "Ausente",
    },
  });

  // Organiza os campos em linhas lógicas para melhor visualização
  const formFields = createFormFields(config);
  // Agrupamento em duas colunas verticais
  const col1Names: (keyof AttendanceFormValues)[] = [
    "fullName", "cpf", "pastorName", "region", "city"
  ];
  const col2Names: (keyof AttendanceFormValues)[] = [
    "birthday", "reclassification", "cfoCourse", "churchPosition", "shift"
  ];
  const additionalFields: (keyof AttendanceFormValues)[] = ["totvs", "etda", "phone"];
  const col1Fields = col1Names.map(name => formFields.find(f => f.name === name));
  const col2Fields = col2Names.map(name => formFields.find(f => f.name === name));

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: AttendanceFormValues) {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
    let uploadedPhoto: { downloadURL: string; storagePath: string; isLocal?: boolean } | null = null;
    try {
      // Normaliza o valor do cargo para garantir que 'regente' seja convertido para 'Regente'
      // Lista de cargos válidos exatamente como no enum
      const validPositions = [
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
        'Regente',
        'Membro',
        'Outro'
      ];
      // Normaliza o valor do cargo para garantir que sempre corresponda ao enum
      let normalizedPosition: AttendanceFormValues["churchPosition"] | undefined = values.churchPosition;
      if (normalizedPosition) {
        const found = validPositions.find(
          (p) => p.toLowerCase().trim() === String(normalizedPosition).toLowerCase().trim()
        );
        if (found) normalizedPosition = found as AttendanceFormValues["churchPosition"];
      }
      const normalizedValues: AttendanceFormValues = {
        ...values,
        birthday: values.birthday ? values.birthday.trim() : undefined,
        churchPosition: normalizedPosition,
        status: 'Ausente', // Forçar Ausente para não registrar presença no cadastro
        photoUrl: undefined
      };

      // Upload de foto (se houver)
      if (photoSelection?.file || photoSelection?.dataUrl) {
        console.log('📸 Foto selecionada detectada');
        console.log('   - Arquivo:', photoSelection?.file ? 'SIM' : 'NÃO');
        console.log('   - DataURL:', photoSelection?.dataUrl ? 'SIM' : 'NÃO');
        
        setIsUploadingPhoto(true);
        try {
          uploadedPhoto = await uploadAttendancePhoto({
            cpf: String(values.cpf ?? '').replace(/\D/g, ''),
            file: photoSelection?.file,
            dataUrl: photoSelection?.dataUrl ?? undefined
          });
          
          normalizedValues.photoUrl = uploadedPhoto.downloadURL;
          console.log('✅ Upload concluído!');
          console.log('   - photoUrl definido:', normalizedValues.photoUrl ? 'SIM' : 'NÃO');
          console.log('   - Tamanho:', normalizedValues.photoUrl ? Math.round(normalizedValues.photoUrl.length / 1024) + ' KB' : 'N/A');
          
          if (uploadedPhoto.isLocal) {
            console.log('💾 Modo: BASE64 (armazenamento local)');
            toast({
              title: "✅ Foto anexada",
              description: "A foto foi salva no cadastro (modo base64)",
              variant: "default"
            });
          } else {
            console.log('☁️ Modo: Firebase Storage');
            toast({
              title: "✅ Foto enviada",
              description: "A foto foi salva no Firebase Storage",
              variant: "default"
            });
          }
        } catch (photoError) {
          console.error('❌ Erro ao processar foto:', photoError);
          console.warn('⚠️ Prosseguindo com cadastro sem foto');
          normalizedValues.photoUrl = null;
          toast({
            title: "⚠️ Aviso",
            description: "Não foi possível salvar a foto. O cadastro será feito sem foto.",
            variant: "destructive"
          });
        } finally {
          setIsUploadingPhoto(false);
        }
      } else {
        console.log('ℹ️ Nenhuma foto selecionada');
        normalizedValues.photoUrl = null;
      }

      // Log final antes de enviar para o servidor
      console.log('🚀 Enviando dados para o servidor...');
      console.log('📋 Objeto normalizedValues:', {
        ...normalizedValues,
        photoUrl: normalizedValues.photoUrl ? 
          (normalizedValues.photoUrl.startsWith('data:') ? 
            `BASE64 (${Math.round(normalizedValues.photoUrl.length / 1024)} KB)` : 
            normalizedValues.photoUrl) : 
          'null'
      });

      const result = await addMember(normalizedValues);
      if (result.success) {
        setSuccess("✅ Membro cadastrado com sucesso! Este cadastro NÃO registrou presença. Para marcar presença, acesse 'Presença de Cadastrados'.");
        form.reset();
        setPhotoSelection(null);
      } else {
        if (uploadedPhoto) {
          try {
            await deleteAttendancePhoto(uploadedPhoto.storagePath);
          } catch (cleanupError) {
            console.warn('⚠️ Falha ao remover foto após erro de cadastro:', cleanupError);
          }
        }
        setError(result.error || "Não foi possível registrar sua presença. Tente novamente.");
      }
    } catch (err) {
      if (uploadedPhoto) {
        try {
          await deleteAttendancePhoto(uploadedPhoto.storagePath);
        } catch (cleanupError) {
          console.warn('⚠️ Falha ao remover foto após erro inesperado:', cleanupError);
        }
      }
      setError("Ocorreu um problema ao se comunicar com o serviço. Tente novamente mais tarde.");
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
    <div className="max-w-3xl mx-auto px-2 sm:px-4 animate-in fade-in duration-500">
      <div className="mb-3 sm:mb-4 flex justify-start animate-in slide-in-from-left duration-500">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 hover:scale-105 text-white px-3 sm:px-4 py-1 rounded text-sm transition-all duration-200" onClick={() => window.location.href = "/"}>Voltar</Button>
      </div>
      <Card className="animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '100ms' }}>
      <CardHeader className="p-4 sm:p-6 animate-in slide-in-from-top duration-500" style={{ animationDelay: '200ms' }}>
        <CardTitle className="text-lg sm:text-xl">Cadastrar Novo Membro</CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Preencha os campos abaixo para cadastrar um novo membro. <strong className="text-orange-600">Este cadastro NÃO registra presença.</strong> Para marcar presença, use a página "Presença de Cadastrados".
          {config && (
            <span className="block text-xs text-muted-foreground mt-1">
              Última atualização das opções: {config.lastUpdated.toLocaleString('pt-BR')}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {success && (
          <div className="mb-4 text-green-700 font-bold text-lg text-center bg-green-100 border border-green-300 rounded p-2 shadow-sm">{success}</div>
        )}
        {error && (
          <div className="mb-4 text-red-700 font-bold text-lg text-center bg-red-100 border border-red-300 rounded p-2 shadow-sm">{error}</div>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              <div className="flex flex-col gap-3 sm:gap-4">
                {col1Fields.map((fieldInfo, index) => fieldInfo && (
                  <FormField
                    key={fieldInfo.name}
                    control={form.control}
                    name={fieldInfo.name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <fieldInfo.icon className="h-4 w-4 text-muted-foreground" />
                          {fieldInfo.label}
                        </FormLabel>
                        {fieldInfo.inputType === 'date' ? (
                          <FormControl>
                            <Input type="date" placeholder={fieldInfo.placeholder} {...field} value={field.value ?? ""} />
                          </FormControl>
                        ) : fieldInfo.options ? (
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
                            <Input placeholder={fieldInfo.placeholder} {...field} value={field.value ?? ""} />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-4">
                {col2Fields.map((fieldInfo, index) => fieldInfo && (
                  <FormField
                    key={fieldInfo.name}
                    control={form.control}
                    name={fieldInfo.name}
                    render={({ field }) => (
                      <FormItem className="animate-in fade-in slide-in-from-right duration-500" style={{ animationDelay: `${300 + index * 50}ms` }}>
                        <FormLabel className="flex items-center gap-2">
                          <fieldInfo.icon className="h-4 w-4 text-muted-foreground" />
                          {fieldInfo.label}
                        </FormLabel>
                        {fieldInfo.inputType === 'date' ? (
                          <FormControl>
                            <Input type="date" placeholder={fieldInfo.placeholder} {...field} value={field.value ?? ""} />
                          </FormControl>
                        ) : fieldInfo.options ? (
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
                            <Input placeholder={fieldInfo.placeholder} {...field} value={field.value ?? ""} />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {additionalFields.map((fieldName, index) => {
                const fieldInfo = formFields.find(f => f.name === fieldName);
                return fieldInfo ? (
                  <FormField
                    key={fieldInfo.name}
                    control={form.control}
                    name={fieldInfo.name}
                    render={({ field }) => (
                      <FormItem className="animate-in fade-in slide-in-from-bottom duration-500" style={{ animationDelay: `${700 + index * 100}ms` }}>
                        <FormLabel className="flex items-center gap-2">
                          <fieldInfo.icon className="h-4 w-4 text-muted-foreground" />
                          {fieldInfo.label}
                        </FormLabel>
                        <FormControl>
                          <Input placeholder={fieldInfo.placeholder} {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null;
              })}
            </div>
            <div className="animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '900ms' }}>
              <PhotoCaptureField
                value={photoSelection?.preview ?? null}
                onChange={setPhotoSelection}
                disabled={isSubmitting || isUploadingPhoto}
                description="Anexe ou capture a foto do membro. Este passo é opcional, mas ajuda a identificar o cadastro."
                insecureFallbackMessage={httpsRequirementMessage}
              />
            </div>
            {isUploadingPhoto && (
              <p className="text-xs text-muted-foreground">Enviando foto, aguarde...</p>
            )}
            <div className="flex justify-end animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '700ms' }}>
                <Button type="submit" className="gap-2 hover:scale-105 transition-transform duration-200" disabled={isSubmitting || isUploadingPhoto}>
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
    </div>
  );
}

export default function AttendanceFormPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 sm:gap-8">
        <AttendanceFormContent />
      </div>
    </div>
  );
}
