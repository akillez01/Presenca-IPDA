/**
 * Componente para Operações em Massa
 * Interface para realizar updates, deletes e criações em lote
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { BulkOperationProgress, BulkOperationResult } from '@/lib/bulk-operations';
import { useBulkOperations } from '@/lib/bulk-operations';
import {
    AlertTriangle,
    BarChart3,
    CheckCircle,
    Clock,
    Edit,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface BulkOperationsManagerProps {
  collectionName: string;
  userId: string;
  onOperationComplete?: (result: BulkOperationResult) => void;
}

export default function BulkOperationsManager({ 
  collectionName, 
  userId, 
  onOperationComplete 
}: BulkOperationsManagerProps) {
  const { toast } = useToast();
  const {
    bulkUpdate,
    bulkDelete,
    bulkCreate,
    getOperationProgress,
    getActiveOperations,
    cancelOperation
  } = useBulkOperations();

  const [activeOperations, setActiveOperations] = useState<BulkOperationProgress[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<string>('update');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para operação de atualização
  const [updateData, setUpdateData] = useState('');
  const [updateDryRun, setUpdateDryRun] = useState(true);

  // Estados para operação de exclusão
  const [deleteIds, setDeleteIds] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [createBackup, setCreateBackup] = useState(true);

  // Estados para operação de criação
  const [createData, setCreateData] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);

  // Estados de progresso
  const [operationResults, setOperationResults] = useState<BulkOperationResult[]>([]);

  // Atualizar operações ativas
  useEffect(() => {
    const interval = setInterval(() => {
      const operations = getActiveOperations();
      setActiveOperations(operations);
    }, 1000);

    return () => clearInterval(interval);
  }, [getActiveOperations]);

  // Callback de progresso
  const handleProgress = useCallback((progress: BulkOperationProgress) => {
    setActiveOperations(prev => {
      const index = prev.findIndex(op => op.operationId === progress.operationId);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = progress;
        return updated;
      } else {
        return [...prev, progress];
      }
    });

    // Notificar se completa
    if (progress.status === 'COMPLETED' || progress.status === 'FAILED') {
      toast({
        title: progress.status === 'COMPLETED' ? 'Operação Concluída' : 'Operação Falhou',
        description: `${progress.processed} itens processados, ${progress.errors} erros`,
        variant: progress.status === 'COMPLETED' ? 'default' : 'destructive'
      });
    }
  }, [toast]);

  // Executar atualização em massa
  const handleBulkUpdate = async () => {
    if (!updateData.trim()) {
      toast({
        title: 'Erro',
        description: 'Dados de atualização são obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      
      // Parsear dados JSON
      const updates = JSON.parse(updateData);
      if (!Array.isArray(updates)) {
        throw new Error('Dados devem ser um array de objetos');
      }

      // Validar estrutura
      const validatedUpdates = updates.map((update, index) => {
        if (!update.documentId || !update.data) {
          throw new Error(`Item ${index + 1}: documentId e data são obrigatórios`);
        }
        return {
          documentId: update.documentId,
          data: update.data
        };
      });

      const result = await bulkUpdate(collectionName, validatedUpdates, {
        userId,
        dryRun: updateDryRun,
        onProgress: handleProgress,
        validateData: (data) => {
          // Validação básica
          return typeof data === 'object' && data !== null;
        }
      });

      setOperationResults(prev => [...prev, result]);
      setIsDialogOpen(false);
      setUpdateData('');

      if (onOperationComplete) {
        onOperationComplete(result);
      }

      toast({
        title: 'Atualização Iniciada',
        description: `${validatedUpdates.length} itens na fila ${updateDryRun ? '(simulação)' : ''}`,
      });

    } catch (error) {
      console.error('Erro na atualização em massa:', error);
      toast({
        title: 'Erro na Atualização',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Executar exclusão em massa
  const handleBulkDelete = async () => {
    if (!deleteIds.trim()) {
      toast({
        title: 'Erro',
        description: 'Lista de IDs é obrigatória',
        variant: 'destructive'
      });
      return;
    }

    const ids = deleteIds.split('\n').map(id => id.trim()).filter(Boolean);
    
    if (ids.length > 100 && deleteConfirmation !== 'CONFIRMAR EXCLUSÃO') {
      toast({
        title: 'Confirmação Necessária',
        description: 'Digite "CONFIRMAR EXCLUSÃO" para operações > 100 itens',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);

      const result = await bulkDelete(collectionName, ids, {
        userId,
        confirmationToken: deleteConfirmation,
        createBackup,
        onProgress: handleProgress
      });

      setOperationResults(prev => [...prev, result]);
      setIsDialogOpen(false);
      setDeleteIds('');
      setDeleteConfirmation('');

      if (onOperationComplete) {
        onOperationComplete(result);
      }

      toast({
        title: 'Exclusão Iniciada',
        description: `${ids.length} itens na fila para exclusão`,
      });

    } catch (error) {
      console.error('Erro na exclusão em massa:', error);
      toast({
        title: 'Erro na Exclusão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Executar criação em massa
  const handleBulkCreate = async () => {
    if (!createData.trim()) {
      toast({
        title: 'Erro',
        description: 'Dados para criação são obrigatórios',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const documents = JSON.parse(createData);
      if (!Array.isArray(documents)) {
        throw new Error('Dados devem ser um array de objetos');
      }

      const result = await bulkCreate(collectionName, documents, {
        userId,
        skipDuplicates,
        onProgress: handleProgress,
        validateData: (data) => {
          return typeof data === 'object' && data !== null && Object.keys(data).length > 0;
        }
      });

      setOperationResults(prev => [...prev, result]);
      setIsDialogOpen(false);
      setCreateData('');

      if (onOperationComplete) {
        onOperationComplete(result);
      }

      toast({
        title: 'Criação Iniciada',
        description: `${documents.length} itens na fila para criação`,
      });

    } catch (error) {
      console.error('Erro na criação em massa:', error);
      toast({
        title: 'Erro na Criação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Cancelar operação
  const handleCancelOperation = async (operationId: string) => {
    try {
      await cancelOperation(operationId, userId);
      toast({
        title: 'Operação Cancelada',
        description: `Operação ${operationId.slice(0, 8)} foi cancelada`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao Cancelar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    }
  };

  const getStatusIcon = (status: BulkOperationProgress['status']) => {
    switch (status) {
      case 'RUNNING': return <Clock className="h-4 w-4 text-blue-600" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'FAILED': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'CANCELLED': return <X className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: BulkOperationProgress['status']) => {
    switch (status) {
      case 'RUNNING': return 'blue';
      case 'COMPLETED': return 'green';
      case 'FAILED': return 'red';
      case 'CANCELLED': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Operações em Massa</h2>
          <p className="text-gray-600">
            Gerencie operações em lote para {collectionName}
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Operação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Configurar Operação em Massa</DialogTitle>
              <DialogDescription>
                Selecione o tipo de operação e configure os parâmetros
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <Select value={selectedOperation} onValueChange={setSelectedOperation}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de operação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">
                    <div className="flex items-center gap-2">
                      <Edit className="h-4 w-4" />
                      Atualização em Massa
                    </div>
                  </SelectItem>
                  <SelectItem value="delete">
                    <div className="flex items-center gap-2">
                      <Trash2 className="h-4 w-4" />
                      Exclusão em Massa
                    </div>
                  </SelectItem>
                  <SelectItem value="create">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Criação em Massa
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {selectedOperation === 'update' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Dados de Atualização (JSON)</label>
                    <Textarea
                      value={updateData}
                      onChange={(e) => setUpdateData(e.target.value)}
                      placeholder={`[
  {"documentId": "doc1", "data": {"status": "Presente"}},
  {"documentId": "doc2", "data": {"status": "Ausente"}}
]`}
                      rows={8}
                      className="font-mono"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="dryRun" 
                      checked={updateDryRun} 
                      onCheckedChange={(checked) => setUpdateDryRun(checked === true)} 
                    />
                    <label htmlFor="dryRun" className="text-sm">
                      Modo de simulação (não salvar alterações)
                    </label>
                  </div>

                  <Button 
                    onClick={handleBulkUpdate}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Processando...' : 'Executar Atualização'}
                  </Button>
                </div>
              )}

              {selectedOperation === 'delete' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">IDs dos Documentos (um por linha)</label>
                    <Textarea
                      value={deleteIds}
                      onChange={(e) => setDeleteIds(e.target.value)}
                      placeholder="doc1
doc2
doc3"
                      rows={6}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="createBackup" 
                      checked={createBackup} 
                      onCheckedChange={(checked) => setCreateBackup(checked === true)} 
                    />
                    <label htmlFor="createBackup" className="text-sm">
                      Criar backup antes da exclusão
                    </label>
                  </div>

                  {deleteIds.split('\n').filter(Boolean).length > 100 && (
                    <div>
                      <label className="text-sm font-medium text-red-600">
                        Confirmação Obrigatória (digite "CONFIRMAR EXCLUSÃO")
                      </label>
                      <Textarea
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        placeholder="CONFIRMAR EXCLUSÃO"
                        rows={1}
                      />
                    </div>
                  )}

                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Atenção:</strong> Esta operação é irreversível. 
                      {createBackup ? ' Um backup será criado automaticamente.' : ' Nenhum backup será criado.'}
                    </AlertDescription>
                  </Alert>

                  <Button 
                    onClick={handleBulkDelete}
                    disabled={isLoading}
                    variant="destructive"
                    className="w-full"
                  >
                    {isLoading ? 'Processando...' : 'Executar Exclusão'}
                  </Button>
                </div>
              )}

              {selectedOperation === 'create' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Dados dos Documentos (JSON)</label>
                    <Textarea
                      value={createData}
                      onChange={(e) => setCreateData(e.target.value)}
                      placeholder={`[
  {"name": "João Silva", "status": "Presente"},
  {"name": "Maria Santos", "status": "Ausente"}
]`}
                      rows={8}
                      className="font-mono"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="skipDuplicates" 
                      checked={skipDuplicates} 
                      onCheckedChange={(checked) => setSkipDuplicates(checked === true)} 
                    />
                    <label htmlFor="skipDuplicates" className="text-sm">
                      Pular duplicatas
                    </label>
                  </div>

                  <Button 
                    onClick={handleBulkCreate}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? 'Processando...' : 'Executar Criação'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Operações Ativas */}
      {activeOperations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Operações em Andamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeOperations.map((operation) => (
              <div key={operation.operationId} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(operation.status)}
                    <span className="font-medium">
                      {operation.operationId.slice(0, 12)}...
                    </span>
                    <Badge variant="outline" style={{ color: getStatusColor(operation.status) }}>
                      {operation.status}
                    </Badge>
                  </div>
                  
                  {operation.status === 'RUNNING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelOperation(operation.operationId)}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progresso: {operation.processed} / {operation.total}</span>
                    <span>Erros: {operation.errors}</span>
                  </div>
                  
                  <Progress 
                    value={(operation.processed / operation.total) * 100} 
                    className="h-2"
                  />
                  
                  <div className="text-xs text-gray-500">
                    Iniciado: {operation.startTime.toLocaleString('pt-BR')}
                    {operation.estimatedCompletion && operation.status === 'RUNNING' && (
                      <span> • ETA: {operation.estimatedCompletion.toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de Resultados */}
      {operationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Operações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {operationResults.slice(-5).map((result) => (
                <div key={result.operationId} className="border rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className="font-medium">
                        {result.operationId.slice(0, 12)}...
                      </span>
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.success ? 'Sucesso' : 'Falhou'}
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-500">
                      {result.timestamp.toLocaleString('pt-BR')}
                    </span>
                  </div>
                  
                  <div className="mt-2 text-sm text-gray-600">
                    Processados: {result.processedCount} • 
                    Erros: {result.errorCount} • 
                    Duração: {(result.duration / 1000).toFixed(1)}s
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}