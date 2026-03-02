/**
 * Serviço de Cálculo de Índices Financeiros
 * 
 * Calcula índices baseados nos dados reais da estrutura de BP e DRE.
 * Se um índice não puder ser calculado por falta de dados, retorna null
 * e inclui um comentário explicativo.
 */

import { ContaComValor } from './estruturaMapping';

// Códigos das contas na estrutura padrão - BALANÇO PATRIMONIAL
const CODIGOS_BP = {
  // ATIVO
  ATIVO_TOTAL: '1',
  ATIVO_CIRCULANTE: '2',
  DISPONIBILIDADES: '3',           // Caixa + Bancos + Aplicações de Liquidez Imediata
  CONTAS_A_RECEBER: '7',
  ESTOQUES: '17',
  ATIVO_NAO_CIRCULANTE: '33',
  REALIZAVEL_LONGO_PRAZO: '34',
  IMOBILIZADO: '43',
  
  // PASSIVO
  PASSIVO_TOTAL: '76',
  PASSIVO_CIRCULANTE: '77',
  FORNECEDORES: '78',
  PASSIVO_NAO_CIRCULANTE: '113',
  
  // PATRIMÔNIO LÍQUIDO
  PATRIMONIO_LIQUIDO: '125',
  SUPERAVITS_DEFICITS: '141'
};

// Códigos das contas na estrutura padrão - DRE
const CODIGOS_DRE = {
  RECEITAS_TOTAL: '56',
  CUSTOS_TOTAL: '57',
  DESPESAS_TOTAL: '110',
  RESULTADO_FINANCEIRO: '198',
  RECEITAS_FINANCEIRAS: '199',
  DESPESAS_FINANCEIRAS: '207',
  RESULTADO: '227',
  RESULTADO_OPERACIONAL: '196',
  RESULTADO_LIQUIDO: '229'
};

// Interface para índice calculado
export interface IndiceCalculado {
  valor: number | null;
  disponivel: boolean;
  motivo?: string;  // Motivo de não poder calcular
}

// Interface para todos os índices
export interface IndicesCalculados {
  liquidez: {
    corrente: IndiceCalculado;
    seca: IndiceCalculado;
    imediata: IndiceCalculado;
    geral: IndiceCalculado;
  };
  rentabilidade: {
    margemBruta: IndiceCalculado;
    margemOperacional: IndiceCalculado;
    margemLiquida: IndiceCalculado;
    margemEbitda: IndiceCalculado;
    roa: IndiceCalculado;
    roe: IndiceCalculado;
  };
  endividamento: {
    endividamentoGeral: IndiceCalculado;
    composicaoEndividamento: IndiceCalculado;
    grauAlavancagem: IndiceCalculado;
    imobilizacaoPL: IndiceCalculado;
  };
  atividade: {
    giroAtivo: IndiceCalculado;
    prazoMedioRecebimento: IndiceCalculado;
    prazoMedioPagamento: IndiceCalculado;
  };
}

// Valores extraídos do BP e DRE
export interface ValoresExtraidos {
  // BP
  ativoTotal: number | null;
  ativoCirculante: number | null;
  disponibilidades: number | null;
  contasReceber: number | null;
  estoques: number | null;
  ativoNaoCirculante: number | null;
  realizavelLP: number | null;
  imobilizado: number | null;
  passivoCirculante: number | null;
  fornecedores: number | null;
  passivoNaoCirculante: number | null;
  patrimonioLiquido: number | null;
  
  // DRE
  receitasTotal: number | null;
  custosTotal: number | null;
  despesasTotal: number | null;
  resultadoFinanceiro: number | null;
  receitasFinanceiras: number | null;
  despesasFinanceiras: number | null;
  resultadoOperacional: number | null;
  resultadoLiquido: number | null;
}

/**
 * Busca o valor de uma conta pelo código na hierarquia
 */
function buscarValorPorCodigo(contas: ContaComValor[], codigo: string): number | null {
  for (const conta of contas) {
    if (conta.codigo === codigo) {
      return conta.valor !== 0 ? conta.valor : null;
    }
    if (conta.children && conta.children.length > 0) {
      const valor = buscarValorPorCodigo(conta.children, codigo);
      if (valor !== null) return valor;
    }
  }
  return null;
}

