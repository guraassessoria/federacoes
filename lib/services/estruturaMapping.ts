/**
 * Serviço de Mapeamento de Estrutura
 * 
 * BP: Hierarquia padrão (ATIVO/PASSIVO como raízes, soma bottom-up)
 * 
 * DRE: Apresentação sequencial de totalizadores (como no padrão contábil):
 *   Receita Bruta           → expandível → detalhes das receitas
 *   Receita Líquida         = Receita Bruta - Deduções
 *   (-) Custos              → expandível → detalhes dos custos
 *   Margem Bruta            = Receita Líquida - Custos
 *   (-) Despesas            → expandível → detalhes das despesas
 *   Resultado Operacional   = Margem Bruta - Despesas
 *   LAREF                   = Resultado Operacional
 *   (+/-) Resultado Financeiro → expandível
 *   (+/-) Resultado Não Oper   → expandível
 *   Lucro Antes dos Impostos = LAREF + Res Fin + Res Não Oper
 *   IR e CSLL
 *   Superávit/Déficit       = LAI - IR
 */

import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

// ─── Tipos ────────────────────────────────────────────────────

export interface ContaEstrutura {
  codigo: string;
  descricao: string;
  codigoSuperior: string | null;
  nivel: number;
  nivelVisualizacao: number;
  ordem?: number;
}

export interface ContaComValor extends ContaEstrutura {
  valor: number;
  children?: ContaComValor[];
}

export interface DeParaRecord {
  contaFederacao: string;
  padraoBP: string | null;
  padraoDRE: string | null;
  padraoDFC: string | null;
  padraoDMPL: string | null;
}

type BalanceteInput = {
  accountCode?: string | null;
  conta?: string | null;
  closingBalance?: unknown;
  saldoFinal?: unknown;
};

// ─── Cache ────────────────────────────────────────────────────

let estruturaDRECache: ContaEstrutura[] | null = null;
let estruturaBPCache: ContaEstrutura[] | null = null;
let aliasesDRECache: Record<string, string> | null = null;
let aliasesBPCache: Record<string, string> | null = null;

// ─── Utilitários ──────────────────────────────────────────────

function normalizeCodigo(cod: string): string {
  if (!cod) return '';
  return cod.replace(/^0+/, '') || '0';
}

function normalizeText(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function includesAllTerms(text: string, terms: string[]): boolean {
  const normalized = normalizeText(text);
  return terms.every(term => normalized.includes(normalizeText(term)));
}

function findCodigoByDescricao(
  estrutura: ContaEstrutura[],
  termSets: string[][],
  fallbackCodigos: string[] = []
): string | null {
  for (const terms of termSets) {
    const matches = estrutura
      .filter(item => includesAllTerms(item.descricao, terms))
      .sort((a, b) => {
        if (a.nivel !== b.nivel) return a.nivel - b.nivel;
        return (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER);
      });

    if (matches.length > 0) return matches[0].codigo;
  }

  for (const codigo of fallbackCodigos) {
    if (estrutura.some(item => item.codigo === codigo)) return codigo;
  }

  return null;
}

function normalizeEstruturaRows(rows: any[]): ContaEstrutura[] {
  return rows
    .map((row: any) => {
      const codigo = normalizeCodigo(String(row?.codigo || '').trim());
      if (!codigo) return null;
      return {
        codigo,
        descricao: String(row?.descricao || '').trim(),
        codigoSuperior: row?.codigoSuperior ? normalizeCodigo(String(row.codigoSuperior).trim()) : null,
        nivel: Number(row?.nivel) || 1,
        nivelVisualizacao: Number(row?.nivelVisualizacao ?? row?.nivel) || 1,
        ordem: Number.isFinite(Number(row?.ordem)) ? Number(row.ordem) : undefined,
      } as ContaEstrutura;
    })
    .filter(Boolean) as ContaEstrutura[];
}

async function loadEstruturaFromStandardStructure(tipo: 'BP' | 'DRE'): Promise<{ rows: ContaEstrutura[]; aliases: Record<string, string> } | null> {
  const record = await prisma.standardStructure.findUnique({
    where: { type: tipo as any },
    select: { data: true },
  });

  const data = record?.data as any;
  const rawRows = Array.isArray(data?.rows) ? data.rows : [];
  if (!rawRows.length) return null;

  const rows = normalizeEstruturaRows(rawRows);
  if (!rows.length) return null;

  const rawAliases = data?.meta?.codeAliases && typeof data.meta.codeAliases === 'object'
    ? data.meta.codeAliases
    : {};

  const aliases: Record<string, string> = {};
  for (const [oldCode, newCode] of Object.entries(rawAliases)) {
    const from = normalizeCodigo(String(oldCode || '').trim());
    const to = normalizeCodigo(String(newCode || '').trim());
    if (from && to && from !== to) aliases[from] = to;
  }

  return { rows, aliases };
}

function readJsonFileSafe(fileName: string): any[] | null {
  const paths = [
    path.join(process.cwd(), 'public', 'data', fileName),
    path.resolve('public', 'data', fileName),
    path.join(process.cwd(), '.next', 'server', 'public', 'data', fileName),
  ];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) { /* next */ }
  }
  return null;
}

