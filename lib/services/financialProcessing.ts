/**
 * Serviço de processamento de dados financeiros
 * Processa balancetes e gera demonstrações financeiras
 */

import { Decimal } from "@prisma/client/runtime/library";

// Interfaces para os dados processados
export interface ProcessedAccount {
  codigo: string;
  descricao: string;
  saldoAnterior: number;
  debito: number;
  credito: number;
  saldoFinal: number;
  natureza: string;
}

export interface ProcessedDRE {
  receitas: Record<string, number>;
  custos: Record<string, number>;
  despesas: Record<string, number>;
  resultados: Record<string, number>;
  total: number;
}

export interface ProcessedBP {
  ativoCirculante: Record<string, number>;
  ativoNaoCirculante: Record<string, number>;
  passivoCirculante: Record<string, number>;
  passivoNaoCirculante: Record<string, number>;
  patrimonioLiquido: Record<string, number>;
  totalAtivo: number;
  totalPassivo: number;
}

export interface FinancialIndices {
  liquidez: {
    corrente: number;
    seca: number;
    imediata: number;
    geral: number;
  };
  rentabilidade: {
    margemBruta: number;
    margemOperacional: number;
    margemLiquida: number;
    margemEbitda: number;
    roa: number;
    roe: number;
  };
  endividamento: {
    endividamentoGeral: number;
    composicaoEndividamento: number;
    grauAlavancagem: number;
    imobilizacaoPL: number;
  };
  atividade: {
    giroAtivo: number;
    prazoMedioRecebimento: number;
    prazoMedioPagamento: number;
  };
}

export interface MonthlyData {
  period: string;
  dre: ProcessedDRE;
  bp: ProcessedBP;
  indices: FinancialIndices;
}

export interface YearlyData {
  year: string;
  months: MonthlyData[];
  consolidated: {
    dre: ProcessedDRE;
    bp: ProcessedBP;
    indices: FinancialIndices;
  };
}

// Interface para conta hierárquica com todos os níveis
export interface HierarchicalAccount {
  codigo: string;
  descricao: string;
  valor: number;
  nivel: number;
  children?: HierarchicalAccount[];
}

export interface HierarchicalDRE {
  receitas: HierarchicalAccount[];
  custos: HierarchicalAccount[];
  resultados: Record<string, number>;
  total: number;
}

export interface HierarchicalBP {
  ativo: HierarchicalAccount[];
  passivo: HierarchicalAccount[];
  patrimonioLiquido: HierarchicalAccount[];
  totalAtivo: number;
  totalPassivo: number;
  totalPL: number;
}

// Mapeamento padrão de contas para demonstrações
const ACCOUNT_MAPPING = {
  // Ativo Circulante (1.1.x)
  ativoCirculante: {
    prefixes: ["1.1"],
    subgroups: {
      disponibilidades: ["1.1.01"],
      aplicacoesFinanceiras: ["1.1.02"],
      contasAReceber: ["1.1.03"],
      estoques: ["1.1.04"],
      outrosAtivosCirculantes: ["1.1.05", "1.1.06", "1.1.07", "1.1.08", "1.1.09"],
    },
  },
  // Ativo Não Circulante (1.2.x)
  ativoNaoCirculante: {
    prefixes: ["1.2"],
    subgroups: {
      realizavelLongoPrazo: ["1.2.01"],
      investimentos: ["1.2.02"],
      imobilizado: ["1.2.03"],
      intangivel: ["1.2.04"],
    },
  },
  // Passivo Circulante (2.1.x)
  passivoCirculante: {
    prefixes: ["2.1"],
    subgroups: {
      fornecedores: ["2.1.01"],
      obrigacoesTrabalhistas: ["2.1.02"],
      obrigacoesFiscais: ["2.1.03"],
      emprestimos: ["2.1.04"],
      outrosPassivosCirculantes: ["2.1.05", "2.1.06", "2.1.07"],
    },
  },
  // Passivo Não Circulante (2.2.x)
  passivoNaoCirculante: {
    prefixes: ["2.2"],
    subgroups: {
      emprestimosLP: ["2.2.01"],
      provisoes: ["2.2.02"],
      outrosPassivosNaoCirculantes: ["2.2.03"],
    },
  },
  // Patrimônio Líquido (2.3.x ou 3.x)
  patrimonioLiquido: {
    prefixes: ["2.3", "3."],
    subgroups: {
      capitalSocial: ["2.3.01", "3.1"],
      reservas: ["2.3.02", "3.2"],
      lucrosAcumulados: ["2.3.03", "3.3"],
      ajustesAvaliacaoPatrimonial: ["2.3.04", "3.4"],
    },
  },
  // Receitas (3.1.x ou 4.1.x dependendo do plano)
  receitas: {
    prefixes: ["3.1", "4.1"],
    subgroups: {
      receitasOperacionais: ["3.1.01", "4.1.01"],
      outrasReceitas: ["3.1.02", "4.1.02"],
    },
  },
  // Custos (4.x ou 5.x)
  custos: {
    prefixes: ["4.", "5."],
    subgroups: {
      custosOperacionais: ["4.1", "5.1"],
      outrosCustos: ["4.2", "5.2"],
    },
  },
  // Despesas (5.x ou 6.x)
  despesas: {
    prefixes: ["5.", "6."],
    subgroups: {
      despesasAdministrativas: ["5.1", "6.1"],
      despesasFinanceiras: ["5.2", "6.2"],
      outrasDesDespesas: ["5.3", "6.3"],
    },
  },
};

