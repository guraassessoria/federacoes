/**
 * Serviço de Mapeamento de Estrutura
 * Adapta dados do balancete à estrutura base padronizada usando o mapeamento "de-para"
 * 
 * ATUALIZADO: Carrega estruturas dos JSONs estáticos (garantido funcionar).
 * A integração com o banco (StandardStructure) é feita pela API que chama
 * este serviço, passando a estrutura como parâmetro quando disponível.
 */

import { BalanceteData } from '@prisma/client';
import fs from 'fs';
import path from 'path';

// Tipos para a estrutura base
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

export interface MapeamentoDePara {
  codigoPadrao: string;
  descricaoPadrao: string;
}

export interface DeParaMapping {
  BP: Record<string, MapeamentoDePara>;
  DRE: Record<string, MapeamentoDePara>;
  DFC: Record<string, MapeamentoDePara>;
  DMPL: Record<string, MapeamentoDePara>;
}

// Cache para estruturas carregadas
let estruturaDRECache: ContaEstrutura[] | null = null;
let estruturaBPCache: ContaEstrutura[] | null = null;
let deParaMappingCache: DeParaMapping | null = null;

/**
 * Tenta ler um arquivo JSON estático de múltiplos caminhos possíveis.
 * Na Vercel, process.cwd() pode variar.
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
        const parsed = JSON.parse(content);
        return parsed;
      }
    } catch (e) {
      // tenta próximo caminho
    }
  }

  console.error(`[readJsonFileSafe] Não encontrou ${fileName} em nenhum caminho`);
  return null;
}

/**
 * Converte as rows do banco (formato JSON) para o formato ContaEstrutura[]
 * Usado quando a API passa estruturas carregadas do banco de dados.
 */
export function dbRowsToContaEstrutura(rows: any[]): ContaEstrutura[] {
  return rows.map((row: any) => ({
    codigo: String(row.codigo || ''),
    descricao: String(row.descricao || ''),
    codigoSuperior: row.codigoSuperior ? String(row.codigoSuperior) : null,
    nivel: Number(row.nivel) || 1,
    nivelVisualizacao: Number(row.nivelVisualizacao ?? row.nivel) || 1,
  }));
}

/**
 * Carrega a estrutura base do DRE (JSON estático)
 */
export async function loadEstruturaDRE(): Promise<ContaEstrutura[]> {
  if (estruturaDRECache) return estruturaDRECache;
  
  const parsed = readJsonFileSafe('estrutura_dre.json');
  if (parsed && parsed.length > 0) {
    estruturaDRECache = parsed;
    return estruturaDRECache;
  }

  console.error('[loadEstruturaDRE] Falha ao carregar JSON estático');
  return [];
}

/**
 * Carrega a estrutura base do BP (JSON estático)
 */
export async function loadEstruturaBP(): Promise<ContaEstrutura[]> {
  if (estruturaBPCache) return estruturaBPCache;
  
  const parsed = readJsonFileSafe('estrutura_bp.json');
  if (parsed && parsed.length > 0) {
    estruturaBPCache = parsed;
    return estruturaBPCache;
  }

  console.error('[loadEstruturaBP] Falha ao carregar JSON estático');
  return [];
}

/**
 * Permite sobrescrever o cache com estruturas carregadas do banco.
 * Chamado pela API financial-data quando há estrutura no banco.
 */
export function setEstruturaCache(tipo: 'BP' | 'DRE', estrutura: ContaEstrutura[]) {
  if (tipo === 'BP') estruturaBPCache = estrutura;
  if (tipo === 'DRE') estruturaDRECache = estrutura;
}

/**
 * Invalida os caches de estrutura
 */
export function invalidateEstruturaCache(tipo?: 'BP' | 'DRE') {
  if (!tipo || tipo === 'DRE') estruturaDRECache = null;
  if (!tipo || tipo === 'BP') estruturaBPCache = null;
}

/**
 * Carrega o mapeamento de-para
 */
