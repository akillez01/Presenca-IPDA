"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attendanceSchema = void 0;
var zod_1 = require("zod");
var cpfRegex = /^\d{11}$/;
exports.attendanceSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(3, { message: "O nome completo deve ter pelo menos 3 caracteres." }),
    cpf: zod_1.z.string().regex(cpfRegex, { message: "CPF inválido. Deve conter 11 dígitos numéricos." }),
    reclassification: zod_1.z.enum(['Local', 'Setorial', 'Central', 'Casa de oração', 'Estadual', 'Regional'], { required_error: "Selecione uma reclassificação." }),
    pastorName: zod_1.z.string().min(3, { message: "O nome do pastor deve ter pelo menos 3 caracteres." }),
    region: zod_1.z.string().min(2, { message: "A região deve ter pelo menos 2 caracteres." }),
    churchPosition: zod_1.z.enum([
        'Conselheiro(a)',
        'Financeiro(a)',
        'Secretário(a)',
        'Pastor',
        'Presbítero',
        'Diácono',
        'Dirigente 1',
        'Dirigente 2',
        'Dirigente 3',
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
    ], { required_error: "Selecione um cargo." }),
    city: zod_1.z.string().min(2, { message: "O nome da cidade deve ter pelo menos 2 caracteres." }),
    shift: zod_1.z.enum(['Manhã', 'Tarde', 'Noite'], { required_error: "Selecione um turno." }),
    status: zod_1.z.enum(['Presente', 'Ausente', 'Justificado'], { required_error: "Selecione um status." }),
});
