"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useSystemConfig } from '@/hooks/use-realtime';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';

// Função para mapear IDs de usuários para nomes amigáveis
const getUserDisplayName = (updatedBy: string): string => {
  const userMappings: Record<string, string> = {
    'xdVDGAYYn9aneqVIrPKLDeGn3ZC3': '👨‍💻 AchillesOS (Desenvolvedor)',
    'admin@ipda.org.br': '🔧 Administrador Principal',
    'marciodesk@ipda.app.br': '⚙️ Marcio - Admin Técnico',
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
  const { config, loading, error, updateConfig } = useSystemConfig();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Estados para novos itens
  const [newReclassification, setNewReclassification] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newChurchPosition, setNewChurchPosition] = useState('');
  const [newShift, setNewShift] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newCursoCFO, setNewCursoCFO] = useState('');

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

    const updatedOptions = [...config[`${type}Options` as keyof typeof config] as string[], value.trim()];
    
    try {
      setSaving(true);
      const configRef = doc(db, 'system', 'config');
      const configSnap = await getDoc(configRef);
      const payload = {
        [`${type}Options`]: updatedOptions,
        lastUpdated: new Date(),
        updatedBy: getUserDisplayName(user.email || user.uid || 'admin')
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
        updatedBy: getUserDisplayName(user.email || user.uid || 'admin')
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
        shiftOptions: ['Manhã', 'Tarde', 'Noite'],
        statusOptions: ['Presente', 'Ausente', 'Justificado'],
        lastUpdated: new Date(),
        updatedBy: getUserDisplayName(user.email || user.uid || 'system-reset')
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

  const renderConfigSection = (
    title: string,
    description: string,
    type: string,
    items: string[] | undefined,
    newValue: string,
    setter: (value: string) => void
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
          {(items ?? []).map((item, index) => (
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
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configurações do Sistema</h1>
          <p className="text-muted-foreground">
            Gerencie as opções disponíveis nos formulários do sistema
          </p>
        </div>
        
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={saving}>
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

      <Tabs defaultValue="reclassification" className="space-y-4">
        <TabsList className="grid w-full grid-cols-10">
          <TabsTrigger value="fullName">Nome e Sobrenome</TabsTrigger>
          <TabsTrigger value="cpf">CPF</TabsTrigger>
          <TabsTrigger value="reclassification">Reclassificação</TabsTrigger>
          <TabsTrigger value="pastorName">Nome do Pastor</TabsTrigger>
          <TabsTrigger value="region">Região</TabsTrigger>
          <TabsTrigger value="churchPosition">Cargo na Igreja</TabsTrigger>
          <TabsTrigger value="cursoCFO">Curso CFO</TabsTrigger>
          <TabsTrigger value="city">Cidade</TabsTrigger>
          <TabsTrigger value="shift">Turno</TabsTrigger>
          {/* <TabsTrigger value="status">Status</TabsTrigger> */}
        </TabsList>

        <TabsContent value="fullName">
          <Card><CardHeader><CardTitle>Nome e Sobrenome</CardTitle><CardDescription>Campo obrigatório, texto livre.</CardDescription></CardHeader></Card>
        </TabsContent>
        <TabsContent value="cpf">
          <Card><CardHeader><CardTitle>CPF</CardTitle><CardDescription>Campo obrigatório, apenas números.</CardDescription></CardHeader></Card>
        </TabsContent>
        <TabsContent value="reclassification">
          {renderConfigSection(
            'Reclassificação',
            'Gerencie as opções de reclassificação disponíveis',
            'reclassification',
            config.reclassificationOptions,
            newReclassification,
            setNewReclassification
          )}
        </TabsContent>
        <TabsContent value="pastorName">
          <Card><CardHeader><CardTitle>Nome do Pastor</CardTitle><CardDescription>Campo obrigatório, texto livre.</CardDescription></CardHeader></Card>
        </TabsContent>
        <TabsContent value="region">
          {renderConfigSection(
            'Região',
            'Gerencie as regiões disponíveis',
            'region',
            config.regionOptions,
            newRegion,
            setNewRegion
          )}
        </TabsContent>
        <TabsContent value="churchPosition">
          {renderConfigSection(
            'Cargo na Igreja',
            'Gerencie os cargos disponíveis na igreja',
            'churchPosition',
            config.churchPositionOptions,
            newChurchPosition,
            setNewChurchPosition
          )}
        </TabsContent>
        <TabsContent value="cursoCFO">
          {renderConfigSection(
            'Curso CFO',
            'Gerencie as opções do campo Curso CFO',
            'cursoCFO',
            config.cursoCFOOptions || ['Sim', 'Não'],
            newCursoCFO,
            setNewCursoCFO
          )}
        </TabsContent>
        <TabsContent value="city">
          <Card><CardHeader><CardTitle>Cidade</CardTitle><CardDescription>Campo obrigatório, texto livre.</CardDescription></CardHeader></Card>
        </TabsContent>
        <TabsContent value="shift">
          {renderConfigSection(
            'Turno',
            'Gerencie os turnos disponíveis',
            'shift',
            config.shiftOptions,
            newShift,
            setNewShift
          )}
        </TabsContent>
        <TabsContent value="status">
          {/*
          {renderConfigSection(
            'Status',
            'Gerencie os status de presença disponíveis',
            'status',
            config.statusOptions,
            newStatus,
            setNewStatus
          )}
          */}
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label>Última atualização:</Label>
              <p className="text-muted-foreground">
                {config.lastUpdated ? 
                  (() => {
                    try {
                      // Tenta converter para Date se for um Timestamp do Firebase
                      const date = config.lastUpdated instanceof Date 
                        ? config.lastUpdated 
                        : (config.lastUpdated as any).toDate?.() || new Date(config.lastUpdated);
                      return date.toLocaleString('pt-BR');
                    } catch {
                      return 'Data inválida';
                    }
                  })()
                  : 'Não disponível'
                }
              </p>
            </div>
            <div>
              <Label>Atualizado por:</Label>
              <p className="text-muted-foreground">{getUserDisplayName(config.updatedBy)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Gerenciamento de campos do formulário removido conforme solicitado */}
    </div>
  );
}