export async function loadDeParaMapping(): Promise<DeParaMapping> {
  if (deParaMappingCache) return deParaMappingCache;
  
  const filePath = path.join(process.cwd(), 'public', 'data', 'de_para_mapping.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  deParaMappingCache = JSON.parse(fileContent);
  return deParaMappingCache!;
}

/**
 * Determina o tipo de demonstração com base no código da conta
 */
function getTipoDemonstracao(accountNumber: string): 'BP' | 'DRE' | null {
  const firstChar = accountNumber.charAt(0);
  if (firstChar === '1' || firstChar === '2') return 'BP'; // Ativo/Passivo
  if (firstChar === '3' || firstChar === '4' || firstChar === '5') return 'DRE'; // Receitas/Custos/Despesas
  return null;
}

/**
 * MAPEAMENTO DE CONTAS ANALÍTICAS DO BALANÇO PATRIMONIAL
 * 
 * IMPORTANTE: Apenas contas ANALÍTICAS (último nível) devem ser mapeadas.
 * As contas sintéticas são calculadas automaticamente pela soma das suas filhas.
 * 
 * CÓDIGOS DA ESTRUTURA BASE BP:
 * 4 = Caixa, 5 = Bancos, 6 = Aplicações Financeiras
 * 15 = Outras Contas a Receber
 * 45 = Edificações, 55 = Equipamentos, 60 = Veículos, 64 = Móveis e Utensílios
 * 48 = Depreciação Edificações, 59 = Depreciação Equipamentos, 63 = Depreciação Veículos, 67 = Depreciação Móveis
 * 79 = Fornecedores Nacionais, 82 = Salários a Pagar, 83 = INSS a Recolher, 84 = FGTS a Recolher, 87 = PIS a Recolher
 * 127 = Capital Subscrito, 141 = Superávits/Déficits Acumulados
 */
const MAPEAMENTO_BP_ANALITICAS: Record<string, {codigoPadrao: string; descricao: string}> = {
  // ===== ATIVO CIRCULANTE - DISPONIBILIDADES =====
  '1.1.10.100.001': { codigoPadrao: '4', descricao: 'Caixa' },
  '1.1.10.200.006': { codigoPadrao: '5', descricao: 'Bancos Conta Movimento' },
  '1.1.10.200.008': { codigoPadrao: '6', descricao: 'Aplicações Financeiras' },
  
  // ===== ATIVO CIRCULANTE - CONTAS A RECEBER =====
  '1.1.20.100.006': { codigoPadrao: '15', descricao: 'Outras Contas a Receber' },
  '1.1.20.100.009': { codigoPadrao: '15', descricao: 'Outras Contas a Receber' },
  '1.1.20.100.015': { codigoPadrao: '15', descricao: 'Outras Contas a Receber' },
  
  // ===== ATIVO NÃO CIRCULANTE - IMOBILIZADO =====
  '1.2.21.100.001': { codigoPadrao: '55', descricao: 'Equipamentos - Máquinas' },
  '1.2.21.100.002': { codigoPadrao: '55', descricao: 'Equipamentos - Informática' },
  '1.2.21.100.003': { codigoPadrao: '55', descricao: 'Equipamentos - Som' },
  '1.2.21.100.004': { codigoPadrao: '55', descricao: 'Equipamentos - Comunicação' },
  '1.2.21.200.002': { codigoPadrao: '45', descricao: 'Edificações' },
  '1.2.21.300.001': { codigoPadrao: '64', descricao: 'Móveis e Utensílios' },
  '1.2.21.300.002': { codigoPadrao: '64', descricao: 'Acessórios para Móveis' },
  '1.2.21.310.001': { codigoPadrao: '60', descricao: 'Veículos - Motocicletas' },
  
  // ===== ATIVO NÃO CIRCULANTE - DEPRECIAÇÕES =====
  '1.2.21.500.005': { codigoPadrao: '59', descricao: 'Depreciação - Informática' },
  '1.2.21.500.006': { codigoPadrao: '59', descricao: 'Depreciação - Som' },
  '1.2.21.500.100': { codigoPadrao: '59', descricao: 'Depreciação - Máquinas' },
  '1.2.21.500.200': { codigoPadrao: '48', descricao: 'Depreciação - Edificações' },
  '1.2.21.500.300': { codigoPadrao: '67', descricao: 'Depreciação - Móveis' },
  '1.2.21.500.500': { codigoPadrao: '59', descricao: 'Depreciação - Comunicação' },
  '1.2.21.500.600': { codigoPadrao: '63', descricao: 'Depreciação - Veículos' },
  
  // ===== PASSIVO CIRCULANTE - FORNECEDORES =====
  '2.1.20.100.0': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.1': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.2': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.3': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.7': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.8': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.9': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.10': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  '2.1.20.100.103': { codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  
  // ===== PASSIVO CIRCULANTE - OBRIGAÇÕES =====
  '2.1.20.200.001': { codigoPadrao: '83', descricao: 'INSS a Recolher' },
  '2.1.20.200.002': { codigoPadrao: '84', descricao: 'FGTS a Recolher' },
  '2.1.20.200.010': { codigoPadrao: '87', descricao: 'PIS a Recolher' },
  '2.1.20.400.003': { codigoPadrao: '82', descricao: 'Salários a Pagar' },
  
  // ===== PATRIMÔNIO LÍQUIDO =====
  '2.2.11.100.001': { codigoPadrao: '127', descricao: 'Capital Subscrito / Patrimônio Social' },
  '2.2.11.300.001': { codigoPadrao: '141', descricao: 'Superávits Acumulados' },
  '2.2.11.300.002': { codigoPadrao: '141', descricao: 'Déficits Acumulados' },
};

/**
 * MAPEAMENTO DE CONTAS ANALÍTICAS DA DRE
 * 
 * IMPORTANTE: Apenas contas ANALÍTICAS (último nível) devem ser mapeadas.
 * As contas sintéticas são calculadas automaticamente pela soma das suas filhas.
 * 
 * Este objeto precisa ser mantido/atualizado conforme o plano de contas da empresa.
 * TODO: No futuro, este mapeamento pode vir do banco de dados (DeParaMapping).
 */
const MAPEAMENTO_DRE_ANALITICAS: Record<string, {codigoPadrao: string; descricao: string}> = {
  // ===== RECEITAS OPERACIONAIS =====
  '3.1.11.100.001': { codigoPadrao: '3', descricao: 'Receitas de Competições Estaduais' },
  '3.1.11.100.002': { codigoPadrao: '3', descricao: 'Receitas de Competições Nacionais' },
  '3.1.11.100.003': { codigoPadrao: '3', descricao: 'Receitas de Outras Competições' },
  '3.1.11.200.001': { codigoPadrao: '6', descricao: 'Taxas de Registro de Atletas' },
  '3.1.11.200.002': { codigoPadrao: '6', descricao: 'Taxas de Transferência' },
  '3.1.11.200.003': { codigoPadrao: '6', descricao: 'Emolumentos Diversos' },
  '3.1.11.300.001': { codigoPadrao: '10', descricao: 'Contribuição Obrigatória de Clubes' },
  '3.1.11.300.002': { codigoPadrao: '10', descricao: 'Anuidade de Filiação' },
  '3.1.11.300.003': { codigoPadrao: '10', descricao: 'Contribuição de Ligas' },
  '3.1.11.400.001': { codigoPadrao: '13', descricao: 'Subvenções Governamentais' },
  '3.1.11.500.001': { codigoPadrao: '16', descricao: 'Receita de Patrocínios' },
  '3.1.11.500.002': { codigoPadrao: '16', descricao: 'Receita de Publicidade' },
  '3.1.11.600.001': { codigoPadrao: '19', descricao: 'Receitas de Convênios' },
  '3.1.11.600.002': { codigoPadrao: '19', descricao: 'Receitas de Projetos Sociais' },
  '3.1.11.700.001': { codigoPadrao: '22', descricao: 'Receitas com Cessão de Direitos' },
  '3.1.11.800.001': { codigoPadrao: '24', descricao: 'Receitas com Cursos e Clínicas' },
  '3.1.11.800.002': { codigoPadrao: '24', descricao: 'Receitas com Seminários' },
  '3.1.11.900.001': { codigoPadrao: '27', descricao: 'Multas e Penalidades' },
  '3.1.11.900.002': { codigoPadrao: '27', descricao: 'Rendimento de Aplicações' },
  '3.1.11.900.003': { codigoPadrao: '27', descricao: 'Outras Receitas Operacionais' },
  
  // ===== CUSTOS OPERACIONAIS =====
  '4.1.11.100.001': { codigoPadrao: '53', descricao: 'Custos com Arbitragem' },
  '4.1.11.100.002': { codigoPadrao: '53', descricao: 'Custos com Premiação' },
  '4.1.11.100.003': { codigoPadrao: '53', descricao: 'Custos com Logística de Jogos' },
  '4.1.11.200.001': { codigoPadrao: '57', descricao: 'Custos com Capacitação Técnica' },
  '4.1.11.200.002': { codigoPadrao: '57', descricao: 'Custos com Material Esportivo' },
  '4.1.11.300.001': { codigoPadrao: '60', descricao: 'Custos com Delegações' },
  '4.1.11.300.002': { codigoPadrao: '60', descricao: 'Custos com Transporte' },
  
  // ===== CUSTOS COM COMPETIÇÕES DETALHADOS =====
  '4.2.11.100.001': { codigoPadrao: '53', descricao: 'Alimentação Competições' },
  '4.2.11.100.002': { codigoPadrao: '53', descricao: 'Hospedagem Competições' },
  '4.2.11.100.003': { codigoPadrao: '53', descricao: 'Transporte Competições' },
  '4.2.11.100.004': { codigoPadrao: '53', descricao: 'Material Competições' },
  '4.2.11.200.001': { codigoPadrao: '53', descricao: 'Premiação Competições' },
  '4.2.11.200.002': { codigoPadrao: '53', descricao: 'Troféus e Medalhas' },
  '4.2.11.300.001': { codigoPadrao: '53', descricao: 'Locação de Estádios' },
  '4.2.11.300.002': { codigoPadrao: '53', descricao: 'Segurança em Eventos' },
  '4.2.11.400.001': { codigoPadrao: '53', descricao: 'Taxas CBF' },
  '4.2.11.500.001': { codigoPadrao: '53', descricao: 'Seguro de Atletas' },
  
  // ===== CUSTOS COM REPASSES A CLUBES =====
  '4.2.11.800.001': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.002': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.003': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.004': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.005': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.006': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.007': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.008': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.009': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.010': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.011': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.012': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.013': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.014': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.015': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.016': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.017': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.018': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.019': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.020': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.021': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.025': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.029': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.030': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.035': { codigoPadrao: '66', descricao: 'Repasse a Federações' },
  '4.2.11.800.036': { codigoPadrao: '66', descricao: 'Repasse a Federações' },
  '4.2.11.800.037': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.038': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.039': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.040': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.041': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.042': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.043': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.044': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.045': { codigoPadrao: '66', descricao: 'Repasse a Federações' },
  '4.2.11.800.046': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  '4.2.11.800.047': { codigoPadrao: '66', descricao: 'Repasse a Clubes' },
  
  // ===== DEPARTAMENTO DE ARBITRAGEM =====
  '4.2.11.900.001': { codigoPadrao: '61', descricao: 'Depto Árbitros - CBF' },
  '4.2.11.900.004': { codigoPadrao: '61', descricao: 'Quadro Móvel' },
  '4.2.11.900.006': { codigoPadrao: '139', descricao: 'Sindicato dos Atletas Profissionais' },
};

/**
 * Encontra o código padrão para uma conta ANALÍTICA usando mapeamento direto
 * 
 * IMPORTANTE: Este mapeamento é APENAS para contas analíticas (último nível).
 * Se a conta não estiver no mapeamento, retorna null e ela será ignorada.
 */
function encontrarCodigoPadrao(accountNumber: string, tipo: 'BP' | 'DRE'): string | null {
  const mapeamento = tipo === 'BP' ? MAPEAMENTO_BP_ANALITICAS : MAPEAMENTO_DRE_ANALITICAS;
  
  // Busca direta pela conta analítica exata
  const mapped = mapeamento[accountNumber];
  if (mapped) {
    return mapped.codigoPadrao;
  }
  
  return null;
}

/**
 * Filtra apenas contas folhas (contas que não têm filhos no balancete)
 */
function filtrarContasFolhas(balanceteData: BalanceteData[]): BalanceteData[] {
  const todosCodigos = [...new Set(balanceteData.map(c => c.accountNumber))];
  
  return balanceteData.filter(conta => {
    const codigoAtual = conta.accountNumber;
    
    for (const codigo of todosCodigos) {
      if (codigo === codigoAtual) continue;
      if (eFilho(codigoAtual, codigo)) {
        return false;
      }
    }
    
    return true;
  });
}

/**
 * Verifica se codigoFilho é filho de codigoPai no plano de contas
 */
function eFilho(codigoPai: string, codigoFilho: string): boolean {
  if (codigoFilho.startsWith(codigoPai + '.')) {
    return true;
  }
  
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  
  if (partesFilho.length < partesPai.length) {
    return false;
  }
  
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) {
      return false;
    }
  }
  
  const ultimaPartePai = partesPai[partesPai.length - 1];
  const parteCorrespondente = partesFilho[partesPai.length - 1];
  
  if (parteCorrespondente.startsWith(ultimaPartePai)) {
    if (parteCorrespondente.length > ultimaPartePai.length) {
      return true;
    }
    if (partesFilho.length > partesPai.length) {
      return true;
    }
  }
  
  return false;
}