/**
 * Converte Decimal do Prisma para number
 */
export function decimalToNumber(value: Decimal | number): number {
  if (typeof value === "number") return value;
  return parseFloat(value.toString());
}

/**
 * Verifica se uma conta pertence a um grupo específico
 */
function matchesPrefix(accountNumber: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => accountNumber.startsWith(prefix));
}

/**
 * Verifica se uma conta é folha (não tem filhas)
 */
function isLeafAccount(codigo: string, allCodigos: string[]): boolean {
  // Uma conta é folha se nenhuma outra conta começa com seu código + "."
  const prefix = codigo + ".";
  return !allCodigos.some(c => c.startsWith(prefix) && c !== codigo);
}

/**
 * Processa os dados do balancete e agrupa por categoria
 */
export function processBalanceteData(
  balanceteData: Array<{
    accountNumber: string;
    accountDescription: string;
    previousBalance: Decimal | number;
    debit: Decimal | number;
    credit: Decimal | number;
    finalBalance: Decimal | number;
    accountNature: string;
  }>
): ProcessedAccount[] {
  return balanceteData.map((item) => ({
    codigo: item.accountNumber,
    descricao: item.accountDescription,
    saldoAnterior: decimalToNumber(item.previousBalance),
    debito: decimalToNumber(item.debit),
    credito: decimalToNumber(item.credit),
    saldoFinal: decimalToNumber(item.finalBalance),
    natureza: item.accountNature,
  }));
}

/**
 * Agrupa contas por categoria do BP
 * Usa contas sintéticas para totais e contas folha para detalhes
 */