function buscarValorPorCodigos(contas: ContaComValor[], codigos: string[]): number | null {
  for (const codigo of codigos) {
    const valor = buscarValorPorCodigo(contas, codigo);
    if (valor !== null) return valor;
  }
  return null;
}

function buscarValorPorDescricao(contas: ContaComValor[], termos: string[]): number | null {
  const stack = [...contas];
  while (stack.length > 0) {
    const conta = stack.shift()!;
    const descricao = conta.descricao?.toLowerCase?.() || '';
    if (termos.some((termo) => descricao.includes(termo))) {
      return conta.valor !== 0 ? conta.valor : null;
    }
    if (conta.children?.length) {
      stack.push(...conta.children);
    }
  }
  return null;
}

/**
 * Extrai todos os valores necessários do BP e DRE
 */
export function extrairValores(
  bp: ContaComValor[],
  dre: ContaComValor[]
): ValoresExtraidos {
  const receitasTotal =
    buscarValorPorCodigos(dre, [CODIGOS_DRE.RECEITAS_TOTAL, '51', '1']) ??
    buscarValorPorDescricao(dre, ['receita líquida', 'receita bruta', 'receitas']);

  const custosTotal =
    buscarValorPorCodigos(dre, [CODIGOS_DRE.CUSTOS_TOTAL, '52']) ??
    buscarValorPorDescricao(dre, ['custos']);

  const despesasTotal =
    buscarValorPorCodigos(dre, [CODIGOS_DRE.DESPESAS_TOTAL, '104']) ??
    buscarValorPorDescricao(dre, ['despesas']);

  const resultadoOperacional =
    buscarValorPorCodigos(dre, [CODIGOS_DRE.RESULTADO_OPERACIONAL, '211']) ??
    buscarValorPorDescricao(dre, ['resultado operacional']);

  const resultadoLiquido =
    buscarValorPorCodigos(dre, [CODIGOS_DRE.RESULTADO_LIQUIDO, '225']) ??
    buscarValorPorDescricao(dre, ['resultado líquido', 'superávit', 'déficit']);

  return {
    // BP
    ativoTotal: buscarValorPorCodigo(bp, CODIGOS_BP.ATIVO_TOTAL),
    ativoCirculante: buscarValorPorCodigo(bp, CODIGOS_BP.ATIVO_CIRCULANTE),
    disponibilidades: buscarValorPorCodigo(bp, CODIGOS_BP.DISPONIBILIDADES),
    contasReceber: buscarValorPorCodigo(bp, CODIGOS_BP.CONTAS_A_RECEBER),
    estoques: buscarValorPorCodigo(bp, CODIGOS_BP.ESTOQUES),
    ativoNaoCirculante: buscarValorPorCodigo(bp, CODIGOS_BP.ATIVO_NAO_CIRCULANTE),
    realizavelLP: buscarValorPorCodigo(bp, CODIGOS_BP.REALIZAVEL_LONGO_PRAZO),
    imobilizado: buscarValorPorCodigo(bp, CODIGOS_BP.IMOBILIZADO),
    passivoCirculante: buscarValorPorCodigo(bp, CODIGOS_BP.PASSIVO_CIRCULANTE),
    fornecedores: buscarValorPorCodigo(bp, CODIGOS_BP.FORNECEDORES),
    passivoNaoCirculante: buscarValorPorCodigo(bp, CODIGOS_BP.PASSIVO_NAO_CIRCULANTE),
    patrimonioLiquido: buscarValorPorCodigo(bp, CODIGOS_BP.PATRIMONIO_LIQUIDO),
    
    // DRE
    receitasTotal,
    custosTotal,
    despesasTotal,
    resultadoFinanceiro:
      buscarValorPorCodigos(dre, [CODIGOS_DRE.RESULTADO_FINANCEIRO, '190']) ??
      buscarValorPorDescricao(dre, ['resultado financeiro']),
    receitasFinanceiras:
      buscarValorPorCodigos(dre, [CODIGOS_DRE.RECEITAS_FINANCEIRAS, '191']) ??
      buscarValorPorDescricao(dre, ['receitas financeiras']),
    despesasFinanceiras:
      buscarValorPorCodigos(dre, [CODIGOS_DRE.DESPESAS_FINANCEIRAS]) ??
      buscarValorPorDescricao(dre, ['despesas financeiras']),
    resultadoOperacional,
    resultadoLiquido
  };
}

