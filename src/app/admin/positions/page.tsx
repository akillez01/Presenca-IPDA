'use client';

// import { SuperUserGuard } from '@/components/auth/super-user-guard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSystemConfig } from '@/hooks/use-realtime';
import { useToast } from '@/hooks/use-toast';
import {
  Building,
  CheckCircle,
  Info,
  Plus,
  RefreshCw,
  Save,
  Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ManagePositionsPage() {
  const { config, loading, updateConfig } = useSystemConfig();
  const { toast } = useToast();
  const [positions, setPositions] = useState<string[]>([]);
  const [newPosition, setNewPosition] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastUpdateInfo, setLastUpdateInfo] = useState<{
    addedPositions: string[];
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    if (config?.churchPositionOptions) {
      setPositions([...config.churchPositionOptions]);
    }
  }, [config]);

  const handleAddPosition = () => {
    if (!newPosition.trim()) {
      toast({
        title: "Erro",
        description: "Digite um nome para o cargo.",
        variant: "destructive"
      });
      return;
    }

    if (positions.includes(newPosition.trim())) {
      toast({
        title: "Erro", 
        description: "Este cargo já existe na lista.",
        variant: "destructive"
      });
      return;
    }

    setPositions([...positions, newPosition.trim()]);
    setNewPosition('');
    
    toast({
      title: "Cargo adicionado",
      description: `Cargo "${newPosition.trim()}" adicionado à lista.`,
      variant: "default"
    });
  };

  const handleRemovePosition = (positionToRemove: string) => {
    // Proteção contra remoção de cargos essenciais
    const essentialPositions = ['Pastor', 'Membro', 'Outro'];
    if (essentialPositions.includes(positionToRemove)) {
      toast({
        title: "Erro",
        description: "Este cargo não pode ser removido pois é essencial para o sistema.",
        variant: "destructive"
      });
      return;
    }

    setPositions(positions.filter(p => p !== positionToRemove));
    
    toast({
      title: "Cargo removido",
      description: `Cargo "${positionToRemove}" removido da lista.`,
      variant: "default"
    });
  };

  const handleSaveChanges = async () => {
    setIsUpdating(true);
    
    try {
      // Verificar quais cargos foram adicionados
      const currentPositions = config?.churchPositionOptions || [];
      const newlyAdded = positions.filter(pos => !currentPositions.includes(pos));
      
      const updatedConfig = {
        ...config,
        churchPositionOptions: positions,
        lastUpdated: new Date().toISOString(),
        updatedBy: 'admin-panel'
      };

      await updateConfig(updatedConfig);
      
      // Mostrar mensagem de sucesso apenas se houve mudanças
      if (newlyAdded.length > 0) {
        setLastUpdateInfo({
          addedPositions: newlyAdded,
          timestamp: new Date().toLocaleString('pt-BR')
        });
        setShowSuccessMessage(true);
        
        // Esconder a mensagem após 10 segundos
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 10000);
      }
      
      toast({
        title: "Sucesso!",
        description: newlyAdded.length > 0 
          ? `${newlyAdded.length} cargo(s) adicionado(s) com sucesso.`
          : "Configurações salvas com sucesso.",
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar as alterações.",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Carregando configurações...
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Cargos da Igreja</h1>
            <p className="text-muted-foreground">
              Adicione, remova ou modifique os cargos disponíveis no formulário de registro.
            </p>
          </div>

          {/* Status dos novos cargos - apenas após atualização */}
          {showSuccessMessage && lastUpdateInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>✅ Novos cargos adicionados:</strong> {lastUpdateInfo.addedPositions.join(', ')} foram incluídos com sucesso!
                <br />
                <small className="text-muted-foreground">
                  Atualizado em: {lastUpdateInfo.timestamp}
                </small>
              </AlertDescription>
            </Alert>
          )}

          {/* Adicionar novo cargo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Adicionar Novo Cargo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="newPosition">Nome do Cargo</Label>
                  <Input
                    id="newPosition"
                    placeholder="Ex: Coordenador(a), Auxiliar, etc."
                    value={newPosition}
                    onChange={(e) => setNewPosition(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPosition()}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleAddPosition} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de cargos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Cargos Cadastrados ({positions.length})
                </div>
                <Button 
                  onClick={handleSaveChanges} 
                  disabled={isUpdating}
                  className="gap-2"
                >
                  {isUpdating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {positions.map((position, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={
                          lastUpdateInfo?.addedPositions.includes(position) ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {lastUpdateInfo?.addedPositions.includes(position) && "NOVO"} {position}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePosition(position)}
                      disabled={['Pastor', 'Membro', 'Outro'].includes(position)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              
              {positions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum cargo cadastrado
                </div>
              )}
            </CardContent>
          </Card>

          {/* Informações */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Importante:</strong> Os cargos "Pastor", "Membro" e "Outro" não podem ser removidos pois são essenciais para o funcionamento do sistema. As alterações serão aplicadas imediatamente no formulário de registro.
            </AlertDescription>
          </Alert>
        </div>
      </div>
  );
}