export function groupAccountsForBP(
  accounts: ProcessedAccount[]
): ProcessedBP {
  const result: ProcessedBP = {
    ativoCirculante: {},
    ativoNaoCirculante: {},
    passivoCirculante: {},
    passivoNaoCirculante: {},
    patrimonioLiquido: {},
    totalAtivo: 0,
    totalPassivo: 0,
  };

  const allCodigos = accounts.map(a => a.codigo);

  // Busca contas sintéticas para totais
  const ativoCircSintetico = accounts.find(a => a.codigo === "1.1");
  const ativoNaoCircSintetico = accounts.find(a => a.codigo === "1.2");
  const passivoCircSintetico = accounts.find(a => a.codigo === "2.1");
  
  // Detecta estrutura do plano de contas (2.2 pode ser PNC ou PL dependendo do plano)
  const conta22 = accounts.find(a => a.codigo === "2.2");
  const conta23 = accounts.find(a => a.codigo === "2.3");
  
  // Se 2.2 contém "PATRIMONIO" ou "PATRIMÔNIO" no nome, é PL; caso contrário é PNC
  const conta22IsPL = conta22?.descricao?.toUpperCase()?.includes("PATRIMONI") ?? false;
  
  let passivoNaoCircSintetico: ProcessedAccount | undefined;
  let plSintetico: ProcessedAccount | undefined;
  
  if (conta22IsPL) {
    // Plano onde 2.2 é PL (ex: Piauí)
    plSintetico = conta22;
    passivoNaoCircSintetico = undefined; // Não há PNC separado
  } else {
    // Plano padrão: 2.2 é PNC, 2.3 é PL
    passivoNaoCircSintetico = conta22;
    plSintetico = conta23;
  }
  
  const ativoTotal = accounts.find(a => a.codigo === "1");
  const passivoTotal = accounts.find(a => a.codigo === "2");

  let totalAtivoCirculante = ativoCircSintetico ? Math.abs(ativoCircSintetico.saldoFinal) : 0;
  let totalAtivoNaoCirculante = ativoNaoCircSintetico ? Math.abs(ativoNaoCircSintetico.saldoFinal) : 0;
  let totalPassivoCirculante = passivoCircSintetico ? Math.abs(passivoCircSintetico.saldoFinal) : 0;
  let totalPassivoNaoCirculante = passivoNaoCircSintetico ? Math.abs(passivoNaoCircSintetico.saldoFinal) : 0;
  let totalPL = plSintetico ? Math.abs(plSintetico.saldoFinal) : 0;

  accounts.forEach((account) => {
    const saldo = Math.abs(account.saldoFinal);
    const codigo = account.codigo;
    
    // Pula contas muito sintéticas (1 ou 2 níveis apenas)
    if (codigo.split('.').length <= 2) return;
    
    // Verifica se é conta folha para evitar duplicação
    if (!isLeafAccount(codigo, allCodigos)) return;
    
    if (saldo === 0) return;

    // Ativo Circulante
    if (matchesPrefix(codigo, ACCOUNT_MAPPING.ativoCirculante.prefixes)) {
      result.ativoCirculante[account.descricao] = saldo;
      // Soma para detalhamento apenas se não temos conta sintética
      if (!ativoCircSintetico) totalAtivoCirculante += saldo;
    }
    // Ativo Não Circulante
    else if (matchesPrefix(codigo, ACCOUNT_MAPPING.ativoNaoCirculante.prefixes)) {
      result.ativoNaoCirculante[account.descricao] = saldo;
      if (!ativoNaoCircSintetico) totalAtivoNaoCirculante += saldo;
    }
    // Passivo Circulante
    else if (matchesPrefix(codigo, ACCOUNT_MAPPING.passivoCirculante.prefixes)) {
      result.passivoCirculante[account.descricao] = saldo;
      if (!passivoCircSintetico) totalPassivoCirculante += saldo;
    }
    // Conta 2.2.x - pode ser PNC ou PL dependendo do plano de contas
    else if (codigo.startsWith("2.2")) {
      if (conta22IsPL) {
        // Plano onde 2.2 é Patrimônio Líquido
        result.patrimonioLiquido[account.descricao] = saldo;
        if (!plSintetico) totalPL += saldo;
      } else {
        // Plano padrão: 2.2 é Passivo Não Circulante
        result.passivoNaoCirculante[account.descricao] = saldo;
        if (!passivoNaoCircSintetico) totalPassivoNaoCirculante += saldo;
      }
    }
    // Patrimônio Líquido (2.3.x ou outras contas de PL)
    else if (matchesPrefix(codigo, ACCOUNT_MAPPING.patrimonioLiquido.prefixes)) {
      result.patrimonioLiquido[account.descricao] = saldo;
      if (!plSintetico) totalPL += saldo;
    }
  });

  // Usa valores da conta sintética total se disponível
  result.totalAtivo = ativoTotal ? Math.abs(ativoTotal.saldoFinal) : (totalAtivoCirculante + totalAtivoNaoCirculante);
  result.totalPassivo = passivoTotal ? Math.abs(passivoTotal.saldoFinal) : (totalPassivoCirculante + totalPassivoNaoCirculante + totalPL);

  // Adiciona totais
  result.ativoCirculante["TOTAL_ATIVO_CIRCULANTE"] = totalAtivoCirculante;
  result.ativoNaoCirculante["TOTAL_ATIVO_NAO_CIRCULANTE"] = totalAtivoNaoCirculante;
  result.passivoCirculante["TOTAL_PASSIVO_CIRCULANTE"] = totalPassivoCirculante;
  result.passivoNaoCirculante["TOTAL_PASSIVO_NAO_CIRCULANTE"] = totalPassivoNaoCirculante;
  result.patrimonioLiquido["TOTAL_PATRIMONIO_LIQUIDO"] = totalPL;

  return result;
}

/**
 * Encontra a conta sintética de maior nível para um grupo de prefixos
 */