/**
 * Cria um índice indisponível com motivo
 */
function indiceIndisponivel(motivo: string): IndiceCalculado {
  return {
    valor: null,
    disponivel: false,
    motivo
  };
}

/**
 * Cria um índice disponível
 */
function indiceDisponivel(valor: number): IndiceCalculado {
  return {
    valor: Number(valor.toFixed(2)),
    disponivel: true
  };
}

/**
 * Calcula todos os índices financeiros
 */
export function calcularIndices(
  bp: ContaComValor[],
  dre: ContaComValor[]
): IndicesCalculados {
  const v = extrairValores(bp, dre);
  
  // ========== ÍNDICES DE LIQUIDEZ ==========
  
  // Liquidez Corrente = Ativo Circulante / Passivo Circulante
  let liquidezCorrente: IndiceCalculado;
  if (v.ativoCirculante === null) {
    liquidezCorrente = indiceIndisponivel('Ativo Circulante não encontrado no BP (código 2)');
  } else if (v.passivoCirculante === null || v.passivoCirculante === 0) {
    liquidezCorrente = indiceIndisponivel('Passivo Circulante não encontrado ou igual a zero no BP (código 77)');
  } else {
    liquidezCorrente = indiceDisponivel(v.ativoCirculante / v.passivoCirculante);
  }
  
  // Liquidez Seca = (Ativo Circulante - Estoques) / Passivo Circulante
  let liquidezSeca: IndiceCalculado;
  if (v.ativoCirculante === null) {
    liquidezSeca = indiceIndisponivel('Ativo Circulante não encontrado no BP (código 2)');
  } else if (v.passivoCirculante === null || v.passivoCirculante === 0) {
    liquidezSeca = indiceIndisponivel('Passivo Circulante não encontrado ou igual a zero no BP (código 77)');
  } else {
    // Estoques pode ser null/0, nesse caso usamos 0
    const estoques = v.estoques ?? 0;
    liquidezSeca = indiceDisponivel((v.ativoCirculante - estoques) / v.passivoCirculante);
  }
  
  // Liquidez Imediata = Disponibilidades / Passivo Circulante
  let liquidezImediata: IndiceCalculado;
  if (v.disponibilidades === null) {
    liquidezImediata = indiceIndisponivel('Disponibilidades não encontrado no BP (código 3 - inclui Caixa, Bancos e Aplicações de Liquidez Imediata)');
  } else if (v.passivoCirculante === null || v.passivoCirculante === 0) {
    liquidezImediata = indiceIndisponivel('Passivo Circulante não encontrado ou igual a zero no BP (código 77)');
  } else {
    liquidezImediata = indiceDisponivel(v.disponibilidades / v.passivoCirculante);
  }
  
  // Liquidez Geral = (AC + RLP) / (PC + PNC)
  let liquidezGeral: IndiceCalculado;
  if (v.ativoCirculante === null) {
    liquidezGeral = indiceIndisponivel('Ativo Circulante não encontrado no BP (código 2)');
  } else if (v.passivoCirculante === null && v.passivoNaoCirculante === null) {
    liquidezGeral = indiceIndisponivel('Passivo Circulante e Passivo Não Circulante não encontrados no BP (códigos 77 e 113)');
  } else {
    const realizavelLP = v.realizavelLP ?? 0;
    const pc = v.passivoCirculante ?? 0;
    const pnc = v.passivoNaoCirculante ?? 0;
    const totalPassivos = pc + pnc;
    if (totalPassivos === 0) {
      liquidezGeral = indiceIndisponivel('Soma de Passivo Circulante + Passivo Não Circulante é zero');
    } else {
      liquidezGeral = indiceDisponivel((v.ativoCirculante + realizavelLP) / totalPassivos);
    }
  }
  
  // ========== ÍNDICES DE RENTABILIDADE ==========
  
  // Margem Bruta = (Receitas - Custos) / Receitas * 100
  // Nota: Em federações, não há "custo de mercadoria vendida" tradicional
  // O Resultado Bruto seria Receitas - Custos com Competições
  let margemBruta: IndiceCalculado;
  if (v.receitasTotal === null || v.receitasTotal === 0) {
    margemBruta = indiceIndisponivel('Receitas Total não encontrado ou igual a zero na DRE (código 1)');
  } else if (v.custosTotal === null) {
    // Se não há custos, a margem bruta é 100%
    margemBruta = indiceDisponivel(100);
  } else {
    const custosNormalizados = Math.abs(v.custosTotal);
    const resultadoBruto = v.receitasTotal - custosNormalizados;
    margemBruta = indiceDisponivel((resultadoBruto / v.receitasTotal) * 100);
  }
  
  // Margem Operacional = Resultado Operacional / Receitas * 100
  let margemOperacional: IndiceCalculado;
  if (v.receitasTotal === null || v.receitasTotal === 0) {
    margemOperacional = indiceIndisponivel('Receitas Total não encontrado ou igual a zero na DRE (código 1)');
  } else if (v.resultadoOperacional === null) {
    // Tentar calcular: Receitas - Custos - Despesas
    if (v.custosTotal !== null && v.despesasTotal !== null) {
      const custosNormalizados = Math.abs(v.custosTotal);
      const despesasNormalizadas = Math.abs(v.despesasTotal);
      const resOp = v.receitasTotal - custosNormalizados - despesasNormalizadas;
      margemOperacional = indiceDisponivel((resOp / v.receitasTotal) * 100);
    } else {
      margemOperacional = indiceIndisponivel('Resultado Operacional não encontrado na DRE (código 196) e não foi possível calcular');
    }
  } else {
    margemOperacional = indiceDisponivel((v.resultadoOperacional / v.receitasTotal) * 100);
  }
  
  // Margem Líquida = Resultado Líquido / Receitas * 100
  let margemLiquida: IndiceCalculado;
  if (v.receitasTotal === null || v.receitasTotal === 0) {
    margemLiquida = indiceIndisponivel('Receitas Total não encontrado ou igual a zero na DRE (código 1)');
  } else if (v.resultadoLiquido === null) {
    margemLiquida = indiceIndisponivel('Resultado Líquido não encontrado na DRE (código 229)');
  } else {
    margemLiquida = indiceDisponivel((v.resultadoLiquido / v.receitasTotal) * 100);
  }
  
  // Margem EBITDA = (Resultado Operacional + Depreciação) / Receitas * 100
  // Nota: Depreciação não está separada na estrutura atual, então usamos Resultado Operacional como proxy
  let margemEbitda: IndiceCalculado;
  if (v.receitasTotal === null || v.receitasTotal === 0) {
    margemEbitda = indiceIndisponivel('Receitas Total não encontrado ou igual a zero na DRE (código 1)');
  } else {
    // Calcular resultado operacional antes do resultado financeiro
    const custosTotal = Math.abs(v.custosTotal ?? 0);
    const despesasTotal = Math.abs(v.despesasTotal ?? 0);
    const ebitdaAproximado = v.receitasTotal - custosTotal - despesasTotal;
    // Nota: Este é um EBITDA aproximado, pois a depreciação está dentro de despesas
    margemEbitda = indiceDisponivel((ebitdaAproximado / v.receitasTotal) * 100);
  }
  
  // ROA = Resultado Líquido / Ativo Total * 100
  let roa: IndiceCalculado;
  if (v.ativoTotal === null || v.ativoTotal === 0) {
    roa = indiceIndisponivel('Ativo Total não encontrado ou igual a zero no BP (código 1)');
  } else if (v.resultadoLiquido === null) {
    roa = indiceIndisponivel('Resultado Líquido não encontrado na DRE (código 229)');
  } else {
    roa = indiceDisponivel((v.resultadoLiquido / v.ativoTotal) * 100);
  }
  
  // ROE = Resultado Líquido / Patrimônio Líquido * 100
  let roe: IndiceCalculado;
  if (v.patrimonioLiquido === null || v.patrimonioLiquido === 0) {
    roe = indiceIndisponivel('Patrimônio Líquido não encontrado ou igual a zero no BP (código 125)');
  } else if (v.resultadoLiquido === null) {
    roe = indiceIndisponivel('Resultado Líquido não encontrado na DRE (código 229)');
  } else {
    roe = indiceDisponivel((v.resultadoLiquido / v.patrimonioLiquido) * 100);
  }
  
  // ========== ÍNDICES DE ENDIVIDAMENTO ==========
  
  // Endividamento Geral = (PC + PNC) / Ativo Total * 100
  let endividamentoGeral: IndiceCalculado;
  if (v.ativoTotal === null || v.ativoTotal === 0) {
    endividamentoGeral = indiceIndisponivel('Ativo Total não encontrado ou igual a zero no BP (código 1)');
  } else {
    const pc = v.passivoCirculante ?? 0;
    const pnc = v.passivoNaoCirculante ?? 0;
    const totalPassivos = pc + pnc;
    endividamentoGeral = indiceDisponivel((totalPassivos / v.ativoTotal) * 100);
  }
  
  // Composição do Endividamento = PC / (PC + PNC) * 100
  let composicaoEndividamento: IndiceCalculado;
  const pcComp = v.passivoCirculante ?? 0;
  const pncComp = v.passivoNaoCirculante ?? 0;
  const totalPassivosComp = pcComp + pncComp;
  if (totalPassivosComp === 0) {
    composicaoEndividamento = indiceIndisponivel('Não há passivos (PC + PNC = 0), portanto não há endividamento a analisar');
  } else {
    composicaoEndividamento = indiceDisponivel((pcComp / totalPassivosComp) * 100);
  }
  
  // Grau de Alavancagem = (PC + PNC) / PL
  let grauAlavancagem: IndiceCalculado;
  if (v.patrimonioLiquido === null || v.patrimonioLiquido === 0) {
    grauAlavancagem = indiceIndisponivel('Patrimônio Líquido não encontrado ou igual a zero no BP (código 125)');
  } else {
    const pc = v.passivoCirculante ?? 0;
    const pnc = v.passivoNaoCirculante ?? 0;
    grauAlavancagem = indiceDisponivel((pc + pnc) / v.patrimonioLiquido);
  }
  
  // Imobilização do PL = Imobilizado / PL * 100
  let imobilizacaoPL: IndiceCalculado;
  if (v.patrimonioLiquido === null || v.patrimonioLiquido === 0) {
    imobilizacaoPL = indiceIndisponivel('Patrimônio Líquido não encontrado ou igual a zero no BP (código 125)');
  } else if (v.imobilizado === null) {
    imobilizacaoPL = indiceIndisponivel('Imobilizado não encontrado no BP (código 43)');
  } else {
    imobilizacaoPL = indiceDisponivel((v.imobilizado / v.patrimonioLiquido) * 100);
  }
  
  // ========== ÍNDICES DE ATIVIDADE ==========
  
  // Giro do Ativo = Receitas / Ativo Total
  let giroAtivo: IndiceCalculado;
  if (v.ativoTotal === null || v.ativoTotal === 0) {
    giroAtivo = indiceIndisponivel('Ativo Total não encontrado ou igual a zero no BP (código 1)');
  } else if (v.receitasTotal === null) {
    giroAtivo = indiceIndisponivel('Receitas Total não encontrado na DRE (código 1)');
  } else {
    giroAtivo = indiceDisponivel(v.receitasTotal / v.ativoTotal);
  }
  
  // Prazo Médio de Recebimento = (Contas a Receber / Receitas) * 360
  let prazoMedioRecebimento: IndiceCalculado;
  if (v.receitasTotal === null || v.receitasTotal === 0) {
    prazoMedioRecebimento = indiceIndisponivel('Receitas Total não encontrado ou igual a zero na DRE (código 1)');
  } else if (v.contasReceber === null) {
    prazoMedioRecebimento = indiceIndisponivel('Contas a Receber não encontrado no BP (código 7)');
  } else {
    prazoMedioRecebimento = indiceDisponivel((v.contasReceber / v.receitasTotal) * 360);
  }
  
  // Prazo Médio de Pagamento = (Fornecedores / Custos) * 360
  let prazoMedioPagamento: IndiceCalculado;
  if (v.custosTotal === null || v.custosTotal === 0) {
    prazoMedioPagamento = indiceIndisponivel('Custos Total não encontrado ou igual a zero na DRE (código 52)');
  } else if (v.fornecedores === null) {
    prazoMedioPagamento = indiceIndisponivel('Fornecedores não encontrado no BP (código 78)');
  } else {
    prazoMedioPagamento = indiceDisponivel((v.fornecedores / Math.abs(v.custosTotal)) * 360);
  }
  
  return {
    liquidez: {
      corrente: liquidezCorrente,
      seca: liquidezSeca,
      imediata: liquidezImediata,
      geral: liquidezGeral
    },
    rentabilidade: {
      margemBruta,
      margemOperacional,
      margemLiquida,
      margemEbitda,
      roa,
      roe
    },
    endividamento: {
      endividamentoGeral,
      composicaoEndividamento,
      grauAlavancagem,
      imobilizacaoPL
    },
    atividade: {
      giroAtivo,
      prazoMedioRecebimento,
      prazoMedioPagamento
    }
  };
}