// ─── Carregamento ─────────────────────────────────────────────

export async function loadEstruturaDRE(): Promise<ContaEstrutura[]> {
  if (estruturaDRECache) return estruturaDRECache;

  const fromDb = await loadEstruturaFromStandardStructure('DRE');
  if (fromDb?.rows?.length) {
    estruturaDRECache = fromDb.rows;
    aliasesDRECache = fromDb.aliases;
    return estruturaDRECache;
  }

  const parsed = readJsonFileSafe('estrutura_dre.json');
  if (parsed?.length) {
    estruturaDRECache = normalizeEstruturaRows(parsed);
    aliasesDRECache = {};
    return estruturaDRECache;
  }

  aliasesDRECache = {};
  return [];
}

export async function loadEstruturaBP(): Promise<ContaEstrutura[]> {
  if (estruturaBPCache) return estruturaBPCache;

  const fromDb = await loadEstruturaFromStandardStructure('BP');
  if (fromDb?.rows?.length) {
    estruturaBPCache = fromDb.rows;
    aliasesBPCache = fromDb.aliases;
    return estruturaBPCache;
  }

  const parsed = readJsonFileSafe('estrutura_bp.json');
  if (parsed?.length) {
    estruturaBPCache = normalizeEstruturaRows(parsed);
    aliasesBPCache = {};
    return estruturaBPCache;
  }

  aliasesBPCache = {};
  return [];
}

export function setEstruturaCache(tipo: 'BP' | 'DRE', estrutura: ContaEstrutura[]) {
  if (tipo === 'BP') estruturaBPCache = estrutura;
  if (tipo === 'DRE') estruturaDRECache = estrutura;
}

export function invalidateEstruturaCache(tipo?: 'BP' | 'DRE') {
  if (!tipo || tipo === 'DRE') {
    estruturaDRECache = null;
    aliasesDRECache = null;
  }
  if (!tipo || tipo === 'BP') {
    estruturaBPCache = null;
    aliasesBPCache = null;
  }
}

export function dbRowsToContaEstrutura(rows: any[]): ContaEstrutura[] {
  return rows.map((row: any) => ({
    codigo: String(row.codigo || ''),
    descricao: String(row.descricao || ''),
    codigoSuperior: row.codigoSuperior ? String(row.codigoSuperior) : null,
    nivel: Number(row.nivel) || 1,
    nivelVisualizacao: Number(row.nivelVisualizacao ?? row.nivel) || 1,
  }));
}

// ─── Classificação e Filtro ───────────────────────────────────

function getTipoDemonstracao(accountCode: string): 'BP' | 'DRE' | null {
  const c = accountCode.charAt(0);
  if (c === '1' || c === '2') return 'BP';
  if (c === '3' || c === '4' || c === '5') return 'DRE';
  return null;
}

