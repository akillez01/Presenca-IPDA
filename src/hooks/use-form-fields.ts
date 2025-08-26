import { db } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";

export type FormFieldConfig = {
  name: string;
  label: string;
  placeholder: string;
  type: 'text' | 'select';
  required: boolean;
  options?: string[];
};

export function useFormFieldsConfig() {
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ref = doc(db, 'system', 'formFields');
    const unsubscribe = onSnapshot(ref, (snap) => {
      let loadedFields = [];
      if (snap.exists()) {
        loadedFields = snap.data().fields || [];
      }
      // Verifica se já existe o campo cursoCFO
      const hasCursoCFO = loadedFields.some(f => f.name === 'cursoCFO');
      if (!hasCursoCFO) {
        loadedFields.push({
          name: 'cursoCFO',
          label: 'Curso CFO',
          placeholder: 'Selecione',
          type: 'select',
          required: true,
          options: ['Sim', 'Não'],
        });
      }
      setFields(loadedFields);
      setLoading(false);
    }, (err) => {
      setError('Erro ao carregar campos do formulário');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const saveFields = async (fields: FormFieldConfig[]) => {
    const ref = doc(db, 'system', 'formFields');
    await setDoc(ref, { fields });
  };

  return { fields, loading, error, saveFields };
}
