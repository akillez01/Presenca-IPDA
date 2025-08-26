"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormFieldConfig, useFormFieldsConfig } from "@/hooks/use-form-fields";
import React, { useState } from "react";

export function FormFieldsManager() {
  const { fields, loading, error, saveFields } = useFormFieldsConfig();
  const [editFields, setEditFields] = useState<FormFieldConfig[]>([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  React.useEffect(() => {
    setEditFields(fields);
  }, [fields]);

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando campos do formulário...</div>;
  }
  if (error) {
    return <div className="p-8 text-center text-red-600">{error}</div>;
  }

  const handleFieldChange = (idx: number, key: keyof FormFieldConfig, value: any) => {
    setEditFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
  };
  const handleOptionChange = (fieldIdx: number, optIdx: number, value: string) => {
    setEditFields(prev => prev.map((f, i) => i === fieldIdx ? { ...f, options: (f.options || []).map((o, j) => j === optIdx ? value : o) } : f));
  };
  const handleAddOption = (fieldIdx: number) => {
    setEditFields(prev => prev.map((f, i) => i === fieldIdx ? { ...f, options: [...(f.options || []), ""] } : f));
  };
  const handleRemoveOption = (fieldIdx: number, optIdx: number) => {
    setEditFields(prev => prev.map((f, i) => i === fieldIdx ? { ...f, options: (f.options || []).filter((_, j) => j !== optIdx) } : f));
  };
  const handleAddField = () => {
    setEditFields(prev => ([...prev, { name: '', label: '', placeholder: '', type: 'text', required: false, options: [] }]));
  };
  const handleRemoveField = (idx: number) => {
    setEditFields(prev => prev.filter((_, i) => i !== idx));
  };
  const handleSave = async () => {
    setSaving(true);
    setSuccess(null);
    setErrMsg(null);
    try {
      await saveFields(editFields);
      setSuccess("Campos do formulário salvos com sucesso!");
    } catch (e) {
      setErrMsg("Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto mt-8">
      <CardHeader>
        <CardTitle>Gerenciar Todos os Campos do Formulário de Presença</CardTitle>
        <p className="text-muted-foreground text-sm mt-2">Adicione, edite ou remova qualquer campo do formulário. Campos do tipo lista permitem opções dinâmicas.</p>
      </CardHeader>
      <CardContent>
        {editFields.map((field, idx) => (
          <div key={idx} className="mb-8 border-b pb-6">
            <div className="flex gap-2 mb-2">
              <Input value={field.name} onChange={e => handleFieldChange(idx, 'name', e.target.value)} placeholder="name (ex: cpf)" className="w-32" />
              <Input value={field.label} onChange={e => handleFieldChange(idx, 'label', e.target.value)} placeholder="Label (ex: CPF)" className="w-40" />
              <Input value={field.placeholder} onChange={e => handleFieldChange(idx, 'placeholder', e.target.value)} placeholder="Placeholder" className="w-40" />
              <select value={field.type} onChange={e => handleFieldChange(idx, 'type', e.target.value as 'text' | 'select')} className="border rounded px-2 py-1">
                <option value="text">Texto</option>
                <option value="select">Lista</option>
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input type="checkbox" checked={field.required} onChange={e => handleFieldChange(idx, 'required', e.target.checked)} /> Obrigatório
              </label>
              <Button variant="destructive" size="sm" onClick={() => handleRemoveField(idx)}>- Remover campo</Button>
            </div>
            {field.type === 'select' && (
              <div className="ml-4">
                <div className="font-semibold text-xs mb-1">Opções:</div>
                {(field.options || []).map((opt, optIdx) => (
                  <div key={optIdx} className="flex items-center gap-2 mb-1">
                    <Input value={opt} onChange={e => handleOptionChange(idx, optIdx, e.target.value)} placeholder="Opção" className="w-64" />
                    <Button variant="destructive" size="sm" onClick={() => handleRemoveOption(idx, optIdx)}>-</Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => handleAddOption(idx)}>Adicionar opção</Button>
              </div>
            )}
          </div>
        ))}
        <Button variant="outline" onClick={handleAddField}>Adicionar novo campo</Button>
        <Button className="ml-2" onClick={handleSave} disabled={saving}>Salvar todos</Button>
        {success && <span className="ml-4 text-green-600">{success}</span>}
        {errMsg && <span className="ml-4 text-red-600">{errMsg}</span>}
      </CardContent>
    </Card>
  );
}