function findSyntheticAccount(
  accounts: ProcessedAccount[],
  prefixes: string[]
): ProcessedAccount | null {
  // Ordena por tamanho do código (menor = mais sintético)
  const matching = accounts
    .filter(a => matchesPrefix(a.codigo, prefixes))
    .sort((a, b) => a.codigo.length - b.codigo.length);
  
  return matching.length > 0 ? matching[0] : null;
}

/**
 * Agrupa contas por categoria do DRE
 * Usa apenas contas folha para evitar duplicação com contas sintéticas
 */
export function groupAccountsForDRE(
  accounts: ProcessedAccount[]
): ProcessedDRE {
  const result: ProcessedDRE = {
    receitas: {},
    custos: {},
    despesas: {},
    resultados: {},
    total: 0,
  };

  const allCodigos = accounts.map(a => a.codigo);
  
  // Busca contas sintéticas de receita, custo e despesa para totais
  const receitaSintetica = findSyntheticAccount(accounts, ["3", "3.1"]);
  const custoSintetico = findSyntheticAccount(accounts, ["4", "4.1"]);
  const despesaSintetica = findSyntheticAccount(accounts, ["5", "5.1", "6", "6.1"]);

  let totalReceitas = 0;
  let totalCustos = 0;
  let totalDespesas = 0;

  // Se encontrou conta sintética de receitas, usa ela para o total
  if (receitaSintetica) {
    totalReceitas = Math.abs(receitaSintetica.saldoFinal);
    // Não adiciona "Total Receitas" no objeto receitas para não poluir o gráfico de composição
  }

  // Processa apenas contas folha para detalhamento
  accounts.forEach((account) => {
    const codigo = account.codigo;
    
    // Pula contas muito sintéticas (apenas 1 nível)
    if (codigo.split('.').length <= 2) return;
    
    // Verifica se é conta folha
    if (!isLeafAccount(codigo, allCodigos)) return;

    const valor = Math.abs(account.saldoFinal);
    if (valor === 0) return;

    // Receitas (contas que começam com 3.1.x)
    if (matchesPrefix(codigo, ["3.1", "4.1"])) {
      result.receitas[account.descricao] = valor;
      // Não soma aqui pois já temos o total da conta sintética
    }
    // Custos (contas que começam com 4.x exceto 4.1)
    else if (matchesPrefix(codigo, ["4.2", "4.3", "4.4", "4.5"])) {
      result.custos[account.descricao] = valor;
      totalCustos += valor;
    }
    // Despesas (contas que começam com 5.x ou 6.x)
    else if (matchesPrefix(codigo, ["5.", "6."])) {
      result.despesas[account.descricao] = valor;
      totalDespesas += valor;
    }
  });

  // Se não encontrou conta sintética, calcula o total das folhas
  if (!receitaSintetica) {
    totalReceitas = Object.values(result.receitas).reduce((sum, val) => sum + val, 0);
  }

  // Usa conta sintética de custos se disponível
  if (custoSintetico) {
    totalCustos = Math.abs(custoSintetico.saldoFinal);
  }

  // Usa conta sintética de despesas se disponível
  if (despesaSintetica) {
    totalDespesas = Math.abs(despesaSintetica.saldoFinal);
  }

  // Calcula resultados
  const resultadoBruto = totalReceitas - totalCustos;
  const resultadoOperacional = resultadoBruto - totalDespesas;
  const resultadoLiquido = resultadoOperacional; // Simplificado - sem IR/CS

  result.resultados = {
    totalReceitas,
    totalCustos,
    resultadoBruto,
    totalDespesas,
    resultadoOperacional,
    resultadoLiquido,
  };

  result.total = resultadoLiquido;

  return result;
}

/**
 * Calcula os índices financeiros
 */
