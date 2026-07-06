"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserManagement } from '@/components/admin/user-management';
import { useAuth } from '@/hooks/use-auth';
import { useSystemConfig } from '@/hooks/use-realtime';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { DEFAULT_SYSTEM_CONFIG } from '@/lib/system-config';
import { FirebaseStatus } from "@/components/firebase-status";
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, ListChecks, Plus, RefreshCw, TextCursorInput, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// Função para mapear IDs de usuários para nomes amigáveis
const getUserDisplayName = (updatedBy: string): string => {
  const userMappings: Record<string, string> = {
    'xdVDGAYYn9aneqVIrPKLDeGn3ZC3': '👨‍💻 AchillesOS (Desenvolvedor)',
    'admin@ipda.org.br': '👨‍💻 AchillesOS (Desenvolvedor)',
    'marciodesk@ipda.app.br': '👨‍💻 AchillesOS (Desenvolvedor)',
    'system-update': '🤖 Sistema (Atualização Automática)',
    'script-update-cargos': '📜 Script de Atualização de Cargos',
    'admin-panel': '🎛️ Painel Administrativo',
    'system-init': '🚀 Sistema (Inicialização)',
    'system-reset': '🔄 Sistema (Reset)',
  };

  return userMappings[updatedBy] || updatedBy;
};

