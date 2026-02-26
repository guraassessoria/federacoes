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

import { BalanceteData } from '@prisma/client';
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

// ─── Cache ────────────────────────────────────────────────────

let estruturaDRECache: ContaEstrutura[] | null = null;
let estruturaBPCache: ContaEstrutura[] | null = null;

// ─── Utilitários ──────────────────────────────────────────────

function normalizeCodigo(cod: string): string {
  if (!cod) return '';
  return cod.replace(/^0+/, '') || '0';
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
  const parsed = readJsonFileSafe('estrutura_dre.json');
  if (parsed?.length) { estruturaDRECache = parsed; return estruturaDRECache; }
  return [];
}

export async function loadEstruturaBP(): Promise<ContaEstrutura[]> {
  if (estruturaBPCache) return estruturaBPCache;
  const parsed = readJsonFileSafe('estrutura_bp.json');
  if (parsed?.length) { estruturaBPCache = parsed; return estruturaBPCache; }
  return [];
}

export function setEstruturaCache(tipo: 'BP' | 'DRE', estrutura: ContaEstrutura[]) {
  if (tipo === 'BP') estruturaBPCache = estrutura;
  if (tipo === 'DRE') estruturaDRECache = estrutura;
}

export function invalidateEstruturaCache(tipo?: 'BP' | 'DRE') {
  if (!tipo || tipo === 'DRE') estruturaDRECache = null;
  if (!tipo || tipo === 'BP') estruturaBPCache = null;
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

function getTipoDemonstracao(accountNumber: string): 'BP' | 'DRE' | null {
  const c = accountNumber.charAt(0);
  if (c === '1' || c === '2') return 'BP';
  if (c === '3' || c === '4' || c === '5') return 'DRE';
  return null;
}

function filtrarContasFolhas(data: BalanceteData[]): BalanceteData[] {
  const codigos = new Set(data.map(c => c.accountNumber));
  return data.filter(conta => {
    for (const outro of codigos) {
      if (outro !== conta.accountNumber && outro.startsWith(conta.accountNumber + '.')) return false;
    }
    return true;
  });
}

function ajustarSinal(valor: number, accountNumber: string): number {
  const c = accountNumber.charAt(0);
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

// ─── Mapear Valores do Balancete ──────────────────────────────

function mapearValores(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Record<string, number> {
  let lookup: Record<string, string> = {};
  if (deParaRecords?.length) lookup = buildDeParaLookup(deParaRecords, tipo);

  const contasTipo = balanceteData.filter(c => getTipoDemonstracao(c.accountNumber) === tipo);
  const folhas = filtrarContasFolhas(contasTipo);

  const valores: Record<string, number> = {};
  for (const conta of folhas) {
    const codPadrao = lookup[conta.accountNumber];
    if (codPadrao) {
      const val = ajustarSinal(Number(conta.finalBalance) || 0, conta.accountNumber);
      valores[codPadrao] = (valores[codPadrao] || 0) + val;
    }
  }
  return valores;
}

// ═══════════════════════════════════════════════════════════════
// BP: Hierarquia padrão com soma bottom-up
// ═══════════════════════════════════════════════════════════════

export async function mapBalanceteToBP(
  balanceteData: BalanceteData[],
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = await loadEstruturaBP();
  if (!estrutura?.length) return [];

  const valores = mapearValores(balanceteData, 'BP', deParaRecords);

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
  balanceteData: BalanceteData[],
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = await loadEstruturaDRE();
  if (!estrutura?.length) return [];

  const valores = mapearValores(balanceteData, 'DRE', deParaRecords);

  // Criar mapa de contas com valores analíticos
  const mapa = new Map<string, ContaComValor>();
  estrutura.forEach((c, idx) => {
    mapa.set(c.codigo, { ...c, ordem: idx, valor: valores[c.codigo] || 0, children: [] });
  });

  // ─── ETAPA 1: Soma bottom-up para grupos NÃO-totalizadores ───
  // Grupos que somam filhos normalmente (ex: 51, 57, 110, etc.)
  // Totalizadores com fórmula NÃO recebem soma dos filhos
  const totalizadoresFormula = new Set(['56', '109', '196', '197', '198', '218', '227', '229']);

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

  set('56',  val('51') + val('52'));              // Receita Líquida = Bruta + Deduções
  set('109', val('56') - val('57'));              // Margem Bruta = Rec Líq - Custos
  set('196', val('109') - val('110'));            // Result Operacional = Margem - Despesas
  set('197', val('196'));                          // LAREF = Result Operacional
  set('198', val('199') - val('207'));            // Result Financeiro = Rec Fin - Desp Fin
  set('218', val('219') - val('223'));            // Result Não Oper = Rec - Desp
  set('227', val('197') + val('198') + val('218')); // LAI
  set('229', val('227') - val('228'));            // Superávit/Déficit

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

  // Helper: cria nó de apresentação
  const node = (cod: string, descOverride?: string): ContaComValor | null => {
    const c = mapa.get(cod);
    if (!c) return null;
    return {
      ...c,
      descricao: descOverride || c.descricao,
      nivelVisualizacao: 1, // Totalizadores são nível 1 na apresentação
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
  // 1. Receita Bruta (expandível com detalhes)
  resultado.push(nodeWithChildren('51', 'Receita Bruta')!);
  
  // 2. (-) Deduções da Receita
  if (val('52') !== 0) resultado.push(nodeWithChildren('52')!);
  
  // 3. Receita Líquida (= Receita Bruta - Deduções)
  resultado.push(node('56', 'Receita Líquida')!);
  
  // 4. (-) Custos (expandível)
  resultado.push(nodeWithChildren('57', '(-) Custos dos Serviços')!);
  
  // 5. Margem Bruta
  resultado.push(node('109', 'Margem Bruta')!);
  
  // 6. (-) Despesas (expandível)
  resultado.push(nodeWithChildren('110', '(-) Despesas Gerais')!);
  
  // 7. Resultado Operacional
  resultado.push(node('196', 'Resultado Operacional')!);
  
  // 8. LAREF
  resultado.push(node('197', 'Lucro Antes do Resultado Financeiro')!);
  
  // 9. (+/-) Resultado Financeiro (expandível, indentado)
  const resFin = nodeWithChildren('198', '(+/-) Resultado Financeiro');
  if (resFin) { resFin.nivelVisualizacao = 2; resultado.push(resFin); }
  
  // 10. (+/-) Resultado Não Operacional (expandível, indentado)
  const resNaoOper = nodeWithChildren('218', '(+/-) Outras Receitas/Despesas');
  if (resNaoOper) { resNaoOper.nivelVisualizacao = 2; resultado.push(resNaoOper); }
  
  // 11. Lucro Antes dos Impostos
  resultado.push(node('227', 'Lucro Líquido Antes dos Impostos')!);
  
  // 12. IR e CSLL
  if (val('228') !== 0) resultado.push(node('228', 'LAIR e LACS')!);
  
  // 13. Superávit/Déficit
  resultado.push(node('229', 'Superávit/Déficit do Exercício')!);

  return resultado.filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════
// Interface pública (mantém compatibilidade)
// ═══════════════════════════════════════════════════════════════

/** Mantém compatibilidade com chamadas existentes */
export async function mapBalanceteToEstrutura(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  if (tipo === 'BP') return mapBalanceteToBP(balanceteData, deParaRecords);
  return mapBalanceteToDRE(balanceteData, deParaRecords);
}

export async function processarDadosFinanceiros(
  balanceteData: BalanceteData[],
  deParaRecords?: DeParaRecord[]
): Promise<{
  dre: ContaComValor[];
  bp: ContaComValor[];
  resultadoDRE: number;
  totalPassivoPL: number;
}> {
  const [dre, bp] = await Promise.all([
    mapBalanceteToDRE(balanceteData, deParaRecords),
    mapBalanceteToBP(balanceteData, deParaRecords),
  ]);

  // Resultado = valor do Superávit/Déficit (229)
  const resultadoDRE = dre.find(c => c.codigo === '229')?.valor || 0;

  // Inserir resultado no BP
  inserirResultadoNoBP(bp, resultadoDRE);
  
  // Total Passivo + PL
  const totalPassivoPL = buscarValor(bp, '76') || 0;

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
  
  function buscar(contas: ContaComValor[]): boolean {
    for (const c of contas) {
      if (c.codigo === '141') {
        c.valor += resultado;
        return true;
      }
      if (c.children?.length && buscar(c.children)) return true;
    }
    return false;
  }
  
  if (buscar(bp)) {
    // Recalcular ancestors: 141 → 125 → 76
    const mapa = new Map<string, ContaComValor>();
    function indexar(contas: ContaComValor[]) {
      for (const c of contas) { mapa.set(c.codigo, c); if (c.children?.length) indexar(c.children); }
    }
    indexar(bp);
    
    const c141 = mapa.get('141');
    if (c141?.codigoSuperior) {
      const c125 = mapa.get(c141.codigoSuperior);
      if (c125?.children) {
        c125.valor = c125.children.reduce((s, x) => s + x.valor, 0);
        if (c125.codigoSuperior) {
          const c76 = mapa.get(c125.codigoSuperior);
          if (c76?.children) c76.valor = c76.children.reduce((s, x) => s + x.valor, 0);
        }
      }
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