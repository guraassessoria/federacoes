/**
 * Serviço de Mapeamento de Estrutura
 * 
 * FLUXO:
 * 1. API carrega de-para do banco (DeParaMapping) e passa como parâmetro
 * 2. Contas-folha do balancete são mapeadas para códigos da estrutura padrão
 * 3. BP: totais calculados por soma bottom-up (filho → pai)
 * 4. DRE: totais calculados por FÓRMULAS ESPECÍFICAS dos totalizadores
 * 
 * FÓRMULAS DA DRE:
 *   Receita Bruta (51) = soma dos filhos (receitas)
 *   (-) Deduções (52) = soma dos filhos
 *   Receita Líquida (56) = Receita Bruta(51) + Deduções(52)  [52 é negativo]
 *   CUSTOS (57) = soma dos filhos
 *   Margem Bruta (109) = Receita Líquida(56) - CUSTOS(57)
 *   DESPESAS (110) = soma dos filhos
 *   Resultado Operacional (196) = Margem Bruta(109) - DESPESAS(110)
 *   LAREF (197) = Resultado Operacional(196)
 *   RESULTADO FINANCEIRO (198) = Rec Financeiras(199) - Desp Financeiras(207)
 *   Resultado Não Operacional (218) = Rec Não Oper(219) - Desp Não Oper(223)
 *   Lucro Antes dos Impostos (227) = LAREF(197) + Res Financeiro(198) + Res Não Oper(218)
 *   Superávit/Déficit (229) = LAI(227) - IR/CSLL(228)
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

// ─── Classificação ────────────────────────────────────────────

function getTipoDemonstracao(accountNumber: string): 'BP' | 'DRE' | null {
  const c = accountNumber.charAt(0);
  if (c === '1' || c === '2') return 'BP';
  if (c === '3' || c === '4' || c === '5') return 'DRE';
  return null;
}

// ─── Contas Folha ─────────────────────────────────────────────

function filtrarContasFolhas(data: BalanceteData[]): BalanceteData[] {
  const codigos = new Set(data.map(c => c.accountNumber));
  return data.filter(conta => {
    for (const outro of codigos) {
      if (outro !== conta.accountNumber && outro.startsWith(conta.accountNumber + '.')) return false;
    }
    return true;
  });
}

// ─── Ajuste de Sinal ──────────────────────────────────────────

/**
 * Ajusta o sinal dos valores do balancete.
 * Receitas (3.x) vêm negativas no balancete → invertemos para positivo.
 * Passivo/PL (2.x) vêm negativos → invertemos para positivo.
 * Custos/Despesas (4.x, 5.x) vêm positivos → mantemos positivo.
 * Ativos (1.x) vêm positivos → mantemos positivo.
 */
function ajustarSinal(valor: number, accountNumber: string): number {
  const c = accountNumber.charAt(0);
  if (c === '2' || c === '3') return valor * -1;
  return valor;
}

// ─── De-Para Lookup ───────────────────────────────────────────

function buildDeParaLookup(records: DeParaRecord[], tipo: 'BP' | 'DRE'): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const rec of records) {
    const cod = tipo === 'BP' ? rec.padraoBP : rec.padraoDRE;
    if (cod) lookup[rec.contaFederacao.trim()] = normalizeCodigo(cod.trim());
  }
  return lookup;
}

// ─── Mapeamento Principal ─────────────────────────────────────