export function SystemConfigManager() {
  const { user, loading: authLoading } = useAuth();
  const { config, loading, error } = useSystemConfig();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [clientDateBR, setClientDateBR] = useState<string>("");
  const [activeTab, setActiveTab] = useState<'users' | 'fields' | 'about'>('users');

  useEffect(() => {
    // Renderiza somente no client para evitar hydration mismatch de locale/timezone.
    setClientDateBR(new Date().toLocaleDateString("pt-BR"));
  }, []);

  // Estados para novos itens
  const [newReclassification, setNewReclassification] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newChurchPosition, setNewChurchPosition] = useState('');
  const [newShift, setNewShift] = useState('');
  const [newCursoCFO, setNewCursoCFO] = useState('');
  const [newStatus, setNewStatus] = useState('');

  const normalizeOption = (value: string) => value.trim().toLocaleLowerCase('pt-BR');
  const countDuplicates = (items?: string[]) => {
    const seen = new Set<string>();
    let duplicates = 0;

    for (const item of items ?? []) {
      const normalizedItem = normalizeOption(item);
      if (!normalizedItem) continue;

      if (seen.has(normalizedItem)) {
        duplicates += 1;
      } else {
        seen.add(normalizedItem);
      }
    }

    return duplicates;
  };

  const handleAddItem = async (type: string, value: string, setter: (value: string) => void) => {
    if (!value.trim() || !config || !user) {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para fazer alterações.",
        });
      }
      return;
    }

    const currentOptions = config[`${type}Options` as keyof typeof config] as string[];
    if (!Array.isArray(currentOptions)) {
      toast({
        variant: "destructive",
        title: "Erro de Configuração",
        description: `As opções de ${type} não estão configuradas corretamente.`,
      });
      return;
    }

    if (currentOptions.some((item) => normalizeOption(item) === normalizeOption(value))) {
      toast({
        variant: "destructive",
        title: "Opção duplicada",
        description: `A opção "${value.trim()}" já está cadastrada neste campo.`,
      });
      return;
    }

    const updatedOptions = [...currentOptions, value.trim()];
    
    try {
      setSaving(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      const payload = {
        [`${type}Options`]: updatedOptions,
        lastUpdated: new Date(),
        updatedBy: user.email || user.uid || 'admin'
      };
      if (configSnap.exists()) {
        await updateDoc(configRef, payload);
      } else {
        await setDoc(configRef, payload);
      }
      setter('');
      toast({
        title: "Sucesso",
        description: `${value} adicionado com sucesso!`,
      });
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao adicionar item. Verifique suas permissões e tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItem = async (type: string, value: string) => {
    if (!config || !user) {
      if (!user) {
        toast({
          variant: "destructive",
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para fazer alterações.",
        });
      }
      return;
    }

    const currentOptions = config[`${type}Options` as keyof typeof config] as string[];
    const updatedOptions = currentOptions.filter(item => item !== value);
    
    try {
      setSaving(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      const payload = {
        [`${type}Options`]: updatedOptions,
        lastUpdated: new Date(),
        updatedBy: user.email || user.uid || 'admin'
      };
      if (configSnap.exists()) {
        await updateDoc(configRef, payload);
      } else {
        await setDoc(configRef, payload);
      }
      toast({
        title: "Sucesso",
        description: `${value} removido com sucesso!`,
      });
    } catch (error) {
      console.error('Erro ao remover item:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao remover item. Verifique suas permissões e tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Erro de Autenticação",
        description: "Você precisa estar logado para fazer alterações.",
      });
      return;
    }

    try {
      setSaving(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      const payload = {
        reclassificationOptions: ['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'],
        regionOptions: ['Norte', 'Sul', 'Leste', 'Oeste', 'Central'],
        churchPositionOptions: [
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
          'Outro'
        ],
        cursoCFOOptions: ['Sim', 'Não'],
        shiftOptions: ['Manhã', 'Tarde', 'Noite'],
        statusOptions: ['Presente', 'Ausente', 'Justificado'],
        lastUpdated: new Date(),
        updatedBy: user.email || user.uid || 'system-reset'
      };
      if (configSnap.exists()) {
        await updateDoc(configRef, payload);
      } else {
        await setDoc(configRef, payload);
      }
      toast({
        title: "Sucesso",
        description: "Configurações restauradas para os valores padrão!",
      });
    } catch (error) {
      console.error('Erro ao restaurar configurações:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao restaurar configurações. Verifique suas permissões e tente novamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando...</span>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-red-500">Você precisa estar logado para acessar as configurações do sistema.</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Carregando configurações...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !config) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-red-500">Erro ao carregar configurações: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const reclassificationOptions = Array.isArray(config.reclassificationOptions)
    ? config.reclassificationOptions
    : DEFAULT_SYSTEM_CONFIG.reclassificationOptions;
  const regionOptions = Array.isArray(config.regionOptions)
    ? config.regionOptions
    : DEFAULT_SYSTEM_CONFIG.regionOptions;
  const churchPositionOptions = Array.isArray(config.churchPositionOptions)
    ? config.churchPositionOptions
    : DEFAULT_SYSTEM_CONFIG.churchPositionOptions;
  const cursoCFOOptions = Array.isArray(config.cursoCFOOptions)
    ? config.cursoCFOOptions
    : (DEFAULT_SYSTEM_CONFIG.cursoCFOOptions || ['Sim', 'Não']);
  const shiftOptions = Array.isArray(config.shiftOptions)
    ? config.shiftOptions
    : DEFAULT_SYSTEM_CONFIG.shiftOptions;
  const statusOptions = Array.isArray(config.statusOptions)
    ? config.statusOptions
    : DEFAULT_SYSTEM_CONFIG.statusOptions;

  const renderConfigSection = (
    title: string,
    description: string,
    type: string,
    items: string[] | undefined,
    newValue: string,
    setter: (value: string) => void
  ) => {
    const safeItems = items ?? [];
    const duplicates = countDuplicates(safeItems);

    return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{safeItems.length} opção(ões)</Badge>
            {duplicates > 0 && (
              <Badge variant="destructive">{duplicates} duplicada(s)</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder={`Novo ${title.toLowerCase()}`}
            value={newValue}
            onChange={(e) => setter(e.target.value)}
            disabled={saving}
          />
          <Button
            onClick={() => handleAddItem(type, newValue, setter)}
            disabled={!newValue.trim() || saving}
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {safeItems.map((item, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {item}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 ml-1"
                    disabled={saving}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar remoção</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover "{item}"? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRemoveItem(type, item)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </Badge>
          ))}
        </div>
        {safeItems.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma opção cadastrada ainda para este campo.
          </p>
        )}
      </CardContent>
    </Card>
    );
  };

  const renderReadonlySection = (
    title: string,
    description: string,
    formatRule: string,
    validationRule: string
  ) => (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline">Campo fixo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-slate-900 text-white hover:bg-slate-900">Entrada livre</Badge>
          <Badge variant="secondary">{formatRule}</Badge>
          <Badge variant="secondary">{validationRule}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          A edição deste campo é feita diretamente no formulário, sem lista dinâmica no painel.
        </p>
      </CardContent>
    </Card>
  );

  const configurableFieldSummaries = [
    { title: 'Reclassificação', count: reclassificationOptions.length, description: 'Lista de classificação ministerial' },
    { title: 'Região', count: regionOptions.length, description: 'Regiões disponíveis no cadastro' },
    { title: 'Cargo na Igreja', count: churchPositionOptions.length, description: 'Cargos e funções ministeriais' },
    { title: 'Curso', count: cursoCFOOptions.length, description: 'Opções para o campo Curso' },
    { title: 'Turno', count: shiftOptions.length, description: 'Turnos de participação' },
    { title: 'Status', count: statusOptions.length, description: 'Status operacionais de presença' },
  ];

  const readonlyFieldSummaries = [
    { title: 'Nome e Sobrenome', description: 'Texto livre obrigatório' },
    { title: 'CPF', description: 'Validação numérica obrigatória' },
    { title: 'Nome do Pastor', description: 'Texto livre obrigatório' },
    { title: 'Cidade', description: 'Campo livre para localização' },
  ];

  const totalConfigurableOptions = configurableFieldSummaries.reduce((total, field) => total + field.count, 0);
  const duplicateEntries = [
    reclassificationOptions,
    regionOptions,
    churchPositionOptions,
    cursoCFOOptions,
    shiftOptions,
    statusOptions,
  ].reduce((total, items) => total + countDuplicates(items), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Centralize os campos do sistema, o gerenciamento de usuários e as informações administrativas
          </p>
        </div>
        
        <div className="flex w-full gap-2 sm:w-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={saving} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Restaurar Padrão
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restaurar configurações padrão</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá substituir todas as configurações atuais pelos valores padrão do sistema.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetToDefault}>
                  Restaurar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card className="border-border/60 bg-gradient-to-r from-slate-50 to-white shadow-sm">
        <CardContent className="grid gap-4 p-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Ultima sincronizacao de campos</p>
            <p className="mt-1 text-lg font-semibold">
              {config.lastUpdated ? config.lastUpdated.toLocaleString('pt-BR') : 'Nao disponivel'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Responsavel pela ultima alteracao</p>
            <p className="mt-1 text-lg font-semibold">{getUserDisplayName(config.updatedBy)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Modulo administrativo</p>
            <p className="mt-1 text-lg font-semibold">Campos, usuarios e operacao do app</p>
          </div>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'users' | 'fields' | 'about')}
        className="space-y-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3">
          <TabsTrigger value="users" className="whitespace-nowrap">
            Usuarios e Acessos
          </TabsTrigger>
          <TabsTrigger value="fields" className="whitespace-nowrap">
            Campos do Sistema
          </TabsTrigger>
          <TabsTrigger value="about" className="whitespace-nowrap">
            Informacoes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <UserManagement embedded />
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <ListChecks className="h-9 w-9 rounded-full bg-slate-100 p-2 text-slate-700" />
                <div>
                  <p className="text-sm text-muted-foreground">Campos editáveis</p>
                  <p className="text-2xl font-semibold">{configurableFieldSummaries.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <TextCursorInput className="h-9 w-9 rounded-full bg-blue-100 p-2 text-blue-700" />
                <div>
                  <p className="text-sm text-muted-foreground">Campos fixos</p>
                  <p className="text-2xl font-semibold">{readonlyFieldSummaries.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <CheckCircle2 className="h-9 w-9 rounded-full bg-emerald-100 p-2 text-emerald-700" />
                <div>
                  <p className="text-sm text-muted-foreground">Opções cadastradas</p>
                  <p className="text-2xl font-semibold">{totalConfigurableOptions}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 py-6">
                <Trash2 className="h-9 w-9 rounded-full bg-amber-100 p-2 text-amber-700" />
                <div>
                  <p className="text-sm text-muted-foreground">Duplicidades detectadas</p>
                  <p className="text-2xl font-semibold">{duplicateEntries}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Catálogo dos campos do sistema</CardTitle>
              <CardDescription>
                Visão rápida do que é controlado por lista dinâmica e do que permanece fixo no formulário.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {configurableFieldSummaries.map((field) => (
                <div key={field.title} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{field.title}</p>
                    <Badge variant="outline">{field.count} opção(ões)</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{field.description}</p>
                </div>
              ))}
              {readonlyFieldSummaries.map((field) => (
                <div key={field.title} className="rounded-xl border border-dashed p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{field.title}</p>
                    <Badge variant="secondary">Campo fixo</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{field.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Tabs defaultValue="reclassification" className="space-y-4">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 lg:grid-cols-3 xl:grid-cols-5">
              <TabsTrigger value="fullName" className="whitespace-normal text-center">Nome e Sobrenome</TabsTrigger>
              <TabsTrigger value="cpf" className="whitespace-normal text-center">CPF</TabsTrigger>
              <TabsTrigger value="reclassification" className="whitespace-normal text-center">Reclassificação</TabsTrigger>
              <TabsTrigger value="pastorName" className="whitespace-normal text-center">Nome do Pastor</TabsTrigger>
              <TabsTrigger value="region" className="whitespace-normal text-center">Região</TabsTrigger>
              <TabsTrigger value="churchPosition" className="whitespace-normal text-center">Cargo na Igreja</TabsTrigger>
              <TabsTrigger value="cursoCFO" className="whitespace-normal text-center">Curso</TabsTrigger>
              <TabsTrigger value="city" className="whitespace-normal text-center">Cidade</TabsTrigger>
              <TabsTrigger value="shift" className="whitespace-normal text-center">Turno</TabsTrigger>
              <TabsTrigger value="status" className="whitespace-normal text-center">Status</TabsTrigger>
            </TabsList>

            <TabsContent value="fullName">
              {renderReadonlySection('Nome e Sobrenome', 'Campo obrigatório para identificação do membro.', 'Texto livre', 'Obrigatório')}
            </TabsContent>
            <TabsContent value="cpf">
              {renderReadonlySection('CPF', 'Campo obrigatório para validação do cadastro.', 'Apenas números', 'Obrigatório')}
            </TabsContent>
            <TabsContent value="reclassification">
              {renderConfigSection(
                'Reclassificação',
                'Gerencie as opções de reclassificação disponíveis',
                'reclassification',
                reclassificationOptions,
                newReclassification,
                setNewReclassification
              )}
            </TabsContent>
            <TabsContent value="pastorName">
              {renderReadonlySection('Nome do Pastor', 'Identifica a liderança responsável pelo membro.', 'Texto livre', 'Obrigatório')}
            </TabsContent>
            <TabsContent value="region">
              {renderConfigSection(
                'Região',
                'Gerencie as regiões disponíveis',
                'region',
                regionOptions,
                newRegion,
                setNewRegion
              )}
            </TabsContent>
            <TabsContent value="churchPosition">
              {renderConfigSection(
                'Cargo na Igreja',
                'Gerencie os cargos disponíveis na igreja',
                'churchPosition',
                churchPositionOptions,
                newChurchPosition,
                setNewChurchPosition
              )}
            </TabsContent>
            <TabsContent value="cursoCFO">
              {renderConfigSection(
                'Curso',
                'Gerencie as opções do campo Curso',
                'cursoCFO',
                cursoCFOOptions,
                newCursoCFO,
                setNewCursoCFO
              )}
            </TabsContent>
            <TabsContent value="city">
              {renderReadonlySection('Cidade', 'Localidade informada pelo usuário no momento do cadastro.', 'Texto livre', 'Obrigatório')}
            </TabsContent>
            <TabsContent value="shift">
              {renderConfigSection(
                'Turno',
                'Gerencie os turnos disponíveis',
                'shift',
                shiftOptions,
                newShift,
                setNewShift
              )}
            </TabsContent>
            <TabsContent value="status">
              {renderConfigSection(
                'Status',
                'Gerencie os status de presença disponíveis',
                'status',
                statusOptions,
                newStatus,
                setNewStatus
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="about">
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <span className="text-2xl">👨‍💻</span>
                Informações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Desenvolvedor</Label>
                    <p className="text-lg font-medium">AchillesOS</p>
                    <p className="text-sm text-muted-foreground">Desenvolvedor Principal</p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Projeto</Label>
                    <p className="font-medium">Sistema de Presença IPDA</p>
                    <p className="text-sm text-muted-foreground">Igreja Pentecostal Deus é Amor</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Versão</Label>
                    <p className="text-lg font-medium">v1.0.0</p>
                    {clientDateBR ? (
                      <p className="text-sm text-muted-foreground">Atualizado em {clientDateBR}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground" suppressHydrationWarning>
                        Atualizado em ...
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Conexão</Label>
                    <div className="mt-1">
                      <FirebaseStatus />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">Tecnologias</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge variant="secondary" className="text-xs">Next.js 15</Badge>
                      <Badge variant="secondary" className="text-xs">Firebase</Badge>
                      <Badge variant="secondary" className="text-xs">TypeScript</Badge>
                      <Badge variant="secondary" className="text-xs">Tailwind CSS</Badge>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6 border-t border-primary/10 pt-4">
                <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span>© 2025 AchillesOS - Todos os direitos reservados</span>
                  <span className="flex items-center gap-1">
                    Feito com <span className="text-red-500">❤️</span> para IPDA
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
