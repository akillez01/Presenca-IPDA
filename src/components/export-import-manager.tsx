/**
 * Componente para Export/Import de Dados
 * Interface para exportação e importação avançada com múltiplos formatos
 */

'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
    useExportImport,
    type ExportOptions,
    type ExportProgress,
    type ExportResult,
    type ImportOptions,
    type ImportProgress,
    type ImportResult
} from '@/lib/export-import';
import {
    Calendar,
    CheckCircle,
    Code,
    Download,
    FileSpreadsheet,
    FileText,
    Filter,
    MapPin,
    Settings,
    Upload
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

interface ExportImportManagerProps {
  collectionName: string;
  userId: string;
  onOperationComplete?: (result: ExportResult | ImportResult) => void;
}

export default function ExportImportManager({ 
  collectionName, 
  userId, 
  onOperationComplete 
}: ExportImportManagerProps) {
  const { toast } = useToast();
  const { exportData, importData } = useExportImport(userId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados gerais
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isLoading, setIsLoading] = useState(false);

  // Estados de Export
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'json',
    includeMetadata: false,
    maxRecords: 1000
  });
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportFilters, setExportFilters] = useState('');
  const [exportFields, setExportFields] = useState('');
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateField, setDateField] = useState('createdAt');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Estados de Import
  const [importOptions, setImportOptions] = useState<ImportOptions>({
    format: 'json',
    mode: 'insert',
    skipDuplicates: true,
    validateData: true,
    batchSize: 50
  });
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fieldMapping, setFieldMapping] = useState('');
  const [dataTransformations, setDataTransformations] = useState('');

  // Callbacks de progresso
  const handleExportProgress = useCallback((progress: ExportProgress) => {
    setExportProgress(progress);
  }, []);

  const handleImportProgress = useCallback((progress: ImportProgress) => {
    setImportProgress(progress);
  }, []);

  // Executar exportação
  const handleExport = async () => {
    try {
      setIsLoading(true);
      setExportProgress(null);

      // Preparar opções de exportação
      const options: ExportOptions = {
        ...exportOptions
      };

      // Adicionar filtros se especificados
      if (exportFilters.trim()) {
        try {
          options.filters = JSON.parse(exportFilters);
        } catch (error) {
          toast({
            title: 'Erro nos Filtros',
            description: 'Formato JSON inválido nos filtros',
            variant: 'destructive'
          });
          return;
        }
      }

      // Adicionar campos se especificados
      if (exportFields.trim()) {
        options.fields = exportFields.split(',').map(f => f.trim()).filter(Boolean);
      }

      // Adicionar range de datas se habilitado
      if (useDateRange && startDate && endDate) {
        options.dateRange = {
          field: dateField,
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        };
      }

      const result = await exportData(
        collectionName,
        options,
        userId,
        handleExportProgress
      );

      if (result.success && result.blob) {
        // Download do arquivo
        const url = URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Exportação Concluída',
          description: `${result.recordsExported} registros exportados em ${result.format.toUpperCase()}`,
        });

        if (onOperationComplete) {
          onOperationComplete(result);
        }
      } else {
        toast({
          title: 'Erro na Exportação',
          description: result.error || 'Erro desconhecido',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: 'Erro na Exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setExportProgress(null);
    }
  };

  // Executar importação
  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: 'Erro',
        description: 'Selecione um arquivo para importar',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsLoading(true);
      setImportProgress(null);

      // Preparar opções de importação
      const options: ImportOptions = {
        ...importOptions
      };

      // Adicionar mapeamento se especificado
      if (fieldMapping.trim()) {
        try {
          options.mapping = JSON.parse(fieldMapping);
        } catch (error) {
          toast({
            title: 'Erro no Mapeamento',
            description: 'Formato JSON inválido no mapeamento de campos',
            variant: 'destructive'
          });
          return;
        }
      }

      // Adicionar transformações se especificadas
      if (dataTransformations.trim()) {
        try {
          const transformations = JSON.parse(dataTransformations);
          options.transformations = {};
          
          Object.entries(transformations).forEach(([field, funcStr]) => {
            if (typeof funcStr === 'string') {
              // Criar função a partir da string (cuidado com segurança!)
              options.transformations![field] = new Function('value', funcStr) as (value: any) => any;
            }
          });
        } catch (error) {
          toast({
            title: 'Erro nas Transformações',
            description: 'Formato inválido nas transformações de dados',
            variant: 'destructive'
          });
          return;
        }
      }

      const result = await importData(
        collectionName,
        selectedFile,
        options,
        userId,
        handleImportProgress
      );

      if (result.success) {
        toast({
          title: 'Importação Concluída',
          description: `${result.recordsImported} registros importados, ${result.recordsSkipped} ignorados`,
        });

        if (onOperationComplete) {
          onOperationComplete(result);
        }

        // Resetar formulário
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        toast({
          title: 'Erro na Importação',
          description: `${result.recordsWithErrors} erros encontrados`,
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: 'Erro na Importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      setImportProgress(null);
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'csv': return <FileSpreadsheet className="h-4 w-4" />;
      case 'xml': return <Code className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Export/Import de Dados</h2>
          <p className="text-gray-600">
            Exportar e importar dados da coleção {collectionName}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'export' | 'import')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar Dados
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importar Dados
          </TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Configurações de Exportação
              </CardTitle>
              <CardDescription>
                Configure os parâmetros para exportação dos dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formato de Exportação */}
              <div className="space-y-2">
                <Label>Formato do Arquivo</Label>
                <Select 
                  value={exportOptions.format} 
                  onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as any }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        JSON
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        CSV
                      </div>
                    </SelectItem>
                    <SelectItem value="xml">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        XML
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Opções Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de Registros</Label>
                  <Input
                    type="number"
                    value={exportOptions.maxRecords || ''}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      maxRecords: e.target.value ? parseInt(e.target.value) : undefined 
                    }))}
                    placeholder="Sem limite"
                  />
                </div>
                
                <div className="flex items-center space-x-2 pt-6">
                  <Checkbox 
                    id="includeMetadata" 
                    checked={exportOptions.includeMetadata} 
                    onCheckedChange={(checked) => setExportOptions(prev => ({ 
                      ...prev, 
                      includeMetadata: checked === true 
                    }))} 
                  />
                  <label htmlFor="includeMetadata" className="text-sm">
                    Incluir metadados
                  </label>
                </div>
              </div>

              {/* Filtros */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros (JSON)
                </Label>
                <Textarea
                  value={exportFilters}
                  onChange={(e) => setExportFilters(e.target.value)}
                  placeholder={`[
  {"field": "status", "operator": "==", "value": "Presente"},
  {"field": "cargo", "operator": "in", "value": ["Pastor", "Diácono"]}
]`}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              {/* Campos Específicos */}
              <div className="space-y-2">
                <Label>Campos Específicos (separados por vírgula)</Label>
                <Input
                  value={exportFields}
                  onChange={(e) => setExportFields(e.target.value)}
                  placeholder="nome, email, status, cargo"
                />
              </div>

              {/* Range de Datas */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="useDateRange" 
                    checked={useDateRange} 
                    onCheckedChange={(checked) => setUseDateRange(checked === true)} 
                  />
                  <label htmlFor="useDateRange" className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Filtrar por período
                  </label>
                </div>

                {useDateRange && (
                  <div className="grid grid-cols-3 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label>Campo de Data</Label>
                      <Select value={dateField} onValueChange={setDateField}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="createdAt">Data de Criação</SelectItem>
                          <SelectItem value="updatedAt">Data de Atualização</SelectItem>
                          <SelectItem value="data">Data do Registro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Data Inicial</Label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Data Final</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Progresso */}
              {exportProgress && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>{exportProgress.currentStep}</span>
                        <span>{exportProgress.recordsProcessed} / {exportProgress.totalRecords}</span>
                      </div>
                      <Progress value={exportProgress.percentage} className="h-2" />
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleExport} 
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Exportando...' : 'Exportar Dados'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Configurações de Importação
              </CardTitle>
              <CardDescription>
                Configure os parâmetros para importação dos dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seleção de Arquivo */}
              <div className="space-y-2">
                <Label>Arquivo para Importar</Label>
                <div className="flex gap-2">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.csv"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="flex-1"
                  />
                  {selectedFile && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getFormatIcon(selectedFile.name.split('.').pop() || '')}
                      {selectedFile.name}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Opções de Importação */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formato</Label>
                  <Select 
                    value={importOptions.format} 
                    onValueChange={(value) => setImportOptions(prev => ({ ...prev, format: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Modo de Importação</Label>
                  <Select 
                    value={importOptions.mode} 
                    onValueChange={(value) => setImportOptions(prev => ({ ...prev, mode: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="insert">Inserir (novos registros)</SelectItem>
                      <SelectItem value="update">Atualizar (existentes)</SelectItem>
                      <SelectItem value="upsert">Inserir ou Atualizar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Opções Avançadas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tamanho do Batch</Label>
                  <Input
                    type="number"
                    value={importOptions.batchSize}
                    onChange={(e) => setImportOptions(prev => ({ 
                      ...prev, 
                      batchSize: parseInt(e.target.value) || 50 
                    }))}
                    min="1"
                    max="500"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Campo ID (opcional)</Label>
                  <Input
                    value={importOptions.idField || ''}
                    onChange={(e) => setImportOptions(prev => ({ 
                      ...prev, 
                      idField: e.target.value || undefined 
                    }))}
                    placeholder="id"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="skipDuplicates" 
                    checked={importOptions.skipDuplicates} 
                    onCheckedChange={(checked) => setImportOptions(prev => ({ 
                      ...prev, 
                      skipDuplicates: checked === true 
                    }))} 
                  />
                  <label htmlFor="skipDuplicates" className="text-sm">
                    Pular duplicatas
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="validateData" 
                    checked={importOptions.validateData} 
                    onCheckedChange={(checked) => setImportOptions(prev => ({ 
                      ...prev, 
                      validateData: checked === true 
                    }))} 
                  />
                  <label htmlFor="validateData" className="text-sm">
                    Validar dados
                  </label>
                </div>
              </div>

              {/* Mapeamento de Campos */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Mapeamento de Campos (JSON)
                </Label>
                <Textarea
                  value={fieldMapping}
                  onChange={(e) => setFieldMapping(e.target.value)}
                  placeholder={`{
  "nome_completo": "nome",
  "e_mail": "email",
  "situacao": "status"
}`}
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              {/* Transformações */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Transformações de Dados (JSON)
                </Label>
                <Textarea
                  value={dataTransformations}
                  onChange={(e) => setDataTransformations(e.target.value)}
                  placeholder={`{
  "nome": "return value.toUpperCase();",
  "email": "return value.toLowerCase();"
}`}
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              {/* Progresso */}
              {importProgress && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Batch {importProgress.currentBatch} / {importProgress.totalBatches}</span>
                        <span>{importProgress.recordsImported} importados</span>
                      </div>
                      <Progress value={importProgress.percentage} className="h-2" />
                      <div className="text-xs text-gray-500">
                        {importProgress.recordsProcessed} processados • {importProgress.recordsSkipped} ignorados
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Button 
                onClick={handleImport} 
                disabled={isLoading || !selectedFile}
                className="w-full"
                size="lg"
              >
                {isLoading ? 'Importando...' : 'Importar Dados'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}