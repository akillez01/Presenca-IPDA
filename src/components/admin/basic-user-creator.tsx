'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { RefreshCw, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';

interface BasicUserForm {
  email: string;
  displayName: string;
  password: string;
  type: 'secretaria' | 'auxiliar' | 'cadastro' | 'presente' | 'custom';
}

export function BasicUserCreator({ onUserCreated }: { onUserCreated?: () => void }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<BasicUserForm>({
    email: '',
    displayName: '',
    password: '',
    type: 'secretaria'
  });

  const userTypes = {
    secretaria: {
      label: 'Secretaria IPDA',
      emailSuffix: '@ipda.org.br',
      defaultPassword: 'SecretariaIPDA@2025',
      displayName: 'Secretaria IPDA'
    },
    auxiliar: {
      label: 'Auxiliar IPDA',
      emailSuffix: '@ipda.org.br',
      defaultPassword: 'AuxiliarIPDA@2025',
      displayName: 'Auxiliar IPDA'
    },
    cadastro: {
      label: 'Cadastro IPDA',
      emailSuffix: '@ipda.app.br',
      defaultPassword: 'CadastroIPDA@2025',
      displayName: 'Cadastro IPDA'
    },
    presente: {
      label: 'Controle de Presença',
      emailSuffix: '@ipda.app.br',
      defaultPassword: 'PresenteIPDA@2025',
      displayName: 'Controle de Presença IPDA'
    },
    custom: {
      label: 'Usuário Customizado',
      emailSuffix: '@ipda.org.br',
      defaultPassword: 'IPDA@2025',
      displayName: 'Usuário IPDA'
    }
  };

  const handleTypeChange = (type: BasicUserForm['type']) => {
    const config = userTypes[type];
    setForm(prev => ({
      ...prev,
      type,
      password: config.defaultPassword,
      displayName: config.displayName,
      email: type === 'custom' ? '' : `${type}${config.emailSuffix}`
    }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      // Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email,
        form.password
      );

      // Atualizar perfil
      if (form.displayName) {
        await updateProfile(userCredential.user, {
          displayName: form.displayName
        });
      }

      toast({
        title: "✅ Usuário Básico Criado!",
        description: `${form.displayName} (${form.email}) foi criado com sucesso.`,
        variant: "default"
      });

      // Limpar formulário
      setForm({
        email: '',
        displayName: '',
        password: '',
        type: 'secretaria'
      });

      setIsOpen(false);
      onUserCreated?.();

    } catch (error: any) {
      toast({
        title: "❌ Erro ao criar usuário",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <Users className="h-5 w-5" />
          Criação Rápida de Usuários Básicos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Crie rapidamente usuários básicos com configurações pré-definidas para o sistema IPDA.
        </p>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <UserPlus className="h-4 w-4 mr-2" />
              Criar Usuário Básico IPDA
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Usuário Básico</DialogTitle>
              <DialogDescription>
                Configure rapidamente um usuário básico com permissões limitadas.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value as BasicUserForm['type'])}
                >
                  {Object.entries(userTypes).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  placeholder="usuario@ipda.org.br"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Nome de Exibição</Label>
                <Input
                  id="displayName"
                  value={form.displayName}
                  onChange={(e) => setForm(prev => ({ ...prev, displayName: e.target.value }))}
                  required
                  placeholder="Nome para exibir no sistema"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                  required
                  placeholder="Senha do usuário"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <h4 className="font-semibold text-blue-800 mb-2">Permissões do Usuário Básico:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>✅ Dashboard e estatísticas</li>
                  <li>✅ Registrar presença</li>
                  <li>✅ Ver presença de cadastrados</li>
                  <li>✅ Cartas de recomendação</li>
                  <li>❌ Relatórios (apenas leitura)</li>
                  <li>❌ Gerenciar usuários</li>
                  <li>❌ Configurações avançadas</li>
                </ul>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="w-full">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Criar Usuário
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
