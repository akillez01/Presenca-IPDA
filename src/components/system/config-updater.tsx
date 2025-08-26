'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { runFirebaseUpdate } from '@/lib/update-firebase-config';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function ConfigUpdater() {
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const result = await runFirebaseUpdate();
      
      if (result.success) {
        toast({
          title: "Configurações atualizadas!",
          description: "Os novos cargos na igreja foram adicionados com sucesso ao Firebase.",
        });
      } else {
        toast({
          title: "Erro na atualização",
          description: "Ocorreu um erro ao atualizar as configurações no Firebase.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro inesperado durante a atualização.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Atualização de Configurações</CardTitle>
        <CardDescription>
          Clique no botão abaixo para atualizar as configurações do Firebase com os novos cargos na igreja.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p><strong>Novos cargos que serão adicionados:</strong></p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Conselheiro(a)</li>
              <li>Financeiro(a)</li>
              <li>Presbítero</li>
              <li>Cooperador(a)</li>
              <li>Líder Reação</li>
              <li>Líder Simplifique</li>
              <li>Líder Creative</li>
              <li>Líder Discipulus</li>
              <li>Líder Adore</li>
              <li>Auxiliar Expansão (a)</li>
              <li>Etda Professor(a)</li>
              <li>Coordenador Etda (a)</li>
              <li>Líder Galileu (a)</li>
              <li>Líder Adote uma alma (a)</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleUpdate} 
            disabled={isUpdating}
            className="w-full"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Atualizando...' : 'Atualizar Configurações do Firebase'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