function getContaCodigo(conta: BalanceteInput): string {
  return String(conta.accountCode ?? conta.conta ?? '').trim();
}

function getContaSaldoFinal(conta: BalanceteInput): number {
  const raw = conta.closingBalance ?? conta.saldoFinal;
  return Number(raw) || 0;
}

function filtrarContasFolhas(data: BalanceteInput[]): BalanceteInput[] {
  const codigos = new Set(data.map(getContaCodigo).filter(Boolean));
  return data.filter(conta => {
    const codigo = getContaCodigo(conta);
    if (!codigo) return false;
    for (const outro of codigos) {
      if (outro !== codigo && outro.startsWith(codigo + '.')) return false;
    }
    return true;
  });
}

function ajustarSinal(valor: number, accountCode: string): number {
  const c = accountCode.charAt(0);
  if (c === '2' || c === '3') return valor * -1;
  return valor;
}

function buildDeParaLookup(records: DeParaRecord[], tipo: 'BP' | 'DRE'): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const rec of records) {
    const cod = tipo === 'BP' ? rec.padraoBP : rec.padraoDRE;
    if (cod) lookup[rec.contaFederacao.trim()] = normalizeCodigo(cod.trim());
  }
  return lookup;
}

function resolveCodigoComAliases(codigo: string, tipo: 'BP' | 'DRE'): string {
  const aliases = tipo === 'BP' ? (aliasesBPCache || {}) : (aliasesDRECache || {});
  let current = normalizeCodigo(codigo);
  const visited = new Set<string>();

  while (aliases[current] && !visited.has(current)) {
    visited.add(current);
    current = normalizeCodigo(aliases[current]);
  }

  return current;
}

// ─── Mapear Valores do Balancete ──────────────────────────────

function mapearValores(
  balancetes: BalanceteInput[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Record<string, number> {
  let lookup: Record<string, string> = {};
  if (deParaRecords?.length) lookup = buildDeParaLookup(deParaRecords, tipo);

  const contasTipo = balancetes.filter(c => getTipoDemonstracao(getContaCodigo(c)) === tipo);
  const folhas = filtrarContasFolhas(contasTipo);

  const valores: Record<string, number> = {};
  for (const conta of folhas) {
    const contaCodigo = getContaCodigo(conta);
    const codPadrao = lookup[contaCodigo];
    if (codPadrao) {
      const codResolvido = resolveCodigoComAliases(codPadrao, tipo);
      const val = ajustarSinal(getContaSaldoFinal(conta), contaCodigo);
      valores[codResolvido] = (valores[codResolvido] || 0) + val;
    }
  }
  return valores;
}

// ═══════════════════════════════════════════════════════════════
// BP: Hierarquia padrão com soma bottom-up
// ═══════════════════════════════════════════════════════════════

export async function mapBalanceteToBP(
  balancetes: BalanceteInput[],
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = await loadEstruturaBP();
  if (!estrutura?.length) return [];

  const valores = mapearValores(balancetes, 'BP', deParaRecords);

  const contas: ContaComValor[] = estrutura.map(c => ({
    ...c,
    valor: valores[c.codigo] || 0,
  }));

  // Bottom-up sum
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, c));
  const ordenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  for (const conta of ordenadas) {
    if (conta.codigoSuperior && conta.valor !== 0) {
      const pai = mapa.get(conta.codigoSuperior);
      if (pai) pai.valor += conta.valor;
    }
  }

  // Build tree
  return buildTree(contas);
}

function buildTree(contas: ContaComValor[]): ContaComValor[] {
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, { ...c, children: [] }));

  const raizes: ContaComValor[] = [];
  contas.forEach(c => {
    const atual = mapa.get(c.codigo)!;
    if (c.codigoSuperior) {
      const pai = mapa.get(c.codigoSuperior);
      if (pai) pai.children!.push(atual);
      else raizes.push(atual);
    } else {
      raizes.push(atual);
    }
  });
  return raizes;
}

// ═══════════════════════════════════════════════════════════════
// DRE: Apresentação sequencial com fórmulas
// ═══════════════════════════════════════════════════════════════