export async function mapBalanceteToEstrutura(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = tipo === 'DRE' ? await loadEstruturaDRE() : await loadEstruturaBP();
  if (!estrutura?.length) return [];

  // Lookup de-para
  let lookup: Record<string, string> = {};
  if (deParaRecords?.length) {
    lookup = buildDeParaLookup(deParaRecords, tipo);
  }

  // Filtrar e mapear valores das folhas do balancete
  const contasTipo = balanceteData.filter(c => getTipoDemonstracao(c.accountNumber) === tipo);
  const folhas = filtrarContasFolhas(contasTipo);

  const valoresPorCodigo: Record<string, number> = {};
  for (const conta of folhas) {
    const codPadrao = lookup[conta.accountNumber];
    if (codPadrao) {
      const val = ajustarSinal(Number(conta.finalBalance) || 0, conta.accountNumber);
      valoresPorCodigo[codPadrao] = (valoresPorCodigo[codPadrao] || 0) + val;
    }
  }

  // Criar contas com valores analíticos
  const contasComValor: ContaComValor[] = estrutura.map((conta, idx) => ({
    ...conta,
    ordem: idx,
    valor: valoresPorCodigo[conta.codigo] || 0,
  }));

  // Calcular totais
  if (tipo === 'BP') {
    calcularTotaisBP(contasComValor);
  } else {
    calcularTotaisDRE(contasComValor);
  }

  return buildHierarchy(contasComValor);
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE TOTAIS - BP (soma bottom-up simples)
// ═══════════════════════════════════════════════════════════════

function calcularTotaisBP(contas: ContaComValor[]): void {
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, c));
  
  // Bottom-up: do nível mais profundo para o mais alto
  const ordenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  for (const conta of ordenadas) {
    if (conta.codigoSuperior && conta.valor !== 0) {
      const pai = mapa.get(conta.codigoSuperior);
      if (pai) pai.valor += conta.valor;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// CÁLCULO DE TOTAIS - DRE (fórmulas específicas)
// ═══════════════════════════════════════════════════════════════

function calcularTotaisDRE(contas: ContaComValor[]): void {
  const m = new Map<string, ContaComValor>();
  contas.forEach(c => m.set(c.codigo, c));

  const val = (cod: string): number => m.get(cod)?.valor || 0;
  const set = (cod: string, v: number) => { const c = m.get(cod); if (c) c.valor = v; };

  // ─── ETAPA 1: Soma bottom-up para grupos que são simples soma de filhos ───
  // Grupos que somam filhos: 51, 52, 57, 110, 199, 207, 219, 223, e todos os sub-grupos
  // Fazemos bottom-up APENAS para contas que NÃO são totalizadores com fórmula
  const totalizadoresComFormula = new Set([
    '56', '109', '196', '197', '198', '218', '227', '229'
  ]);

  // Bottom-up para todos os NÃO-totalizadores
  const ordenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  for (const conta of ordenadas) {
    if (conta.codigoSuperior && conta.valor !== 0) {
      // Só propaga se o pai NÃO é um totalizador com fórmula
      if (!totalizadoresComFormula.has(conta.codigoSuperior)) {
        const pai = m.get(conta.codigoSuperior);
        if (pai) pai.valor += conta.valor;
      }
    }
  }

  // ─── ETAPA 2: Calcular totalizadores com fórmulas específicas ───
  
  // Receita Líquida = Receita Bruta + Deduções (deduções são negativas)
  set('56', val('51') + val('52'));
  
  // Margem Bruta = Receita Líquida - Custos
  set('109', val('56') - val('57'));
  
  // Resultado Operacional = Margem Bruta - Despesas
  set('196', val('109') - val('110'));
  
  // LAREF = Resultado Operacional
  set('197', val('196'));
  
  // Resultado Financeiro = Receitas Financeiras - Despesas Financeiras
  set('198', val('199') - val('207'));
  
  // Resultado Não Operacional = Receitas Não Oper - Despesas Não Oper  
  // 219 = Receitas Não Operacionais, 223 = (-) Despesas Não Operacionais
  set('218', val('219') - val('223'));
  
  // Lucro Antes dos Impostos = LAREF + Result Financeiro + Result Não Oper
  set('227', val('197') + val('198') + val('218'));
  
  // Superávit/Déficit = Lucro Antes dos Impostos - IR/CSLL
  set('229', val('227') - val('228'));
}

// ─── Hierarquia ───────────────────────────────────────────────

function buildHierarchy(contas: ContaComValor[]): ContaComValor[] {
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, { ...c, children: [] }));

  const raizes: ContaComValor[] = [];
  contas.forEach(c => {
    const atual = mapa.get(c.codigo)!;
    if (c.codigoSuperior) {
      const pai = mapa.get(c.codigoSuperior);
      if (pai) { pai.children!.push(atual); }
      else { raizes.push(atual); }
    } else {
      raizes.push(atual);
    }
  });

  return raizes;
}

// ─── Processamento Completo ───────────────────────────────────

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
    mapBalanceteToEstrutura(balanceteData, 'DRE', deParaRecords),
    mapBalanceteToEstrutura(balanceteData, 'BP', deParaRecords),
  ]);

  // Resultado DRE = valor do nó 229 (Superávit/Déficit)
  const resultadoDRE = buscarValorNaArvore(dre, '229') 
    || buscarValorNaArvore(dre, '196')
    || 0;
  
  // Insere resultado no BP (Superávits/Déficits Acumulados)
  inserirResultadoNoBP(bp, resultadoDRE);
  
  // Total Passivo + PL
  const totalPassivoPL = buscarValorNaArvore(bp, '76') || 0;

  return { dre, bp, resultadoDRE, totalPassivoPL };
}

// ─── Auxiliares ───────────────────────────────────────────────

function buscarValorNaArvore(contas: ContaComValor[], codigo: string): number {
  for (const c of contas) {
    if (c.codigo === codigo) return c.valor;
    if (c.children?.length) {
      const v = buscarValorNaArvore(c.children, codigo);
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
    // Recalcular totais do BP de baixo para cima
    recalcularAncestors(bp, '141');
  }
}

function recalcularAncestors(raizes: ContaComValor[], codigoAlterado: string): void {
  const mapa = new Map<string, ContaComValor>();
  function indexar(contas: ContaComValor[]) {
    for (const c of contas) {
      mapa.set(c.codigo, c);
      if (c.children?.length) indexar(c.children);
    }
  }
  indexar(raizes);

  // 141 → 125 (PL) → 76 (PASSIVO)
  const c141 = mapa.get('141');
  if (!c141?.codigoSuperior) return;
  
  const c125 = mapa.get(c141.codigoSuperior);
  if (c125?.children) {
    c125.valor = c125.children.reduce((s, x) => s + x.valor, 0);
    if (c125.codigoSuperior) {
      const c76 = mapa.get(c125.codigoSuperior);
      if (c76?.children) {
        c76.valor = c76.children.reduce((s, x) => s + x.valor, 0);
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