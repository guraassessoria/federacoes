/**
 * Serviço de Mapeamento de Estrutura
 * Adapta dados do balancete à estrutura base padronizada usando o mapeamento "de-para"
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
 * Carrega a estrutura base do DRE
 */
export async function loadEstruturaDRE(): Promise<ContaEstrutura[]> {
  if (estruturaDRECache) return estruturaDRECache;
  
  const filePath = path.join(process.cwd(), 'public', 'data', 'estrutura_dre.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  estruturaDRECache = JSON.parse(fileContent);
  return estruturaDRECache!;
}

/**
 * Carrega a estrutura base do BP
 */
export async function loadEstruturaBP(): Promise<ContaEstrutura[]> {
  if (estruturaBPCache) return estruturaBPCache;
  
  const filePath = path.join(process.cwd(), 'public', 'data', 'estrutura_bp.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  estruturaBPCache = JSON.parse(fileContent);
  return estruturaBPCache!;
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
 * CÓDIGOS DA ESTRUTURA BASE DRE:
 * 40 = Outras Receitas Operacionais, 191 = Receitas Financeiras
 * 54 = Organização de Jogos, 61 = Honorários de Árbitros, 66 = Prêmios em Dinheiro, 67 = Troféus, 69 = Material Esportivo
 * 106 = Salários, 111 = Encargos, 115 = Benefícios
 * 126 = Instalações, 131 = Utilidades, 136 = Material, 139 = Serviços, 155 = Seguros, 158 = Viagens, 164 = Marketing
 * 180 = Tributos, 187 = Perdas, 200 = Juros e Encargos
 */
const MAPEAMENTO_DRE_ANALITICAS: Record<string, {codigoPadrao: string; descricao: string}> = {
  // ===== RECEITAS =====
  '3.1.11.200.001': { codigoPadrao: '40', descricao: 'Receitas - Programa de Auxílios' },
  '3.1.11.200.002': { codigoPadrao: '40', descricao: 'Outras Receitas' },
  '3.1.11.200.008': { codigoPadrao: '40', descricao: 'Receitas - Transferências' },
  '3.1.11.400.003': { codigoPadrao: '195', descricao: 'Receitas Financeiras' },
  
  // ===== DESPESAS COM PESSOAL =====
  '4.2.11.100.001': { codigoPadrao: '106', descricao: 'Salários e Ordenados' },
  '4.2.11.100.003': { codigoPadrao: '106', descricao: 'Férias' },
  '4.2.11.100.004': { codigoPadrao: '106', descricao: '13º Salário' },
  '4.2.11.100.005': { codigoPadrao: '111', descricao: 'INSS' },
  '4.2.11.100.006': { codigoPadrao: '111', descricao: 'FGTS' },
  '4.2.11.100.011': { codigoPadrao: '111', descricao: 'Outros Encargos' },
  '4.2.11.100.012': { codigoPadrao: '115', descricao: 'Vale Transporte' },
  '4.2.11.100.014': { codigoPadrao: '111', descricao: 'FGTS - Artigo 22 CLT' },
  
  // ===== DESPESAS COM DEPRECIAÇÃO =====
  '4.2.11.200.003': { codigoPadrao: '145', descricao: 'Depreciação e Amortização' },
  
  // ===== DESPESAS COM OCUPAÇÃO / INSTALAÇÕES =====
  '4.2.11.200.007': { codigoPadrao: '126', descricao: 'Manutenção de Veículos' },
  '4.2.11.200.008': { codigoPadrao: '126', descricao: 'Conservação e Manutenção em Imóveis' },
  '4.2.11.200.009': { codigoPadrao: '126', descricao: 'Manutenção de Estádios' },
  '4.2.11.200.010': { codigoPadrao: '126', descricao: 'Manutenção de Móveis' },
  
  // ===== DESPESAS COM UTILIDADES =====
  '4.2.11.300.001': { codigoPadrao: '131', descricao: 'Energia Elétrica' },
  '4.2.11.300.002': { codigoPadrao: '131', descricao: 'Água' },
  '4.2.11.300.003': { codigoPadrao: '131', descricao: 'Telefone/Internet' },
  '4.2.11.300.007': { codigoPadrao: '155', descricao: 'Seguros' },
  '4.2.11.300.008': { codigoPadrao: '131', descricao: 'Transportes do Pessoal' },
  
  // ===== DESPESAS GERAIS =====
  '4.2.11.500.001': { codigoPadrao: '158', descricao: 'Viagens e Representações' },
  '4.2.11.500.002': { codigoPadrao: '136', descricao: 'Material de Escritório' },
  '4.2.11.500.003': { codigoPadrao: '69', descricao: 'Material Esportivo' },
  '4.2.11.500.004': { codigoPadrao: '136', descricao: 'Copa e Cozinha' },
  '4.2.11.500.005': { codigoPadrao: '136', descricao: 'Conduções e Lanches' },
  '4.2.11.500.006': { codigoPadrao: '164', descricao: 'Propaganda e Publicidade' },
  '4.2.11.500.012': { codigoPadrao: '187', descricao: 'Multas Extra-Fiscais' },
  '4.2.11.500.013': { codigoPadrao: '67', descricao: 'Troféus e Medalhas' },
  '4.2.11.500.014': { codigoPadrao: '139', descricao: 'Serviços de Terceiros PJ' },
  '4.2.11.500.015': { codigoPadrao: '139', descricao: 'Serviços de Terceiros PF' },
  '4.2.11.500.016': { codigoPadrao: '187', descricao: 'Despesas Diversas' },
  '4.2.11.500.019': { codigoPadrao: '115', descricao: 'Clínica/Farmácia/Medicamentos' },
  '4.2.11.500.020': { codigoPadrao: '106', descricao: 'Ajuda de Custo' },
  '4.2.11.500.022': { codigoPadrao: '54', descricao: 'Despesa de Jogos' },
  '4.2.11.500.026': { codigoPadrao: '61', descricao: 'Despesas com Arbitragem' },
  '4.2.11.500.027': { codigoPadrao: '139', descricao: 'Instituto de Futebol do Piauí' },
  '4.2.11.500.028': { codigoPadrao: '54', descricao: 'CBF / Federação' },
  
  // ===== DESPESAS FINANCEIRAS =====
  '4.2.11.600.001': { codigoPadrao: '200', descricao: 'Juros Pagos' },
  '4.2.11.600.004': { codigoPadrao: '200', descricao: 'Multas de Mora' },
  
  // ===== DESPESAS TRIBUTÁRIAS =====
  '4.2.11.700.001': { codigoPadrao: '180', descricao: 'Impostos e Taxas' },
  '4.2.11.700.007': { codigoPadrao: '180', descricao: 'PIS s/ Folha' },
  '4.2.11.700.008': { codigoPadrao: '180', descricao: 'Parcelamento Tributos Federais' },
  '4.2.11.700.009': { codigoPadrao: '180', descricao: 'Parcelamento INSS' },
  '4.2.11.700.011': { codigoPadrao: '180', descricao: 'INSS s/ Eventos' },
  
  // ===== REPASSES PARA CLUBES (Prêmios em Dinheiro) =====
  '4.2.11.800.001': { codigoPadrao: '66', descricao: 'River Atlético Club' },
  '4.2.11.800.002': { codigoPadrao: '66', descricao: 'Esporte Clube Flamengo' },
  '4.2.11.800.003': { codigoPadrao: '66', descricao: 'Associação Atlética Corissaba' },
  '4.2.11.800.004': { codigoPadrao: '66', descricao: 'Parnaíba Sport Clube' },
  '4.2.11.800.005': { codigoPadrao: '66', descricao: 'Caiçara Esporte Clube' },
  '4.2.11.800.006': { codigoPadrao: '66', descricao: 'Sociedade Esportiva de Picos' },
  '4.2.11.800.007': { codigoPadrao: '66', descricao: 'Piauí Esporte Clube' },
  '4.2.11.800.008': { codigoPadrao: '66', descricao: '4 de Julho Esporte Clube' },
  '4.2.11.800.009': { codigoPadrao: '66', descricao: 'Associação Atlética Oeirense' },
  '4.2.11.800.011': { codigoPadrao: '66', descricao: 'APCDEP' },
  '4.2.11.800.013': { codigoPadrao: '66', descricao: 'Comercial Atlético Clube' },
  '4.2.11.800.016': { codigoPadrao: '66', descricao: 'Sociedade Esportiva Tiradentes' },
  '4.2.11.800.021': { codigoPadrao: '66', descricao: 'Associação Atlética de Altos' },
  '4.2.11.800.025': { codigoPadrao: '66', descricao: 'Escola De Futebol Boca Junior' },
  '4.2.11.800.029': { codigoPadrao: '66', descricao: 'Equipe Abelha Rainha' },
  '4.2.11.800.030': { codigoPadrao: '66', descricao: 'Fluminense Esporte Clube' },
  '4.2.11.800.035': { codigoPadrao: '66', descricao: 'Federação Alagoana de Futebol' },
  '4.2.11.800.036': { codigoPadrao: '66', descricao: 'Federação Pernambucana de Futebol' },
  '4.2.11.800.037': { codigoPadrao: '66', descricao: 'Clube Atlético Piauiense' },
  '4.2.11.800.038': { codigoPadrao: '66', descricao: 'Equipe Skil Red' },
  '4.2.11.800.039': { codigoPadrao: '66', descricao: 'Equipe do São João' },
  '4.2.11.800.040': { codigoPadrao: '66', descricao: 'Equipe Racing' },
  '4.2.11.800.041': { codigoPadrao: '66', descricao: 'Equipe do Sporting' },
  '4.2.11.800.042': { codigoPadrao: '66', descricao: 'Equipe Reis dos Reis' },
  '4.2.11.800.043': { codigoPadrao: '66', descricao: 'Equipe Escolinha Real' },
  '4.2.11.800.044': { codigoPadrao: '66', descricao: 'Equipe do Camisa 07' },
  '4.2.11.800.045': { codigoPadrao: '66', descricao: 'Federação Sergipana de Futebol' },
  '4.2.11.800.046': { codigoPadrao: '66', descricao: 'Clube Atlético Teresinense' },
  '4.2.11.800.047': { codigoPadrao: '66', descricao: 'Teresina Esporte Clube' },
  
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
 * Isso evita duplicação de valores, já que o balancete tem totais em todos os níveis
 * 
 * Uma conta é considerada folha se não existe NENHUMA outra conta que:
 * 1. Comece exatamente com o código + "." (ex: 4.2.11 -> 4.2.11.xxx)
 * 2. Comece com o código + dígito (ex: 4.2.11.8 -> 4.2.11.80, 4.2.11.800, etc)
 *    mas considerando a estrutura de partes separadas por ponto
 */
function filtrarContasFolhas(balanceteData: BalanceteData[]): BalanceteData[] {
  const todosCodigos = [...new Set(balanceteData.map(c => c.accountNumber))];
  
  return balanceteData.filter(conta => {
    const codigoAtual = conta.accountNumber;
    
    for (const codigo of todosCodigos) {
      if (codigo === codigoAtual) continue;
      
      // Verifica se o outro código é filho deste
      if (eFilho(codigoAtual, codigo)) {
        return false; // Não é folha, tem filhos
      }
    }
    
    return true; // É folha
  });
}

/**
 * Verifica se codigoFilho é filho de codigoPai no plano de contas
 * Exemplos:
 * - 4.2.11 é pai de 4.2.11.100 (padrão com ponto)
 * - 4.2.11.8 é pai de 4.2.11.80, 4.2.11.800, 4.2.11.800.001 (extensão numérica)
 */
function eFilho(codigoPai: string, codigoFilho: string): boolean {
  // Padrão 1: filho começa com pai + "."
  if (codigoFilho.startsWith(codigoPai + '.')) {
    return true;
  }
  
  // Padrão 2: extensão numérica na última parte
  // Ex: 4.2.11.8 é pai de 4.2.11.80, 4.2.11.800
  // E também é pai de 4.2.11.800.001 (mais partes)
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  
  // Filho deve ter pelo menos o mesmo número de partes
  if (partesFilho.length < partesPai.length) {
    return false;
  }
  
  // Verifica se as N-1 primeiras partes são iguais
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) {
      return false;
    }
  }
  
  // Verifica se a última parte do pai é prefixo da parte correspondente do filho
  const ultimaPartePai = partesPai[partesPai.length - 1];
  const parteCorrespondente = partesFilho[partesPai.length - 1];
  
  // A parte correspondente do filho deve começar com a última parte do pai
  // E ser mais longa (extensão) ou o filho ter mais partes
  if (parteCorrespondente.startsWith(ultimaPartePai)) {
    if (parteCorrespondente.length > ultimaPartePai.length) {
      return true; // Ex: 4.2.11.8 -> 4.2.11.80
    }
    if (partesFilho.length > partesPai.length) {
      return true; // Ex: 4.2.11.800 -> 4.2.11.800.001
    }
  }
  
  return false;
}

/**
 * Ajusta o sinal do valor conforme a natureza da conta
 * 
 * No balancete brasileiro:
 * - Ativo (1.x): valores positivos = débito
 * - Passivo (2.1.x): valores negativos = crédito (inverter para exibição)
 * - PL (2.2.x): valores negativos = crédito, mas contas retificadoras (déficits) são positivas
 * - Receitas (3.x): valores negativos = crédito (inverter para exibição)
 * - Custos/Despesas (4.x, 5.x): valores positivos = débito
 * 
 * IMPORTANTE: Não usar Math.abs() pois contas retificadoras perdem o sinal correto
 * A inversão de sinal é feita multiplicando por -1 para grupos credores
 */
function ajustarSinal(valor: number, accountNumber: string): number {
  const firstChar = accountNumber.charAt(0);
  
  // Passivo, PL (2) e Receitas (3): inverter sinal (crédito → positivo para exibição)
  // Isso funciona corretamente com contas retificadoras:
  // - Superávit: -274.372 * -1 = +274.372 (positivo)
  // - Déficit: +161.121 * -1 = -161.121 (negativo, subtrai do PL)
  if (firstChar === '2' || firstChar === '3') {
    return valor * -1;
  }
  
  // Ativo (1) e Custos/Despesas (4, 5): manter sinal original
  return valor;
}

/**
 * Mapeia os dados do balancete para a estrutura base
 */
export async function mapBalanceteToEstrutura(
  balanceteData: BalanceteData[],
  tipo: 'BP' | 'DRE'
): Promise<ContaComValor[]> {
  // Carregar estrutura
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
  
  // Para cada conta folha do balancete, encontrar o mapeamento e acumular o valor
  for (const conta of contasFolhas) {
    // Usar mapeamento por prefixo
    const codigoPadrao = encontrarCodigoPadrao(conta.accountNumber, tipo);
    
    if (codigoPadrao) {
      const valorOriginal = Number(conta.finalBalance) || 0;
      const valorAjustado = ajustarSinal(valorOriginal, conta.accountNumber);
      valoresPorCodigo[codigoPadrao] = (valoresPorCodigo[codigoPadrao] || 0) + valorAjustado;
      
      // Log para debug
      console.log(`  ${conta.accountNumber} (${conta.accountDescription}) -> Código ${codigoPadrao}: ${valorOriginal} -> ${valorAjustado}`);
    } else {
      console.log(`  SEM MAPEAMENTO: ${conta.accountNumber} (${conta.accountDescription})`);
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
 * Contas retificadoras que devem ser SUBTRAÍDAS do pai ao invés de somadas
 * Na DRE:
 * - 199 (Despesas Financeiras) subtrai do 190 (Resultado Financeiro)
 * - 213 (Custos Operacionais), 214 (Despesas Operacionais), 221 (Despesas Não Operacionais) subtraem do resultado
 */
const CONTAS_RETIFICADORAS_DRE = new Set(['199', '213', '214', '221']);

/**
 * Calcula os totais dos níveis superiores somando os filhos
 * Contas retificadoras são subtraídas ao invés de somadas
 */
function calcularTotais(contas: ContaComValor[]): void {
  // Mapear por código para acesso rápido
  const mapa = new Map<string, ContaComValor>();
  contas.forEach(c => mapa.set(c.codigo, c));
  
  // Ordenar por nível decrescente para calcular de baixo para cima
  const contasOrdenadas = [...contas].sort((a, b) => b.nivel - a.nivel);
  
  for (const conta of contasOrdenadas) {
    if (conta.codigoSuperior) {
      const pai = mapa.get(conta.codigoSuperior.replace('.0', ''));
      if (pai) {
        // Verificar se é conta retificadora
        if (CONTAS_RETIFICADORAS_DRE.has(conta.codigo)) {
          pai.valor -= conta.valor; // Subtrair do pai
        } else {
          pai.valor += conta.valor; // Somar ao pai (comportamento padrão)
        }
      }
    }
  }
  
  // === CÁLCULO DO RESULTADO LÍQUIDO DO EXERCÍCIO ===
  // Fórmula: Receitas (1) - Custos (52) - Despesas (104) + Resultado Financeiro (190)
  const receitas = mapa.get('1');
  const custos = mapa.get('52');
  const despesas = mapa.get('104');
  const resultadoFinanceiro = mapa.get('190');
  const resultadoLiquido = mapa.get('225');
  const resultado = mapa.get('210');
  
  if (resultadoLiquido && receitas && custos && despesas) {
    // Calcular o resultado: Receitas - Custos - Despesas + Resultado Financeiro
    const valorResultado = (receitas.valor || 0) - Math.abs(custos.valor || 0) - Math.abs(despesas.valor || 0) + (resultadoFinanceiro?.valor || 0);
    
    resultadoLiquido.valor = valorResultado;
    console.log(`Resultado Líquido calculado: ${receitas.valor} - ${Math.abs(custos.valor || 0)} - ${Math.abs(despesas.valor || 0)} + ${resultadoFinanceiro?.valor || 0} = ${valorResultado}`);
    
    // Propagar para o grupo RESULTADO (210)
    if (resultado) {
      resultado.valor = valorResultado;
    }
  }
}

/**
 * Constrói a hierarquia de contas
 */
function buildHierarchy(contas: ContaComValor[]): ContaComValor[] {
  const mapa = new Map<string, ContaComValor>();
  const raizes: ContaComValor[] = [];
  
  // Primeiro passo: criar mapa
  contas.forEach(conta => {
    mapa.set(conta.codigo, { ...conta, children: [] });
  });
  
  // Segundo passo: construir hierarquia
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
 * Integra o resultado da DRE no Patrimônio Líquido do BP (conta 143)
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
  
  // Calcular o resultado líquido da DRE
  const resultadoDRE = calcularResultadoDRE(dre);
  console.log(`[processarDadosFinanceiros] Resultado DRE calculado: ${resultadoDRE}`);
  
  // Inserir resultado da DRE no BP (conta 143 - Resultado do Exercício)
  inserirResultadoNoBP(bp, resultadoDRE);
  
  // Calcular total Passivo + PL
  const totalPassivoPL = calcularTotalPassivoPL(bp);
  console.log(`[processarDadosFinanceiros] Total Passivo + PL: ${totalPassivoPL}`);
  
  return { dre, bp, resultadoDRE, totalPassivoPL };
}

/**
 * Calcula o resultado líquido a partir da hierarquia da DRE
 */
function calcularResultadoDRE(dre: ContaComValor[]): number {
  // Busca recursiva pelo código 225 (Resultado Líquido) ou 210 (Resultado)
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
  
  // Tenta encontrar o resultado líquido
  let resultado = buscarValor(dre, '225');
  if (resultado === 0) {
    resultado = buscarValor(dre, '210');
  }
  
  return resultado;
}

/**
 * Insere o resultado da DRE na conta 141 (Superávits/Déficits Acumulados) do BP e recalcula os totais
 */
function inserirResultadoNoBP(bp: ContaComValor[], resultadoDRE: number): void {
  function buscarEInserir(contas: ContaComValor[]): boolean {
    for (const conta of contas) {
      // Encontra a conta 141 (Superávits/Déficits Acumulados) e adiciona o resultado
      if (conta.codigo === '141') {
        const valorAnterior = conta.valor;
        conta.valor = valorAnterior + resultadoDRE;
        console.log(`[inserirResultadoNoBP] Conta 141: ${valorAnterior} + Resultado DRE ${resultadoDRE} = ${conta.valor}`);
        return true;
      }
      
      // Se for o Patrimônio Líquido (125), procura a conta 141 nos filhos
      if (conta.codigo === '125' && conta.children) {
        const conta141 = conta.children.find(c => c.codigo === '141');
        if (conta141) {
          const valorAnterior = conta141.valor;
          conta141.valor = valorAnterior + resultadoDRE;
          console.log(`[inserirResultadoNoBP] Conta 141 (filho de 125): ${valorAnterior} + Resultado DRE ${resultadoDRE} = ${conta141.valor}`);
          
          // Recalcula o total do Patrimônio Líquido
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
      // Passivo (76)
      if (conta.codigo === '76') {
        totalPassivo = conta.valor;
      }
      // Patrimônio Líquido (125)
      if (conta.codigo === '125') {
        totalPL = conta.valor;
      }
      
      if (conta.children && conta.children.length > 0) {
        buscarTotais(conta.children);
      }
    }
  }
  
  buscarTotais(bp);
  return totalPassivo + totalPL;
}

/**
 * Função auxiliar para achatar a hierarquia para exibição em tabela
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
