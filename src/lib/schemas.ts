import { z } from "zod";

const cpfRegex = /^\d{11}$/;

export const attendanceSchema = z.object({
  fullName: z.string().min(3, { message: "O nome completo deve ter pelo menos 3 caracteres." }),
  cpf: z.string().regex(cpfRegex, { message: "CPF inválido. Deve conter 11 dígitos numéricos." }),
  reclassification: z.enum(['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'], { required_error: "Selecione uma reclassificação." }),
  pastorName: z.string().min(3, { message: "O nome do pastor deve ter pelo menos 3 caracteres." }),
  cfoCourse: z.enum(["SIM", "NÃO"]).optional(),
  birthday: z.string().optional(), // Padronizado para birthday
  region: z.string().optional(),
  churchPosition: z.enum([
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
    'FInanceiro (a) Reviver',
    'Conselheiro(a) Financeiro(a)',
    'Conselheiro(a) de Expansão',
    'Conselheiro(a) Patrimonial',
    'Auxiliar Galileu (a)',
    'Auxiliar Adote uma alma (a)',
    '2º Pastor',
    '3º Pastor',
    'Técnico(a) de Som',
    'Controlador(a) de Entrada'
  ], { required_error: "Selecione um cargo." }),
  city: z.string().min(2, { message: "O nome da cidade deve ter pelo menos 2 caracteres." }),
  shift: z.enum(['Manhã', 'Tarde'], { required_error: "Selecione um turno." }),
  totvs: z.string().optional(),
  etda: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(['Presente', 'Ausente', 'Justificado']).default('Presente'),
  // photoUrl aceita URLs normais ou data URLs (base64)
  photoUrl: z.string().nullable().optional(),
});

export type AttendanceFormValues = z.infer<typeof attendanceSchema>;
