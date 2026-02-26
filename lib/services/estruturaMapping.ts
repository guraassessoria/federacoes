/**
 * Serviço de Mapeamento de Estrutura
 * Adapta dados do balancete à estrutura base padronizada usando o mapeamento "de-para"
 * 
 * FLUXO:
 * 1. A API financial-data carrega o de-para do banco (DeParaMapping)
 * 2. Passa como parâmetro para processarDadosFinanceiros()
 * 3. Este serviço usa o de-para para mapear contas do balancete → estrutura padrão
 * 
 * NORMALIZAÇÃO DE CÓDIGOS:
 * - O de-para do banco pode usar códigos COM zeros ('0004')
 * - O JSON estático usa códigos SEM zeros ('4')
 * - Normalizamos removendo zeros à esquerda para compatibilidade
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
}

export interface ContaComValor extends ContaEstrutura {
  valor: number;
  children?: ContaComValor[];
}

/** Registro de de-para vindo do banco de dados */
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

/**
 * Remove zeros à esquerda de um código ('0004' → '4', '0143' → '143')
 */
function normalizeCodigo(cod: string): string {
  if (!cod) return '';
  const trimmed = cod.replace(/^0+/, '');
  return trimmed || '0';
}

/**
 * Tenta ler um arquivo JSON estático de múltiplos caminhos.
 */
function readJsonFileSafe(fileName: string): any[] | null {
  const possiblePaths = [
    path.join(process.cwd(), 'public', 'data', fileName),
    path.resolve('public', 'data', fileName),
    path.join(process.cwd(), '.next', 'server', 'public', 'data', fileName),
  ];
  for (const filePath of possiblePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) { /* tenta próximo */ }
  }
  console.error(`[readJsonFileSafe] Não encontrou ${fileName}`);
  return null;
}

// ─── Carregamento de Estruturas ───────────────────────────────

export async function loadEstruturaDRE(): Promise<ContaEstrutura[]> {
  if (estruturaDRECache) return estruturaDRECache;
  const parsed = readJsonFileSafe('estrutura_dre.json');
  if (parsed && parsed.length > 0) { estruturaDRECache = parsed; return estruturaDRECache; }
  console.error('[loadEstruturaDRE] Falha ao carregar');
  return [];
}

export async function loadEstruturaBP(): Promise<ContaEstrutura[]> {
  if (estruturaBPCache) return estruturaBPCache;
  const parsed = readJsonFileSafe('estrutura_bp.json');
  if (parsed && parsed.length > 0) { estruturaBPCache = parsed; return estruturaBPCache; }
  console.error('[loadEstruturaBP] Falha ao carregar');
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
  const firstChar = accountNumber.charAt(0);
  if (firstChar === '1' || firstChar === '2') return 'BP';
  if (firstChar === '3' || firstChar === '4' || firstChar === '5') return 'DRE';
  return null;
}

// ─── Contas Folha ─────────────────────────────────────────────

function filtrarContasFolhas(balanceteData: BalanceteData[]): BalanceteData[] {
  const todosCodigos = [...new Set(balanceteData.map(c => c.accountNumber))];
  return balanceteData.filter(conta => {
    for (const outro of todosCodigos) {
      if (outro !== conta.accountNumber && eFilho(conta.accountNumber, outro)) return false;
    }
    return true;
  });
}

function eFilho(codigoPai: string, codigoFilho: string): boolean {
  if (codigoFilho.startsWith(codigoPai + '.')) return true;
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  if (partesFilho.length < partesPai.length) return false;
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) return false;
  }
  const ultimaPai = partesPai[partesPai.length - 1];
  const parteCorr = partesFilho[partesPai.length - 1];
  if (parteCorr.startsWith(ultimaPai)) {
    if (parteCorr.length > ultimaPai.length) return true;
    if (partesFilho.length > partesPai.length) return true;
  }
  return false;
}

// ─── Ajuste de Sinal ──────────────────────────────────────────

function ajustarSinal(valor: number, accountNumber: string): number {
  const firstChar = accountNumber.charAt(0);
  if (firstChar === '2' || firstChar === '3') return valor * -1;
  return valor;
}

// ─── Construção do De-Para Lookup ─────────────────────────────

function buildDeParaLookup(
  deParaRecords: DeParaRecord[],
  tipo: 'BP' | 'DRE'
): Record<string, string> {
  const lookup: Record<string, string> = {};
  for (const rec of deParaRecords) {
    const contaFed = rec.contaFederacao.trim();
    let codigoPadrao: string | null = null;
    if (tipo === 'BP') codigoPadrao = rec.padraoBP;
    if (tipo === 'DRE') codigoPadrao = rec.padraoDRE;
    if (codigoPadrao) {
      // Normaliza: '0004' → '4' para compatibilidade com estrutura JSON
      lookup[contaFed] = normalizeCodigo(codigoPadrao.trim());
    }
  }
  return lookup;
}

// ─── Mapeamento Principal ─────────────────────────────────────

/**
 * Mapeia dados do balancete para a estrutura base.
 * 
 * @param balanceteData - Dados do balancete
 * @param tipo - 'BP' ou 'DRE'
 * @param deParaRecords - De-para do banco. NECESSÁRIO para mapeamento correto.
 */
