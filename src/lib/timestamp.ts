// Função utilitária para garantir que o valor é uma data válida
export function safeGetTime(e: any): number | null {
  if (!e) return null;
  try {
    if (e instanceof Date) {
      return e.getTime();
    }
    if (typeof e === 'number') {
      return new Date(e).getTime();
    }
    if (typeof e === 'string') {
      const d = new Date(e);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
    if (typeof e.toDate === 'function') {
      const d = e.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.getTime() : null;
    }
  } catch {
    return null;
  }
  return null;
}