export async function mapBalanceteToDRE(
  balancetes: BalanceteInput[],
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = await loadEstruturaDRE();
  if (!estrutura?.length) return [];

  const valores = mapearValores(balancetes, 'DRE', deParaRecords);

  // Criar mapa de contas com valores analíticos
  const mapa = new Map<string, ContaComValor>();
  estrutura.forEach((c, idx) => {
    mapa.set(c.codigo, { ...c, ordem: idx, valor: valores[c.codigo] || 0, children: [] });
  });

  const codigosDRE = {
    receitaBruta: findCodigoByDescricao(estrutura, [['receita', 'bruta']], ['51']),
    deducoes: findCodigoByDescricao(estrutura, [['dedu', 'receita']], ['52']),
    receitaLiquida: findCodigoByDescricao(estrutura, [['receita', 'liquida']], ['56']),
    custos: findCodigoByDescricao(estrutura, [['custo']], ['57']),
    margemBruta: findCodigoByDescricao(estrutura, [['margem', 'bruta']], ['109']),
    despesas: findCodigoByDescricao(estrutura, [['despesa', 'ger'], ['despesa', 'operacional'], ['despesa']], ['110']),
    resultadoOperacional: findCodigoByDescricao(estrutura, [['resultado', 'operacional']], ['196']),
    laref: findCodigoByDescricao(estrutura, [['lucro', 'antes', 'resultado', 'financeiro'], ['laref']], ['197']),
    resultadoFinanceiro: findCodigoByDescricao(estrutura, [['resultado', 'financeiro']], ['198']),
    receitasFinanceiras: findCodigoByDescricao(estrutura, [['receita', 'financeira']], ['199']),
    despesasFinanceiras: findCodigoByDescricao(estrutura, [['despesa', 'financeira']], ['207']),
    resultadoNaoOperacional: findCodigoByDescricao(estrutura, [['resultado', 'nao', 'oper'], ['outras', 'receitas', 'despesas']], ['218']),
    receitasNaoOperacionais: findCodigoByDescricao(estrutura, [['receita', 'nao', 'oper'], ['outras', 'receitas']], ['219']),
    despesasNaoOperacionais: findCodigoByDescricao(estrutura, [['despesa', 'nao', 'oper'], ['outras', 'despesas']], ['223']),
    lucroAntesImpostos: findCodigoByDescricao(estrutura, [['lucro', 'antes', 'imposto'], ['resultado', 'antes', 'imposto']], ['227']),
    irCsll: findCodigoByDescricao(estrutura, [['ir', 'csll'], ['imposto', 'renda'], ['contribuicao', 'social']], ['228']),
    superavitDeficit: findCodigoByDescricao(estrutura, [['superavit'], ['deficit', 'exercicio'], ['resultado', 'liquido']], ['229']),
  };

  // ─── ETAPA 1: Soma bottom-up para grupos NÃO-totalizadores ───
  // Grupos que somam filhos normalmente; totalizadores com fórmula não recebem soma dos filhos
  const totalizadoresFormula = new Set(
    [
      codigosDRE.receitaLiquida,
      codigosDRE.margemBruta,
      codigosDRE.resultadoOperacional,
      codigosDRE.laref,
      codigosDRE.resultadoFinanceiro,
      codigosDRE.resultadoNaoOperacional,
      codigosDRE.lucroAntesImpostos,
      codigosDRE.superavitDeficit,
    ].filter(Boolean) as string[]
  );

  const ordenadas = [...estrutura].sort((a, b) => b.nivel - a.nivel);
  for (const item of ordenadas) {
    const conta = mapa.get(item.codigo)!;
    if (conta.codigoSuperior && conta.valor !== 0) {
      if (!totalizadoresFormula.has(conta.codigoSuperior)) {
        const pai = mapa.get(conta.codigoSuperior);
        if (pai) pai.valor += conta.valor;
      }
    }
  }

  // ─── ETAPA 2: Fórmulas específicas ───
  const val = (cod: string) => mapa.get(cod)?.valor || 0;
  const set = (cod: string, v: number) => { const c = mapa.get(cod); if (c) c.valor = v; };

  const receitaBrutaVal = codigosDRE.receitaBruta ? val(codigosDRE.receitaBruta) : 0;
  const deducoesVal = codigosDRE.deducoes ? val(codigosDRE.deducoes) : 0;
  const receitaLiquidaVal = codigosDRE.receitaLiquida
    ? receitaBrutaVal + deducoesVal
    : receitaBrutaVal + deducoesVal;

  if (codigosDRE.receitaLiquida) set(codigosDRE.receitaLiquida, receitaLiquidaVal);

  const custosVal = codigosDRE.custos ? val(codigosDRE.custos) : 0;
  const margemBrutaVal = receitaLiquidaVal - custosVal;
  if (codigosDRE.margemBruta) set(codigosDRE.margemBruta, margemBrutaVal);

  const despesasVal = codigosDRE.despesas ? val(codigosDRE.despesas) : 0;
  const resultadoOperacionalVal = margemBrutaVal - despesasVal;
  if (codigosDRE.resultadoOperacional) set(codigosDRE.resultadoOperacional, resultadoOperacionalVal);

  const larefVal = resultadoOperacionalVal;
  if (codigosDRE.laref) set(codigosDRE.laref, larefVal);

  const resultadoFinanceiroVal =
    (codigosDRE.receitasFinanceiras ? val(codigosDRE.receitasFinanceiras) : 0) -
    (codigosDRE.despesasFinanceiras ? val(codigosDRE.despesasFinanceiras) : 0);
  if (codigosDRE.resultadoFinanceiro) set(codigosDRE.resultadoFinanceiro, resultadoFinanceiroVal);

  const resultadoNaoOperacionalVal =
    (codigosDRE.receitasNaoOperacionais ? val(codigosDRE.receitasNaoOperacionais) : 0) -
    (codigosDRE.despesasNaoOperacionais ? val(codigosDRE.despesasNaoOperacionais) : 0);
  if (codigosDRE.resultadoNaoOperacional) set(codigosDRE.resultadoNaoOperacional, resultadoNaoOperacionalVal);

  const lucroAntesImpostosVal = larefVal + resultadoFinanceiroVal + resultadoNaoOperacionalVal;
  if (codigosDRE.lucroAntesImpostos) set(codigosDRE.lucroAntesImpostos, lucroAntesImpostosVal);

  const irCsllVal = codigosDRE.irCsll ? val(codigosDRE.irCsll) : 0;
  const superavitDeficitVal = lucroAntesImpostosVal - irCsllVal;
  if (codigosDRE.superavitDeficit) set(codigosDRE.superavitDeficit, superavitDeficitVal);

  // ─── ETAPA 3: Montar árvore interna (para detalhes expandíveis) ───
  // Cada grupo que tem filhos recebe seus filhos como children
  estrutura.forEach(c => {
    if (c.codigoSuperior) {
      const pai = mapa.get(c.codigoSuperior);
      const filho = mapa.get(c.codigo);
      if (pai && filho) pai.children!.push(filho);
    }
  });

  // ─── ETAPA 4: Montar apresentação sequencial ───
  // Retorna lista flat de seções na ordem de apresentação contábil
  const resultado: ContaComValor[] = [];

  // Helper: cria nó SEM children (totalizador = só exibe valor, não expandível)
  const node = (cod: string, descOverride?: string): ContaComValor | null => {
    const c = mapa.get(cod);
    if (!c) return null;
    return {
      ...c,
      descricao: descOverride || c.descricao,
      nivelVisualizacao: 1,
      children: [], // IMPORTANTE: limpar children para não duplicar
    };
  };

  // Helper: cria nó com filhos re-nivelados para apresentação
  const nodeWithChildren = (cod: string, descOverride?: string): ContaComValor | null => {
    const c = mapa.get(cod);
    if (!c) return null;
    return {
      ...c,
      descricao: descOverride || c.descricao,
      nivelVisualizacao: 1,
      children: reNivelar(c.children || [], 1),
    };
  };

  // Re-nivela children para apresentação (nível relativo ao pai)
  function reNivelar(children: ContaComValor[], parentLevel: number): ContaComValor[] {
    return children.map(child => ({
      ...child,
      nivelVisualizacao: parentLevel + 1,
      children: child.children?.length ? reNivelar(child.children, parentLevel + 1) : [],
    }));
  }

  // ── Ordem de apresentação da DRE ──
  // Regra: grupos de DADOS são expandíveis (mostram detalhes)
  //        totalizadores CALCULADOS são apenas linhas de resultado (sem children)
  
  // 1. Receita Bruta (expandível → detalhes das receitas)
  if (codigosDRE.receitaBruta) resultado.push(nodeWithChildren(codigosDRE.receitaBruta, 'Receita Bruta')!);
  
  // 2. (-) Deduções da Receita (expandível se houver)
  if (codigosDRE.deducoes && val(codigosDRE.deducoes) !== 0) resultado.push(nodeWithChildren(codigosDRE.deducoes)!);
  
  // 3. Receita Líquida = Receita Bruta - Deduções (SEM children)
  if (codigosDRE.receitaLiquida) resultado.push(node(codigosDRE.receitaLiquida, 'Receita Líquida')!);
  
  // 4. (-) Custos (expandível → detalhes dos custos)
  if (codigosDRE.custos) resultado.push(nodeWithChildren(codigosDRE.custos, '(-) Custos dos Serviços')!);
  
  // 5. Margem Bruta = Receita Líquida - Custos (SEM children)
  if (codigosDRE.margemBruta) resultado.push(node(codigosDRE.margemBruta, 'Margem Bruta')!);
  
  // 6. (-) Despesas (expandível → detalhes das despesas)
  if (codigosDRE.despesas) resultado.push(nodeWithChildren(codigosDRE.despesas, '(-) Despesas Gerais')!);
  
  // 7. Resultado Operacional = Margem - Despesas (SEM children)
  if (codigosDRE.resultadoOperacional) resultado.push(node(codigosDRE.resultadoOperacional, 'Resultado Operacional')!);
  
  // 8. LAREF = Resultado Operacional (SEM children)
  if (codigosDRE.laref) resultado.push(node(codigosDRE.laref, 'Lucro Antes do Resultado Financeiro')!);
  
  // 9. (+/-) Resultado Financeiro (expandível, indentado nível 2)
  const resFin = codigosDRE.resultadoFinanceiro
    ? nodeWithChildren(codigosDRE.resultadoFinanceiro, '(+/-) Resultado Financeiro')
    : null;
  if (resFin) { resFin.nivelVisualizacao = 2; resultado.push(resFin); }
  
  // 10. (+/-) Outras Receitas/Despesas (expandível, indentado nível 2)
  const resNaoOper = codigosDRE.resultadoNaoOperacional
    ? nodeWithChildren(codigosDRE.resultadoNaoOperacional, '(+/-) Outras Receitas/Despesas')
    : null;
  if (resNaoOper) { resNaoOper.nivelVisualizacao = 2; resultado.push(resNaoOper); }
  
  // 11. Lucro Antes dos Impostos (SEM children)
  if (codigosDRE.lucroAntesImpostos) resultado.push(node(codigosDRE.lucroAntesImpostos, 'Lucro Líquido Antes dos Impostos')!);
  
  // 12. IR e CSLL (se houver)
  if (codigosDRE.irCsll && val(codigosDRE.irCsll) !== 0) resultado.push(node(codigosDRE.irCsll, 'LAIR e LACS')!);
  
  // 13. Superávit/Déficit (SEM children)
  if (codigosDRE.superavitDeficit) resultado.push(node(codigosDRE.superavitDeficit, 'Superávit/Déficit do Exercício')!);

  if (resultado.length === 0) {
    return estrutura
      .filter(conta => conta.nivel <= 2)
      .map(conta => ({
        ...conta,
        valor: mapa.get(conta.codigo)?.valor || 0,
        children: reNivelar(mapa.get(conta.codigo)?.children || [], conta.nivelVisualizacao),
      }));
  }

  return resultado.filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// Interface pública (mantém compatibilidade)
// ═══════════════════════════════════════════════════════════════

/** Mantém compatibilidade com chamadas existentes */
export async function mapBalanceteToEstrutura(
  balancetes: BalanceteInput[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  if (tipo === 'BP') return mapBalanceteToBP(balancetes, deParaRecords);
  return mapBalanceteToDRE(balancetes, deParaRecords);
}

export async function processarDadosFinanceiros(
  balancetes: BalanceteInput[],
  deParaRecords?: DeParaRecord[]
): Promise<{
  dre: ContaComValor[];
  bp: ContaComValor[];
  resultadoDRE: number;
  totalPassivoPL: number;
}> {
  const [dre, bp] = await Promise.all([
    mapBalanceteToDRE(balancetes, deParaRecords),
    mapBalanceteToBP(balancetes, deParaRecords),
  ]);

  // Resultado = Superávit/Déficit por descrição (fallback códigos legados)
  const resultadoConta =
    dre.find(c => includesAllTerms(c.descricao, ['superavit'])) ||
    dre.find(c => includesAllTerms(c.descricao, ['deficit', 'exercicio'])) ||
    dre.find(c => c.codigo === '229');
  const resultadoDRE = resultadoConta?.valor || 0;

  // Inserir resultado no BP
  inserirResultadoNoBP(bp, resultadoDRE);
  
  // Total Passivo + PL (preferir raiz de passivo por descrição)
  const passivoRoot = bp.find(c => includesAllTerms(c.descricao, ['passivo'])) || bp.find(c => c.codigo === '76');
  const totalPassivoPL = passivoRoot?.valor || 0;

  return { dre, bp, resultadoDRE, totalPassivoPL };
}

// ─── Auxiliares BP ────────────────────────────────────────────

function buscarValor(contas: ContaComValor[], codigo: string): number {
  for (const c of contas) {
    if (c.codigo === codigo) return c.valor;
    if (c.children?.length) {
      const v = buscarValor(c.children, codigo);
      if (v !== 0) return v;
    }
  }
  return 0;
}

function inserirResultadoNoBP(bp: ContaComValor[], resultado: number): void {
  if (resultado === 0) return;

  const superavitNode = flattenHierarchy(bp).find(conta =>
    includesAllTerms(conta.descricao, ['superavit']) && includesAllTerms(conta.descricao, ['acumul'])
  ) || flattenHierarchy(bp).find(conta =>
    includesAllTerms(conta.descricao, ['deficit']) && includesAllTerms(conta.descricao, ['acumul'])
  ) || flattenHierarchy(bp).find(conta => conta.codigo === '141');

  if (!superavitNode) return;
  const superavitCodigo = superavitNode.codigo;
  
  function buscar(contas: ContaComValor[]): boolean {
    for (const c of contas) {
      if (c.codigo === superavitCodigo) {
        c.valor += resultado;
        return true;
      }
      if (c.children?.length && buscar(c.children)) return true;
    }
    return false;
  }
  
  if (buscar(bp)) {
    const mapa = new Map<string, ContaComValor>();
    function indexar(contas: ContaComValor[]) {
      for (const c of contas) { mapa.set(c.codigo, c); if (c.children?.length) indexar(c.children); }
    }
    indexar(bp);

    let atual = mapa.get(superavitCodigo);
    while (atual?.codigoSuperior) {
      const pai = mapa.get(atual.codigoSuperior);
      if (!pai?.children) break;
      pai.valor = pai.children.reduce((s, x) => s + x.valor, 0);
      atual = pai;
    }
  }
}

// ─── Flatten ──────────────────────────────────────────────────

export function flattenHierarchy(contas: ContaComValor[], resultado: ContaComValor[] = []): ContaComValor[] {
  for (const c of contas) {
    resultado.push(c);
    if (c.children?.length) flattenHierarchy(c.children, resultado);
  }
  return resultado;
}