export async function mapBalanceteToEstrutura(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE',
  deParaRecords?: DeParaRecord[]
): Promise<ContaComValor[]> {
  const estrutura = tipo === 'DRE' ? await loadEstruturaDRE() : await loadEstruturaBP();
  
  if (!estrutura || estrutura.length === 0) {
    console.error(`[mapBalanceteToEstrutura] Estrutura ${tipo} vazia!`);
    return [];
  }

  // Construir lookup
  let lookup: Record<string, string> = {};
  if (deParaRecords && deParaRecords.length > 0) {
    lookup = buildDeParaLookup(deParaRecords, tipo);
    console.log(`[Mapeamento ${tipo}] De-para do banco: ${Object.keys(lookup).length} mapeamentos`);
  } else {
    console.warn(`[Mapeamento ${tipo}] Sem de-para, valores ficarão zerados`);
  }

  // Filtrar contas
  const contasTipo = balanceteData.filter(c => getTipoDemonstracao(c.accountNumber) === tipo);
  const contasFolhas = filtrarContasFolhas(contasTipo);

  // Mapear valores
  const valoresPorCodigo: Record<string, number> = {};
  let mapeadas = 0;
  let naoMapeadas = 0;
  
  for (const conta of contasFolhas) {
    const codigoPadrao = lookup[conta.accountNumber];
    if (codigoPadrao) {
      const valorOriginal = Number(conta.finalBalance) || 0;
      const valorAjustado = ajustarSinal(valorOriginal, conta.accountNumber);
      valoresPorCodigo[codigoPadrao] = (valoresPorCodigo[codigoPadrao] || 0) + valorAjustado;
      mapeadas++;
    } else {
      naoMapeadas++;
    }
  }
  
  console.log(`[Mapeamento ${tipo}] Folhas: ${contasFolhas.length}, Mapeadas: ${mapeadas}, Sem mapeamento: ${naoMapeadas}`);

  // Estrutura com valores
  const contasComValor: ContaComValor[] = estrutura.map(conta => ({
    ...conta,
    valor: valoresPorCodigo[conta.codigo] || 0,
  }));

  calcularTotais(contasComValor);
  return buildHierarchy(contasComValor);
}

// ─── Cálculos ─────────────────────────────────────────────────

const CONTAS_RETIFICADORAS_DRE = new Set(['199', '213', '214', '221']);

function calcularTotais(contas: ContaComValor[]): void {
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, c));
  const ordenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  for (const conta of ordenadas) {
    if (conta.codigoSuperior) {
      const pai = mapa.get(conta.codigoSuperior.replace('.0', ''));
      if (pai) {
        if (CONTAS_RETIFICADORAS_DRE.has(conta.codigo)) {
          pai.valor -= conta.valor;
        } else {
          pai.valor += conta.valor;
        }
      }
    }
  }
}

function buildHierarchy(contas: ContaComValor[]): ContaComValor[] {
  const mapa = new Map<string, ContaComValor>();
  const raizes: ContaComValor[] = [];
  contas.forEach(c => mapa.set(c.codigo, { ...c, children: [] }));
  contas.forEach(c => {
    const atual = mapa.get(c.codigo)!;
    if (c.codigoSuperior) {
      const supCod = c.codigoSuperior.replace('.0', '');
      const pai = mapa.get(supCod);
      if (pai) { pai.children!.push(atual); } else { raizes.push(atual); }
    } else { raizes.push(atual); }
  });
  return raizes;
}

// ─── Processamento Completo ───────────────────────────────────

/**
 * Processa dados do balancete e retorna BP e DRE completos.
 * 
 * @param balanceteData - Dados do balancete
 * @param deParaRecords - De-para do banco (NECESSÁRIO para valores corretos)
 */
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
  const resultadoDRE = calcularResultadoDRE(dre);
  inserirResultadoNoBP(bp, resultadoDRE);
  const totalPassivoPL = calcularTotalPassivoPL(bp);
  return { dre, bp, resultadoDRE, totalPassivoPL };
}

// ─── Resultado da DRE ─────────────────────────────────────────

function calcularResultadoDRE(dre: ContaComValor[]): number {
  function buscar(contas: ContaComValor[], codigo: string): number {
    for (const c of contas) {
      if (c.codigo === codigo) return c.valor;
      if (c.children?.length) { const v = buscar(c.children, codigo); if (v !== 0) return v; }
    }
    return 0;
  }
  return buscar(dre, '225') || buscar(dre, '210');
}

function inserirResultadoNoBP(bp: ContaComValor[], resultadoDRE: number): void {
  function buscar(contas: ContaComValor[]): boolean {
    for (const c of contas) {
      if (c.codigo === '141') { c.valor += resultadoDRE; return true; }
      if (c.codigo === '125' && c.children) {
        const c141 = c.children.find(x => x.codigo === '141');
        if (c141) {
          c141.valor += resultadoDRE;
          c.valor = c.children.reduce((s, x) => s + x.valor, 0);
          return true;
        }
      }
      if (c.children?.length && buscar(c.children)) return true;
    }
    return false;
  }
  buscar(bp);
}

function calcularTotalPassivoPL(bp: ContaComValor[]): number {
  let tP = 0, tPL = 0;
  function buscar(contas: ContaComValor[]): void {
    for (const c of contas) {
      if (c.codigo === '76') tP = c.valor;
      if (c.codigo === '125') tPL = c.valor;
      if (c.children?.length) buscar(c.children);
    }
  }
  buscar(bp);
  return tP + tPL;
}

// ─── Flatten ──────────────────────────────────────────────────

export function flattenHierarchy(contas: ContaComValor[], resultado: ContaComValor[] = []): ContaComValor[] {
  for (const c of contas) {
    resultado.push(c);
    if (c.children?.length) flattenHierarchy(c.children, resultado);
  }
  return resultado;
}