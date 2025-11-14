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
    Send,
    User,
    UserCog,
    UserSquare
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

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
import { useAuth } from '@/hooks/use-auth';
import { useSystemConfig } from "@/hooks/use-realtime";
import { useToast } from "@/hooks/use-toast";
import { addAttendance } from "@/lib/actions";
import { UserType } from "@/lib/auth";
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
  { name: "cfoCourse", label: "Curso CFO", icon: UserSquare, placeholder: "Selecione", options: ["SIM", "NÃO"] },
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
] as const;

function AttendanceFormContent() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      status: "Presente",
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
  const col1Fields = col1Names.map(name => formFields.find(f => f.name === name));
  const col2Fields = col2Names.map(name => formFields.find(f => f.name === name));

  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(values: AttendanceFormValues) {
    setIsSubmitting(true);
    setSuccess(null);
    setError(null);
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
        status: values.status || 'Presente'
      };
      const result = await addAttendance(normalizedValues);
      if (result.success) {
        setSuccess("Cadastro realizado com sucesso!");
        form.reset();
      } else {
        setError(result.error || "Não foi possível registrar sua presença. Tente novamente.");
      }
    } catch (err) {
      setError("Ocorreu um problema ao se comunicar com o serviço. Tente novamente mais tarde.");
    } finally {
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
    <div className="max-w-3xl mx-auto px-2 sm:px-4">
      <div className="mb-3 sm:mb-4 flex justify-start">
        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white px-3 sm:px-4 py-1 rounded text-sm" onClick={() => window.location.href = "/"}>Voltar</Button>
      </div>
      <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-lg sm:text-xl">Registrar Cadastro</CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Preencha os campos abaixo para registrar a presença.
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
                {col1Fields.map((fieldInfo) => fieldInfo && (
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
                            <Input type="date" placeholder={fieldInfo.placeholder} {...field} />
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
                            <Input placeholder={fieldInfo.placeholder} {...field} />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <div className="flex flex-col gap-4">
                {col2Fields.map((fieldInfo) => fieldInfo && (
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
                            <Input type="date" placeholder={fieldInfo.placeholder} {...field} />
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
                            <Input placeholder={fieldInfo.placeholder} {...field} />
                          </FormControl>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end">
                <Button type="submit" className="gap-2" disabled={isSubmitting}>
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
  const { user, loading } = useAuth();
  const userPermissions = Array.isArray(user?.permissions) ? user?.permissions : [];
  const userType = (user as any)?.userType as UserType | undefined;
  
  // Verificar se é usuário autorizado (tanto super usuários quanto usuários básicos podem registrar presença)
  const isAuthorizedUser = !!user && (
    userPermissions.includes('register') ||
    userType === UserType.SUPER_USER ||
    userType === UserType.EDITOR_USER ||
    userType === UserType.BASIC_USER ||
    user?.role === 'admin' ||
    user?.role === 'editor' ||
    user?.role === 'basic_user'
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </main>
    );
  }

  if (!isAuthorizedUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl sm:text-2xl font-bold mb-2">Acesso restrito</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Apenas usuários autorizados podem registrar presença.
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            Se você tem uma conta de usuário básico e ainda não consegue acessar,
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            contacte um administrador para verificar suas permissões.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-2 sm:p-4">
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 sm:gap-8">
        <AttendanceFormContent />
      </div>
    </main>
  );
}