/**
 * Ajusta o sinal do valor conforme a natureza da conta
 */
function ajustarSinal(valor: number, accountNumber: string): number {
  const firstChar = accountNumber.charAt(0);
  
  if (firstChar === '2' || firstChar === '3') {
    return valor * -1;
  }
  
  return valor;
}

/**
 * Mapeia os dados do balancete para a estrutura base
 */
export async function mapBalanceteToEstrutura(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE'
): Promise<ContaComValor[]> {
  // Carregar estrutura (agora tenta o banco primeiro!)
  const estrutura = tipo === 'DRE' ? await loadEstruturaDRE() : await loadEstruturaBP();
  
  // Filtrar apenas contas do tipo correto
  const contasTipo = balanceteData.filter(conta => {
    const tipoAtual = getTipoDemonstracao(conta.accountNumber);
    return tipoAtual === tipo;
  });
  
  // Filtrar apenas contas folhas para evitar duplicação
  const contasFolhas = filtrarContasFolhas(contasTipo);
  
  console.log(`[Mapeamento ${tipo}] Total contas: ${contasTipo.length}, Contas folhas: ${contasFolhas.length}`);
  
  // Criar mapa de valores por código da estrutura padrão
  const valoresPorCodigo: Record<string, number> = {};
  
  for (const conta of contasFolhas) {
    const codigoPadrao = encontrarCodigoPadrao(conta.accountNumber, tipo);
    
    if (codigoPadrao) {
      const valorOriginal = Number(conta.finalBalance) || 0;
      const valorAjustado = ajustarSinal(valorOriginal, conta.accountNumber);
      valoresPorCodigo[codigoPadrao] = (valoresPorCodigo[codigoPadrao] || 0) + valorAjustado;
    }
  }
  
  // Criar estrutura com valores
  const contasComValor: ContaComValor[] = estrutura.map(conta => ({
    ...conta,
    valor: valoresPorCodigo[conta.codigo] || 0
  }));
  
  // Calcular totais dos níveis superiores (bottom-up)
  calcularTotais(contasComValor);
  
  // Construir hierarquia
  return buildHierarchy(contasComValor);
}