export function calculateFinancialIndices(
  bp: ProcessedBP,
  dre: ProcessedDRE
): FinancialIndices {
  const ativoCirculante = bp.ativoCirculante["TOTAL_ATIVO_CIRCULANTE"] || 0;
  const ativoNaoCirculante = bp.ativoNaoCirculante["TOTAL_ATIVO_NAO_CIRCULANTE"] || 0;
  const passivoCirculante = bp.passivoCirculante["TOTAL_PASSIVO_CIRCULANTE"] || 0;
  const passivoNaoCirculante = bp.passivoNaoCirculante["TOTAL_PASSIVO_NAO_CIRCULANTE"] || 0;
  const patrimonioLiquido = bp.patrimonioLiquido["TOTAL_PATRIMONIO_LIQUIDO"] || 0;
  const totalAtivo = bp.totalAtivo || 1;
  const totalPassivo = passivoCirculante + passivoNaoCirculante;

  const totalReceitas = dre.resultados.totalReceitas || 1;
  const resultadoBruto = dre.resultados.resultadoBruto || 0;
  const resultadoOperacional = dre.resultados.resultadoOperacional || 0;
  const resultadoLiquido = dre.resultados.resultadoLiquido || 0;

  // Cálculo simplificado de estoques (pode ser ajustado com mapeamento específico)
  const estoques = bp.ativoCirculante["Estoques"] || bp.ativoCirculante["ESTOQUES"] || 0;
  const disponibilidades = bp.ativoCirculante["Caixa Geral"] || bp.ativoCirculante["DISPONIBILIDADES"] || ativoCirculante * 0.1;
  const imobilizado = bp.ativoNaoCirculante["Imobilizado"] || bp.ativoNaoCirculante["IMOBILIZADO"] || ativoNaoCirculante * 0.8;

  // Índices de Liquidez
  const liquidezCorrente = passivoCirculante > 0 ? ativoCirculante / passivoCirculante : 0;
  const liquidezSeca = passivoCirculante > 0 ? (ativoCirculante - estoques) / passivoCirculante : 0;
  const liquidezImediata = passivoCirculante > 0 ? disponibilidades / passivoCirculante : 0;
  const liquidezGeral = (passivoCirculante + passivoNaoCirculante) > 0 
    ? (ativoCirculante + bp.ativoNaoCirculante["Realizável a Longo Prazo"] || 0) / (passivoCirculante + passivoNaoCirculante) 
    : 0;

  // Índices de Rentabilidade
  const margemBruta = totalReceitas > 0 ? (resultadoBruto / totalReceitas) * 100 : 0;
  const margemOperacional = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0;
  const margemLiquida = totalReceitas > 0 ? (resultadoLiquido / totalReceitas) * 100 : 0;
  const margemEbitda = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0; // Simplificado
  const roa = totalAtivo > 0 ? (resultadoLiquido / totalAtivo) * 100 : 0;
  const roe = patrimonioLiquido > 0 ? (resultadoLiquido / patrimonioLiquido) * 100 : 0;

  // Índices de Endividamento
  const endividamentoGeral = totalAtivo > 0 ? (totalPassivo / totalAtivo) * 100 : 0;
  const composicaoEndividamento = totalPassivo > 0 ? (passivoCirculante / totalPassivo) * 100 : 0;
  const grauAlavancagem = patrimonioLiquido > 0 ? totalPassivo / patrimonioLiquido : 0;
  const imobilizacaoPL = patrimonioLiquido > 0 ? (imobilizado / patrimonioLiquido) * 100 : 0;

  // Índices de Atividade (simplificados)
  const giroAtivo = totalAtivo > 0 ? totalReceitas / totalAtivo : 0;
  const prazoMedioRecebimento = totalReceitas > 0 ? ((bp.ativoCirculante["Contas a Receber"] || ativoCirculante * 0.3) * 360) / totalReceitas : 0;
  const prazoMedioPagamento = (dre.resultados.totalCustos || 1) > 0 ? ((bp.passivoCirculante["Fornecedores"] || passivoCirculante * 0.3) * 360) / (dre.resultados.totalCustos || 1) : 0;

  return {
    liquidez: {
      corrente: Number(liquidezCorrente.toFixed(2)),
      seca: Number(liquidezSeca.toFixed(2)),
      imediata: Number(liquidezImediata.toFixed(2)),
      geral: Number(liquidezGeral.toFixed(2)),
    },
    rentabilidade: {
      margemBruta: Number(margemBruta.toFixed(2)),
      margemOperacional: Number(margemOperacional.toFixed(2)),
      margemLiquida: Number(margemLiquida.toFixed(2)),
      margemEbitda: Number(margemEbitda.toFixed(2)),
      roa: Number(roa.toFixed(2)),
      roe: Number(roe.toFixed(2)),
    },
    endividamento: {
      endividamentoGeral: Number(endividamentoGeral.toFixed(2)),
      composicaoEndividamento: Number(composicaoEndividamento.toFixed(2)),
      grauAlavancagem: Number(grauAlavancagem.toFixed(2)),
      imobilizacaoPL: Number(imobilizacaoPL.toFixed(2)),
    },
    atividade: {
      giroAtivo: Number(giroAtivo.toFixed(2)),
      prazoMedioRecebimento: Math.round(prazoMedioRecebimento),
      prazoMedioPagamento: Math.round(prazoMedioPagamento),
    },
  };
}

