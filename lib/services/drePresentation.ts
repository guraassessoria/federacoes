type ContaBasica = {
  codigo?: string;
  descricao?: string;
};

function normalizarTexto(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isReceitaBruta(conta: ContaBasica): boolean {
  const descricao = normalizarTexto(conta.descricao || '');
  if (descricao.includes('receita liquida')) return false;
  if (descricao.includes('receita bruta')) return true;

  const codigo = (conta.codigo || '').trim();
  if (codigo === '51') return true;
  return false;
}

export function ordenarDreReceitaBrutaPrimeiro<T extends ContaBasica>(rows: T[]): T[] {
  if (!Array.isArray(rows) || rows.length <= 1) return rows;

  const indexReceitaBruta = rows.findIndex(isReceitaBruta);
  if (indexReceitaBruta <= 0) return rows;

  return [rows[indexReceitaBruta], ...rows.slice(0, indexReceitaBruta), ...rows.slice(indexReceitaBruta + 1)];
}

type ContaArvore = ContaBasica & {
  children?: ContaArvore[];
};

export function ordenarArvoreDreReceitaBrutaPrimeiro<T extends ContaArvore>(rows: T[]): T[] {
  const orderedRoot = ordenarDreReceitaBrutaPrimeiro(rows);

  return orderedRoot.map((row) => {
    if (!row.children?.length) return row;

    return {
      ...row,
      children: ordenarArvoreDreReceitaBrutaPrimeiro(row.children as T[]),
    } as T;
  });
}