/**
 * Converte os índices calculados para o formato simplificado usado nos PDFs
 * Retorna apenas os valores disponíveis
 */
export function indicesParaPDF(indices: IndicesCalculados): {
  liquidez: Record<string, number>;
  rentabilidade: Record<string, number>;
  endividamento: Record<string, number>;
  atividade: Record<string, number>;
  indisponiveisMotivos: Record<string, string>;
} {
  const indisponiveisMotivos: Record<string, string> = {};
  
  const extrair = (nome: string, indice: IndiceCalculado): number | undefined => {
    if (indice.disponivel && indice.valor !== null) {
      return indice.valor;
    }
    if (indice.motivo) {
      indisponiveisMotivos[nome] = indice.motivo;
    }
    return undefined;
  };
  
  const liquidez: Record<string, number> = {};
  const rentabilidade: Record<string, number> = {};
  const endividamento: Record<string, number> = {};
  const atividade: Record<string, number> = {};
  
  // Liquidez
  let v = extrair('liquidezCorrente', indices.liquidez.corrente);
  if (v !== undefined) liquidez.corrente = v;
  v = extrair('liquidezSeca', indices.liquidez.seca);
  if (v !== undefined) liquidez.seca = v;
  v = extrair('liquidezImediata', indices.liquidez.imediata);
  if (v !== undefined) liquidez.imediata = v;
  v = extrair('liquidezGeral', indices.liquidez.geral);
  if (v !== undefined) liquidez.geral = v;
  
  // Rentabilidade
  v = extrair('margemBruta', indices.rentabilidade.margemBruta);
  if (v !== undefined) rentabilidade.margemBruta = v;
  v = extrair('margemOperacional', indices.rentabilidade.margemOperacional);
  if (v !== undefined) rentabilidade.margemOp = v;
  v = extrair('margemLiquida', indices.rentabilidade.margemLiquida);
  if (v !== undefined) rentabilidade.margemLiq = v;
  v = extrair('margemEbitda', indices.rentabilidade.margemEbitda);
  if (v !== undefined) rentabilidade.margemEbitda = v;
  v = extrair('roa', indices.rentabilidade.roa);
  if (v !== undefined) rentabilidade.roa = v;
  v = extrair('roe', indices.rentabilidade.roe);
  if (v !== undefined) rentabilidade.roe = v;
  
  // Endividamento
  v = extrair('endividamentoGeral', indices.endividamento.endividamentoGeral);
  if (v !== undefined) endividamento.geral = v;
  v = extrair('composicaoEndividamento', indices.endividamento.composicaoEndividamento);
  if (v !== undefined) endividamento.composicao = v;
  v = extrair('grauAlavancagem', indices.endividamento.grauAlavancagem);
  if (v !== undefined) endividamento.alavancagem = v;
  v = extrair('imobilizacaoPL', indices.endividamento.imobilizacaoPL);
  if (v !== undefined) endividamento.imobilizacaoPL = v;
  
  // Atividade
  v = extrair('giroAtivo', indices.atividade.giroAtivo);
  if (v !== undefined) atividade.giroAtivo = v;
  v = extrair('prazoMedioRecebimento', indices.atividade.prazoMedioRecebimento);
  if (v !== undefined) atividade.pmr = v;
  v = extrair('prazoMedioPagamento', indices.atividade.prazoMedioPagamento);
  if (v !== undefined) atividade.pmp = v;
  
  return {
    liquidez,
    rentabilidade,
    endividamento,
    atividade,
    indisponiveisMotivos
  };
}