/**
 * Converte período (JAN/24) para mês/ano padronizado
 */
export function parsePeriod(period: string): { month: string; year: string } | null {
  const months: Record<string, string> = {
    JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
    JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
  };

  const match = period.match(/^([A-Z]{3})\/(\d{2})$/i);
  if (!match) return null;

  const monthCode = match[1].toUpperCase();
  const yearShort = match[2];
  const month = months[monthCode];
  
  if (!month) return null;

  const year = parseInt(yearShort) > 50 ? `19${yearShort}` : `20${yearShort}`;
  
  return { month, year };
}

/**
 * Agrupa dados por ano
 */
export function groupDataByYear(
  monthlyData: MonthlyData[]
): Map<string, MonthlyData[]> {
  const grouped = new Map<string, MonthlyData[]>();

  monthlyData.forEach((data) => {
    const parsed = parsePeriod(data.period);
    if (parsed) {
      const year = parsed.year;
      if (!grouped.has(year)) {
        grouped.set(year, []);
      }
      grouped.get(year)!.push(data);
    }
  });

  return grouped;
}

/**
 * Consolida dados mensais para anual
 */
export function consolidateYearlyData(
  monthlyData: MonthlyData[]
): YearlyData | null {
  if (monthlyData.length === 0) return null;

  // Pega o último mês para BP (posição no final do período)
  const lastMonth = monthlyData[monthlyData.length - 1];
  
  // Soma DRE de todos os meses
  const consolidatedDRE: ProcessedDRE = {
    receitas: {},
    custos: {},
    despesas: {},
    resultados: {
      totalReceitas: 0,
      totalCustos: 0,
      resultadoBruto: 0,
      totalDespesas: 0,
      resultadoOperacional: 0,
      resultadoLiquido: 0,
    },
    total: 0,
  };

  monthlyData.forEach((month) => {
    // Soma receitas
    Object.entries(month.dre.receitas).forEach(([key, value]) => {
      consolidatedDRE.receitas[key] = (consolidatedDRE.receitas[key] || 0) + value;
    });
    // Soma custos
    Object.entries(month.dre.custos).forEach(([key, value]) => {
      consolidatedDRE.custos[key] = (consolidatedDRE.custos[key] || 0) + value;
    });
    // Soma despesas
    Object.entries(month.dre.despesas).forEach(([key, value]) => {
      consolidatedDRE.despesas[key] = (consolidatedDRE.despesas[key] || 0) + value;
    });
    // Soma resultados
    consolidatedDRE.resultados.totalReceitas += month.dre.resultados.totalReceitas || 0;
    consolidatedDRE.resultados.totalCustos += month.dre.resultados.totalCustos || 0;
    consolidatedDRE.resultados.totalDespesas += month.dre.resultados.totalDespesas || 0;
  });

  // Calcula resultados consolidados
  consolidatedDRE.resultados.resultadoBruto = 
    consolidatedDRE.resultados.totalReceitas - consolidatedDRE.resultados.totalCustos;
  consolidatedDRE.resultados.resultadoOperacional = 
    consolidatedDRE.resultados.resultadoBruto - consolidatedDRE.resultados.totalDespesas;
  consolidatedDRE.resultados.resultadoLiquido = consolidatedDRE.resultados.resultadoOperacional;
  consolidatedDRE.total = consolidatedDRE.resultados.resultadoLiquido;

  // BP usa último mês
  const consolidatedBP = lastMonth.bp;

  // Recalcula índices com dados consolidados
  const consolidatedIndices = calculateFinancialIndices(consolidatedBP, consolidatedDRE);

  const parsed = parsePeriod(lastMonth.period);
  
  return {
    year: parsed?.year || "2025",
    months: monthlyData,
    consolidated: {
      dre: consolidatedDRE,
      bp: consolidatedBP,
      indices: consolidatedIndices,
    },
  };
}

/**
 * Converte contas planas em estrutura hierárquica
 */