/**
 * Contas retificadoras que devem ser SUBTRAÍDAS do pai
 */
const CONTAS_RETIFICADORAS_DRE = new Set(['199', '213', '214', '221']);

/**
 * Calcula os totais dos níveis superiores somando os filhos
 */
function calcularTotais(contas: ContaComValor[]): void {
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, c));
  
  const contasOrdenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  
  for (const conta of contasOrdenadas) {
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

/**
 * Constrói a árvore hierárquica a partir da lista plana
 */
function buildHierarchy(contas: ContaComValor[]): ContaComValor[] {
  const mapa = new Map<string, ContaComValor>();
  const raizes: ContaComValor[] = [];
  
  contas.forEach(conta => {
    const contaAtual: ContaComValor = { ...conta, children: [] };
    mapa.set(conta.codigo, contaAtual);
  });
  
  contas.forEach(conta => {
    const contaAtual = mapa.get(conta.codigo)!;
    if (conta.codigoSuperior) {
      const codigoSuperior = conta.codigoSuperior.replace('.0', '');
      const pai = mapa.get(codigoSuperior);
      if (pai) {
        pai.children = pai.children || [];
        pai.children.push(contaAtual);
      } else {
        raizes.push(contaAtual);
      }
    } else {
      raizes.push(contaAtual);
    }
  });
  
  return raizes;
}

/**
 * Processa dados do balancete e retorna estruturas completas de BP e DRE
 */
export async function processarDadosFinanceiros(
  balanceteData: BalanceteData[]
): Promise<{
  dre: ContaComValor[];
  bp: ContaComValor[];
  resultadoDRE: number;
  totalPassivoPL: number;
}> {
  const [dre, bp] = await Promise.all([
    mapBalanceteToEstrutura(balanceteData, 'DRE'),
    mapBalanceteToEstrutura(balanceteData, 'BP')
  ]);
  
  const resultadoDRE = calcularResultadoDRE(dre);
  console.log(`[processarDadosFinanceiros] Resultado DRE calculado: ${resultadoDRE}`);
  
  inserirResultadoNoBP(bp, resultadoDRE);
  
  const totalPassivoPL = calcularTotalPassivoPL(bp);
  console.log(`[processarDadosFinanceiros] Total Passivo + PL: ${totalPassivoPL}`);
  
  return { dre, bp, resultadoDRE, totalPassivoPL };
}

/**
 * Calcula o resultado líquido a partir da hierarquia da DRE
 */
function calcularResultadoDRE(dre: ContaComValor[]): number {
  function buscarValor(contas: ContaComValor[], codigo: string): number {
    for (const conta of contas) {
      if (conta.codigo === codigo) {
        return conta.valor;
      }
      if (conta.children && conta.children.length > 0) {
        const valorEncontrado = buscarValor(conta.children, codigo);
        if (valorEncontrado !== 0) return valorEncontrado;
      }
    }
    return 0;
  }
  
  let resultado = buscarValor(dre, '225');
  if (resultado === 0) {
    resultado = buscarValor(dre, '210');
  }
  
  return resultado;
}

/**
 * Insere o resultado da DRE na conta 141 do BP e recalcula os totais
 */
function inserirResultadoNoBP(bp: ContaComValor[], resultadoDRE: number): void {
  function buscarEInserir(contas: ContaComValor[]): boolean {
    for (const conta of contas) {
      if (conta.codigo === '141') {
        const valorAnterior = conta.valor;
        conta.valor = valorAnterior + resultadoDRE;
        console.log(`[inserirResultadoNoBP] Conta 141: ${valorAnterior} + Resultado DRE ${resultadoDRE} = ${conta.valor}`);
        return true;
      }
      
      if (conta.codigo === '125' && conta.children) {
        const conta141 = conta.children.find(c => c.codigo === '141');
        if (conta141) {
          const valorAnterior = conta141.valor;
          conta141.valor = valorAnterior + resultadoDRE;
          console.log(`[inserirResultadoNoBP] Conta 141 (filho de 125): ${valorAnterior} + Resultado DRE ${resultadoDRE} = ${conta141.valor}`);
          
          conta.valor = conta.children.reduce((sum, child) => sum + child.valor, 0);
          console.log(`[inserirResultadoNoBP] Total PL recalculado: ${conta.valor}`);
          return true;
        }
      }
      
      if (conta.children && conta.children.length > 0) {
        if (buscarEInserir(conta.children)) return true;
      }
    }
    return false;
  }
  
  buscarEInserir(bp);
}

/**
 * Calcula o total de Passivo + Patrimônio Líquido
 */
function calcularTotalPassivoPL(bp: ContaComValor[]): number {
  let totalPassivo = 0;
  let totalPL = 0;
  
  function buscarTotais(contas: ContaComValor[]): void {
    for (const conta of contas) {
      if (conta.codigo === '76') totalPassivo = conta.valor;
      if (conta.codigo === '125') totalPL = conta.valor;
      if (conta.children && conta.children.length > 0) {
        buscarTotais(conta.children);
      }
    }
  }
  
  buscarTotais(bp);
  return totalPassivo + totalPL;
}

/**
 * Achata a hierarquia para exibição em tabela
 */
export function flattenHierarchy(contas: ContaComValor[], resultado: ContaComValor[] = []): ContaComValor[] {
  for (const conta of contas) {
    resultado.push(conta);
    if (conta.children && conta.children.length > 0) {
      flattenHierarchy(conta.children, resultado);
    }
  }
  return resultado;
}