function buildHierarchy(accounts: ProcessedAccount[], prefixes: string[]): HierarchicalAccount[] {
  // Filtra contas pelos prefixos
  const filtered = accounts.filter(acc => 
    prefixes.some(prefix => acc.codigo.startsWith(prefix))
  );
  
  // Ordena por código
  filtered.sort((a, b) => a.codigo.localeCompare(b.codigo));
  
  // Constrói árvore hierárquica
  const result: HierarchicalAccount[] = [];
  const map = new Map<string, HierarchicalAccount>();
  
  filtered.forEach(acc => {
    const nivel = acc.codigo.split('.').length;
    const node: HierarchicalAccount = {
      codigo: acc.codigo,
      descricao: acc.descricao,
      valor: Math.abs(acc.saldoFinal),
      nivel,
      children: []
    };
    map.set(acc.codigo, node);
  });
  
  // Conecta pais e filhos
  filtered.forEach(acc => {
    const node = map.get(acc.codigo);
    if (!node) return;
    
    // Encontra o pai
    const parts = acc.codigo.split('.');
    let parentCode = '';
    for (let i = parts.length - 1; i > 0; i--) {
      parentCode = parts.slice(0, i).join('.');
      if (map.has(parentCode)) {
        const parent = map.get(parentCode)!;
        parent.children = parent.children || [];
        parent.children.push(node);
        return;
      }
    }
    
    // Se não encontrou pai, é raiz
    result.push(node);
  });
  
  return result;
}

/**
 * Agrupa contas para DRE com estrutura hierárquica completa
 */
export function groupAccountsForHierarchicalDRE(
  accounts: ProcessedAccount[]
): HierarchicalDRE {
  const receitas = buildHierarchy(accounts, ["3"]);
  const custos = buildHierarchy(accounts, ["4"]);
  
  // Calcula totais
  let totalReceitas = 0;
  let totalCustos = 0;
  
  // Busca conta raiz de receitas (3 ou 3.1)
  const contaReceitas = accounts.find(a => a.codigo === "3.1" || a.codigo === "3");
  if (contaReceitas) {
    totalReceitas = Math.abs(contaReceitas.saldoFinal);
  } else {
    // Soma contas de nível 3 (folhas de 3.1.x)
    totalReceitas = accounts
      .filter(a => a.codigo.startsWith("3.1.") && a.codigo.split('.').length === 3)
      .reduce((sum, a) => sum + Math.abs(a.saldoFinal), 0);
  }
  
  // Busca conta raiz de custos (4 ou 4.2)
  const contaCustos = accounts.find(a => a.codigo === "4" || a.codigo === "4.2");
  if (contaCustos) {
    totalCustos = Math.abs(contaCustos.saldoFinal);
  } else {
    totalCustos = accounts
      .filter(a => a.codigo.startsWith("4.") && a.codigo.split('.').length === 2)
      .reduce((sum, a) => sum + Math.abs(a.saldoFinal), 0);
  }
  
  const resultadoLiquido = totalReceitas - totalCustos;
  
  return {
    receitas,
    custos,
    resultados: {
      totalReceitas,
      totalCustos,
      resultadoOperacional: resultadoLiquido,
      resultadoLiquido
    },
    total: resultadoLiquido
  };
}

/**
 * Agrupa contas para BP com estrutura hierárquica completa
 */
export function groupAccountsForHierarchicalBP(
  accounts: ProcessedAccount[]
): HierarchicalBP {
  const ativo = buildHierarchy(accounts, ["1"]);
  const passivo = buildHierarchy(accounts, ["2.1"]);
  const patrimonioLiquido = buildHierarchy(accounts, ["2.2", "2.3"]);
  
  // Calcula totais
  const contaAtivo = accounts.find(a => a.codigo === "1");
  const contaPassivo = accounts.find(a => a.codigo === "2.1");
  
  // PL pode estar em 2.2 ou 2.3 dependendo do plano de contas
  let contaPL = accounts.find(a => 
    (a.codigo === "2.2" && a.descricao.toUpperCase().includes("PATRIMONI")) ||
    a.codigo === "2.3"
  );
  if (!contaPL) {
    contaPL = accounts.find(a => a.codigo === "2.2");
  }
  
  const totalAtivo = contaAtivo ? Math.abs(contaAtivo.saldoFinal) : 0;
  const totalPassivo = contaPassivo ? Math.abs(contaPassivo.saldoFinal) : 0;
  const totalPL = contaPL ? Math.abs(contaPL.saldoFinal) : 0;
  
  return {
    ativo,
    passivo,
    patrimonioLiquido,
    totalAtivo,
    totalPassivo,
    totalPL
  };
}
