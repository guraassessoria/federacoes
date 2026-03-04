import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  processBalanceteData,
  groupAccountsForBP,
  groupAccountsForDRE,
  groupAccountsForHierarchicalDRE,
  groupAccountsForHierarchicalBP,
  calculateFinancialIndices,
  parsePeriod,
  ProcessedBP,
  ProcessedDRE,
  HierarchicalDRE,
  HierarchicalBP,
  FinancialIndices,
  MonthlyData,
  consolidateYearlyData,
} from "@/lib/services/financialProcessing";
import {
  calcularIndices as calcularIndicesEstruturados,
  IndicesCalculados,
} from "@/lib/services/indicesFinanceiros";
import {
  mapBalanceteToEstrutura,
  processarDadosFinanceiros,
  ContaComValor,
  DeParaRecord,
  ContaEstrutura,
  loadEstruturaDRE,
  loadEstruturaBP,
} from "@/lib/services/estruturaMapping";
import { ordenarArvoreDreReceitaBrutaPrimeiro } from "@/lib/services/drePresentation";
import { FinancialDataQuerySchema } from "@/lib/validators";
import { handleApiError } from "@/lib/errorHandler";

export const dynamic = "force-dynamic";

type IndexAvailability = {
  liquidez: { corrente: boolean; seca: boolean; imediata: boolean; geral: boolean };
  rentabilidade: { margemBruta: boolean; margemOperacional: boolean; margemLiquida: boolean; margemEbitda: boolean; roa: boolean; roe: boolean };
  endividamento: { endividamentoGeral: boolean; composicaoEndividamento: boolean; grauAlavancagem: boolean; imobilizacaoPL: boolean };
  atividade: { giroAtivo: boolean; prazoMedioRecebimento: boolean; prazoMedioPagamento: boolean };
};

function numeroIndice(valor: number | null | undefined, disponivel: boolean | undefined): number {
  if (!disponivel || valor === null || valor === undefined) return 0;
  return Number(valor.toFixed(2));
}

function mapearIndicesEstruturados(indices: IndicesCalculados): FinancialIndices {
  return {
    liquidez: {
      corrente: numeroIndice(indices.liquidez.corrente.valor, indices.liquidez.corrente.disponivel),
      seca: numeroIndice(indices.liquidez.seca.valor, indices.liquidez.seca.disponivel),
      imediata: numeroIndice(indices.liquidez.imediata.valor, indices.liquidez.imediata.disponivel),
      geral: numeroIndice(indices.liquidez.geral.valor, indices.liquidez.geral.disponivel),
    },
    rentabilidade: {
      margemBruta: numeroIndice(indices.rentabilidade.margemBruta.valor, indices.rentabilidade.margemBruta.disponivel),
      margemOperacional: numeroIndice(indices.rentabilidade.margemOperacional.valor, indices.rentabilidade.margemOperacional.disponivel),
      margemLiquida: numeroIndice(indices.rentabilidade.margemLiquida.valor, indices.rentabilidade.margemLiquida.disponivel),
      margemEbitda: numeroIndice(indices.rentabilidade.margemEbitda.valor, indices.rentabilidade.margemEbitda.disponivel),
      roa: numeroIndice(indices.rentabilidade.roa.valor, indices.rentabilidade.roa.disponivel),
      roe: numeroIndice(indices.rentabilidade.roe.valor, indices.rentabilidade.roe.disponivel),
    },
    endividamento: {
      endividamentoGeral: numeroIndice(indices.endividamento.endividamentoGeral.valor, indices.endividamento.endividamentoGeral.disponivel),
      composicaoEndividamento: numeroIndice(indices.endividamento.composicaoEndividamento.valor, indices.endividamento.composicaoEndividamento.disponivel),
      grauAlavancagem: numeroIndice(indices.endividamento.grauAlavancagem.valor, indices.endividamento.grauAlavancagem.disponivel),
      imobilizacaoPL: numeroIndice(indices.endividamento.imobilizacaoPL.valor, indices.endividamento.imobilizacaoPL.disponivel),
    },
    atividade: {
      giroAtivo: numeroIndice(indices.atividade.giroAtivo.valor, indices.atividade.giroAtivo.disponivel),
      prazoMedioRecebimento: numeroIndice(indices.atividade.prazoMedioRecebimento.valor, indices.atividade.prazoMedioRecebimento.disponivel),
      prazoMedioPagamento: numeroIndice(indices.atividade.prazoMedioPagamento.valor, indices.atividade.prazoMedioPagamento.disponivel),
    },
  };
}

/**
 * GET - Busca dados financeiros processados para uma empresa
 * Query params:
 * - companyId: ID da empresa
 * - viewMode: "anual" | "mensal"
 * - year: Ano para filtrar (ex: "2025")
 * - month: Mês para filtrar quando viewMode="mensal" (ex: "01")
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let params;
    try {
      params = FinancialDataQuerySchema.parse(Object.fromEntries(searchParams.entries()));
    } catch (err) {
      if (err instanceof Error && 'errors' in err) {
        // ZodError
        return NextResponse.json({ error: 'Invalid parameters', details: (err as any).errors }, { status: 400 });
      }
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const { companyId, viewMode, year, month } = params;
    const monthValue = month ?? "01";

    // Verifica acesso à empresa
    const userCompany = await prisma.userCompany.findFirst({
      where: {
        userId: session.user.id,
        companyId: companyId,
      },
    });

    if (!userCompany && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Sem acesso a esta empresa" }, { status: 403 });
    }

    // Busca todos os períodos disponíveis para a empresa
    const periods = await prisma.balancete.findMany({
      where: { companyId },
      select: { period: true },
      distinct: ["period"],
    });

    const uniquePeriods: string[] = [...new Set(periods.map((p: { period: string }) => p.period))];

    // Se não há dados no banco, retorna dados de demonstração
    if (uniquePeriods.length === 0) {
      return NextResponse.json({
        success: true,
        source: "demonstration",
        message: "Dados de demonstração - faça upload de balancetes para ver dados reais",
        data: await generateDemoData(viewMode, year, monthValue),
      });
    }

    // Filtra períodos pelo ano solicitado
    const filteredPeriods = uniquePeriods.filter((period) => {
      const parsed = parsePeriod(period);
      return parsed && parsed.year === year;
    });

    if (filteredPeriods.length === 0) {
      // Retorna dados de demonstração se não há dados para o ano
      return NextResponse.json({
        success: true,
        source: "demonstration",
        message: `Sem dados para o ano ${year} - exibindo dados de demonstração`,
        data: await generateDemoData(viewMode, year, monthValue),
      });
    }

    const deParaRows = await prisma.deParaMapping.findMany({
      where: { companyId },
      select: {
        contaFederacao: true,
        padraoBP: true,
        padraoDRE: true,
        padraoDFC: true,
        padraoDMPL: true,
      },
    });

    const deParaRecords: DeParaRecord[] = deParaRows.map(r => ({
      contaFederacao: r.contaFederacao,
      padraoBP: r.padraoBP,
      padraoDRE: r.padraoDRE,
      padraoDFC: r.padraoDFC,
      padraoDMPL: r.padraoDMPL,
    }));

    // Processa dados mensais
    const monthlyDataArray: MonthlyData[] = [];
    const monthlyIndexAvailabilityByPeriod: Record<string, IndexAvailability> = {};
    // Armazena contas processadas do último período para dados hierárquicos
    let lastProcessedAccounts: ReturnType<typeof processBalanceteData> = [];

    for (const period of filteredPeriods) {
      const balancetes = await prisma.balancete.findMany({
        where: {
          companyId,
          period,
        },
      });

      if (balancetes.length > 0) {
        const processedAccounts = processBalanceteData(balancetes);
        lastProcessedAccounts = processedAccounts; // Guarda para uso nos hierárquicos
        const bp = groupAccountsForBP(processedAccounts);
        const dre = groupAccountsForDRE(processedAccounts);
        let indices = calculateFinancialIndices(bp, dre);

        try {
          const estruturadoMes = await processarDadosFinanceiros(balancetes, deParaRecords);
          const indicesEstruturados = calcularIndicesEstruturados(estruturadoMes.bp, estruturadoMes.dre);
          indices = mapearIndicesEstruturados(indicesEstruturados);
          monthlyIndexAvailabilityByPeriod[period] = mapearDisponibilidadeIndices(indicesEstruturados);
        } catch (error) {
          console.error(`Erro ao calcular índices estruturados (${period}):`, error);
        }

        monthlyDataArray.push({
          period,
          bp,
          dre,
          indices,
        });
      }
    }

    // Ordena por período
    monthlyDataArray.sort((a, b) => {
      const parsedA = parsePeriod(a.period);
      const parsedB = parsePeriod(b.period);
      if (!parsedA || !parsedB) return 0;
      return parseInt(parsedA.month) - parseInt(parsedB.month);
    });

    if (viewMode === "mensal") {
      // Retorna dados do mês específico
      const monthData = monthlyDataArray.find((m) => {
        const parsed = parsePeriod(m.period);
        return parsed && parsed.month === monthValue.padStart(2, "0");
      });

      if (monthData) {
        // ═══ PROCESSAR estruturaDRE para o mês ═══
        let estruturaDREMensal: ContaComValor[] | null = null;
        let estruturaBPMensal: ContaComValor[] | null = null;
        try {
          // Busca dados do balancete APENAS deste mês
          const balanceteMes = await prisma.balancete.findMany({
            where: { companyId, period: monthData.period },
          });

          if (balanceteMes.length > 0) {
            const processado = await processarDadosFinanceiros(balanceteMes, deParaRecords);
            estruturaDREMensal = ordenarArvoreDreReceitaBrutaPrimeiro(processado.dre);
            estruturaBPMensal = processado.bp;
          }
        } catch (error) {
          console.error(`Erro ao processar estrutura mensal ${monthValue}/${year}:`, error);
        }

        return NextResponse.json({
          success: true,
          source: "database",
          viewMode: "mensal",
          year,
          month: monthValue,
          data: {
            bp: monthData.bp,
            dre: monthData.dre,
            indices: monthData.indices,
            indexAvailability: monthlyIndexAvailabilityByPeriod[monthData.period],
            period: monthData.period,
            estruturaDRE: estruturaDREMensal,
            estruturaBP: estruturaBPMensal,
          },
        });
      } else {
        // Há balancetes no ano mas não para este mês específico
        // Retorna dados vazios (não fictícios) para que o frontend mostre "-"
        return NextResponse.json({
          success: true,
          source: "database",
          viewMode: "mensal",
          year,
          month: monthValue,
          message: `Sem balancete para ${monthValue}/${year}`,
          data: {
            bp: null,
            dre: null,
            indices: null,
            period: null,
            estruturaDRE: null,
            estruturaBP: null,
          },
        });
      }
    } else {
      // Consolida dados anuais
      const yearlyData = consolidateYearlyData(monthlyDataArray);
      
      if (yearlyData) {
        // Busca todos os dados do balancete para o ano
        const allBalancetes = await prisma.balancete.findMany({
          where: {
            companyId,
            period: { in: filteredPeriods },
          },
        });

        // Mapeia dados para a estrutura base usando o de-para
        let estruturaDRE: ContaComValor[] | null = null;
        let estruturaBP: ContaComValor[] | null = null;
        let resultadoDRE: number = 0;
        let totalPassivoPL: number = 0;
        let indicesConsolidados: FinancialIndices = yearlyData.consolidated.indices;
        let indexAvailabilityConsolidada: IndexAvailability | undefined;
        
        if (allBalancetes.length > 0) {
  try {
    console.log(`[financial-data] De-para: ${deParaRecords.length} registros`);
    
    const processado = await processarDadosFinanceiros(allBalancetes, deParaRecords);
          estruturaDRE = ordenarArvoreDreReceitaBrutaPrimeiro(processado.dre);
            estruturaBP = processado.bp;
            resultadoDRE = processado.resultadoDRE;
            totalPassivoPL = processado.totalPassivoPL;

            const indicesEstruturadosAnual = calcularIndicesEstruturados(processado.bp, processado.dre);
            indicesConsolidados = mapearIndicesEstruturados(indicesEstruturadosAnual);
            indexAvailabilityConsolidada = mapearDisponibilidadeIndices(indicesEstruturadosAnual);
          } catch (error) {
            console.error("Erro ao mapear estrutura:", error);
            // Fallback para dados hierárquicos antigos se o mapeamento falhar
            estruturaDRE = null;
            estruturaBP = null;
          }
        }

        // Gera dados hierárquicos a partir das contas processadas (fallback)
        const hierarchicalDRE = lastProcessedAccounts.length > 0 
          ? groupAccountsForHierarchicalDRE(lastProcessedAccounts)
          : null;
        const hierarchicalBP = lastProcessedAccounts.length > 0
          ? groupAccountsForHierarchicalBP(lastProcessedAccounts)
          : null;
        
        return NextResponse.json({
          success: true,
          source: "database",
          viewMode: "anual",
          year,
          data: {
            bp: yearlyData.consolidated.bp,
            dre: yearlyData.consolidated.dre,
            indices: indicesConsolidados,
            indexAvailability: indexAvailabilityConsolidada,
            months: yearlyData.months.map((m) => ({
              period: m.period,
              indices: m.indices,
              indexAvailability: monthlyIndexAvailabilityByPeriod[m.period],
            })),
            // Dados hierárquicos na estrutura base (de-para)
            estruturaDRE,
            estruturaBP,
            // Totais calculados
            resultadoDRE,
            totalPassivoPL,
            // Dados hierárquicos brutos (fallback)
            hierarchicalDRE,
            hierarchicalBP,
          },
        });
      } else {
        return NextResponse.json({
          success: true,
          source: "demonstration",
          message: "Dados insuficientes para consolidação anual",
          data: await generateDemoData("anual", year, monthValue),
        });
      }
    }
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}

/**
 * Gera dados de demonstração quando não há dados reais no banco
 * Inclui estruturaDRE para visão mensal funcionar corretamente
 */
async function generateDemoData(
  viewMode: string,
  year: string,
  month: string
): Promise<{
  bp: ProcessedBP;
  dre: ProcessedDRE;
  indices: FinancialIndices;
  period?: string;
  months?: Array<{ period: string; indices: FinancialIndices }>;
  estruturaDRE?: ContaComValor[];
  estruturaBP?: ContaComValor[];
  resultadoDRE?: number;
  totalPassivoPL?: number;
}> {
  // Fatores de variação por ano para simular crescimento
  const yearFactors: Record<string, number> = {
    "2023": 0.85,
    "2024": 0.95,
    "2025": 1.0,
    "2026": 1.05,
  };
  const factor = yearFactors[year] || 1.0;

  // ═══ DADOS BASE (valores em reais, não milhares) ═══
  // BP - valores anuais (posição patrimonial)
  const disponibilidades = 3000000 * factor;
  const aplicacoesFinanceiras = 5000000 * factor;
  const contasReceber = 4500000 * factor;
  const estoques = 1500000 * factor;
  const outrosAC = 1000000 * factor;
  const totalAtivoCirculante = disponibilidades + aplicacoesFinanceiras + contasReceber + estoques + outrosAC;
  
  const realizavelLP = 5000000 * factor;
  const investimentos = 8000000 * factor;
  const imobilizado = 20000000 * factor;
  const intangivel = 2000000 * factor;
  const totalAtivoNaoCirculante = realizavelLP + investimentos + imobilizado + intangivel;
  
  const ativoTotal = totalAtivoCirculante + totalAtivoNaoCirculante;
  
  const fornecedores = 3000000 * factor;
  const obrigTrabalhistas = 2500000 * factor;
  const obrigFiscais = 2000000 * factor;
  const emprestimosCP = 2500000 * factor;
  const totalPassivoCirculante = fornecedores + obrigTrabalhistas + obrigFiscais + emprestimosCP;
  
  const emprestimosLP = 12000000 * factor;
  const provisoes = 3000000 * factor;
  const totalPassivoNaoCirculante = emprestimosLP + provisoes;
  
  const capitalSocial = 15000000 * factor;
  const reservas = 5000000 * factor;
  const lucrosAcumulados = 5000000 * factor;
  const totalPL = capitalSocial + reservas + lucrosAcumulados;
  
  const totalPassivos = totalPassivoCirculante + totalPassivoNaoCirculante;
  
  // DRE - valores anuais
  const receitaBruta = 45000000 * factor;
  const deducoes = 0; // Federações geralmente não têm deduções
  const receitaLiquida = receitaBruta - deducoes;
  const custos = 25000000 * factor;
  const margemBruta = receitaLiquida - custos;
  const despesasGerais = 10000000 * factor;
  const resultadoOperacional = margemBruta - despesasGerais;
  const resultadoFinanceiro = -2000000 * factor; // Negativo = despesa > receita
  const outrasRecDesp = 0;
  const lucroAntesIR = resultadoOperacional + resultadoFinanceiro + outrasRecDesp;
  const resultadoLiquido = lucroAntesIR; // Federações não pagam IR

  // Fator mensal para DRE (proporção)
  const monthFactor = viewMode === "mensal" ? 1 / 12 : 1;
  // Fator de sazonalidade por mês (simula variação)
  const monthIndex = parseInt(month) - 1;
  const sazonalidade = [0.7, 0.75, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.1, 0.95];
  const mFactor = viewMode === "mensal" ? (sazonalidade[monthIndex] || 1.0) / 12 : 1;

  // ═══ BP processado (formato antigo - compatibilidade) ═══
  const bp: ProcessedBP = {
    ativoCirculante: {
      "Disponibilidades": disponibilidades,
      "Aplicações Financeiras": aplicacoesFinanceiras,
      "Contas a Receber": contasReceber,
      "Estoques": estoques,
      "Outros Ativos Circulantes": outrosAC,
      "TOTAL_ATIVO_CIRCULANTE": totalAtivoCirculante,
    },
    ativoNaoCirculante: {
      "Realizável a Longo Prazo": realizavelLP,
      "Investimentos": investimentos,
      "Imobilizado": imobilizado,
      "Intangível": intangivel,
      "TOTAL_ATIVO_NAO_CIRCULANTE": totalAtivoNaoCirculante,
    },
    passivoCirculante: {
      "Fornecedores": fornecedores,
      "Obrigações Trabalhistas": obrigTrabalhistas,
      "Obrigações Fiscais": obrigFiscais,
      "Empréstimos CP": emprestimosCP,
      "TOTAL_PASSIVO_CIRCULANTE": totalPassivoCirculante,
    },
    passivoNaoCirculante: {
      "Empréstimos LP": emprestimosLP,
      "Provisões": provisoes,
      "TOTAL_PASSIVO_NAO_CIRCULANTE": totalPassivoNaoCirculante,
    },
    patrimonioLiquido: {
      "Capital Social": capitalSocial,
      "Reservas": reservas,
      "Lucros Acumulados": lucrosAcumulados,
      "TOTAL_PATRIMONIO_LIQUIDO": totalPL,
    },
    totalAtivo: ativoTotal,
    totalPassivo: totalPassivos + totalPL,
  };

  // ═══ DRE processado (formato antigo - compatibilidade) ═══
  const dre: ProcessedDRE = {
    receitas: {
      "Receitas de Competições": 18000000 * factor * mFactor,
      "Patrocínios": 12000000 * factor * mFactor,
      "Direitos de Transmissão": 10000000 * factor * mFactor,
      "Outras Receitas": 5000000 * factor * mFactor,
    },
    custos: {
      "Arbitragem": 8000000 * factor * mFactor,
      "Premiações": 7000000 * factor * mFactor,
      "Infraestrutura": 5000000 * factor * mFactor,
      "Outros Custos": 5000000 * factor * mFactor,
    },
    despesas: {
      "Despesas Administrativas": 5000000 * factor * mFactor,
      "Despesas com Pessoal": 3000000 * factor * mFactor,
      "Despesas Financeiras": 2000000 * factor * mFactor,
    },
    resultados: {
      totalReceitas: receitaBruta * mFactor,
      totalCustos: custos * mFactor,
      resultadoBruto: margemBruta * mFactor,
      totalDespesas: despesasGerais * mFactor,
      resultadoOperacional: resultadoOperacional * mFactor,
      resultadoLiquido: resultadoLiquido * mFactor,
    },
    total: resultadoLiquido * mFactor,
  };

  // ═══ ÍNDICES FINANCEIROS (fórmulas corretas) ═══
  
  // LIQUIDEZ
  // Corrente = Ativo Circulante / Passivo Circulante
  const liqCorrente = totalPassivoCirculante !== 0 ? totalAtivoCirculante / totalPassivoCirculante : 0;
  // Seca = (Ativo Circulante - Estoques) / Passivo Circulante
  const liqSeca = totalPassivoCirculante !== 0 ? (totalAtivoCirculante - estoques) / totalPassivoCirculante : 0;
  // Imediata = Disponibilidades / Passivo Circulante
  const liqImediata = totalPassivoCirculante !== 0 ? disponibilidades / totalPassivoCirculante : 0;
  // Geral = (Ativo Circulante + Realizável LP) / (Passivo Circulante + Passivo Não Circulante)
  const liqGeral = totalPassivos !== 0 ? (totalAtivoCirculante + realizavelLP) / totalPassivos : 0;

  // RENTABILIDADE (usa valores anuais da DRE)
  const receitaBase = receitaBruta; // Base: receita bruta anual
  // Margem Bruta = (Receita Líquida - Custos) / Receita Líquida × 100
  const mgBruta = receitaLiquida !== 0 ? ((receitaLiquida - custos) / receitaLiquida) * 100 : 0;
  // Margem Operacional = Resultado Operacional / Receita Líquida × 100
  const mgOperacional = receitaLiquida !== 0 ? (resultadoOperacional / receitaLiquida) * 100 : 0;
  // Margem Líquida = Resultado Líquido / Receita Líquida × 100
  const mgLiquida = receitaLiquida !== 0 ? (resultadoLiquido / receitaLiquida) * 100 : 0;
  // Margem EBITDA ≈ (Resultado Operacional + Depreciação) / Receita Líquida × 100
  // Sem depreciação separada, usamos Resultado Operacional como proxy do EBITDA
  const depreciacao = 2000000 * factor; // Estimativa
  const ebitda = resultadoOperacional + depreciacao;
  const mgEbitda = receitaLiquida !== 0 ? (ebitda / receitaLiquida) * 100 : 0;
  // ROA = Resultado Líquido / Ativo Total × 100
  const roaCalc = ativoTotal !== 0 ? (resultadoLiquido / ativoTotal) * 100 : 0;
  // ROE = Resultado Líquido / Patrimônio Líquido × 100
  const roeCalc = totalPL !== 0 ? (resultadoLiquido / totalPL) * 100 : 0;

  // ENDIVIDAMENTO
  // Endividamento Geral = (PC + PNC) / Ativo Total × 100
  const endGeral = ativoTotal !== 0 ? (totalPassivos / ativoTotal) * 100 : 0;
  // Composição do Endividamento = PC / (PC + PNC) × 100
  const compEnd = totalPassivos !== 0 ? (totalPassivoCirculante / totalPassivos) * 100 : 0;
  // Grau de Alavancagem (Participação Capital Terceiros / PL) = (PC + PNC) / PL
  const grauAlav = totalPL !== 0 ? totalPassivos / totalPL : 0;
  // Imobilização do PL = Imobilizado / PL × 100
  const imobPL = totalPL !== 0 ? (imobilizado / totalPL) * 100 : 0;

  // ATIVIDADE
  // Giro do Ativo = Receita Líquida / Ativo Total
  const giroAtivo = ativoTotal !== 0 ? receitaLiquida / ativoTotal : 0;
  // Prazo Médio de Recebimento = (Contas a Receber / Receita Líquida) × 360
  const pmr = receitaLiquida !== 0 ? Math.round((contasReceber / receitaLiquida) * 360) : 0;
  // Prazo Médio de Pagamento = (Fornecedores / Custos) × 360
  const pmp = custos !== 0 ? Math.round((fornecedores / custos) * 360) : 0;

  const indices: FinancialIndices = {
    liquidez: {
      corrente: Number(liqCorrente.toFixed(2)),
      seca: Number(liqSeca.toFixed(2)),
      imediata: Number(liqImediata.toFixed(2)),
      geral: Number(liqGeral.toFixed(2)),
    },
    rentabilidade: {
      margemBruta: Number(mgBruta.toFixed(2)),
      margemOperacional: Number(mgOperacional.toFixed(2)),
      margemLiquida: Number(mgLiquida.toFixed(2)),
      margemEbitda: Number(mgEbitda.toFixed(2)),
      roa: Number(roaCalc.toFixed(2)),
      roe: Number(roeCalc.toFixed(2)),
    },
    endividamento: {
      endividamentoGeral: Number(endGeral.toFixed(2)),
      composicaoEndividamento: Number(compEnd.toFixed(2)),
      grauAlavancagem: Number(grauAlav.toFixed(2)),
      imobilizacaoPL: Number(imobPL.toFixed(2)),
    },
    atividade: {
      giroAtivo: Number(giroAtivo.toFixed(2)),
      prazoMedioRecebimento: pmr,
      prazoMedioPagamento: pmp,
    },
  };

  const normalizarTexto = (value: string) =>
    (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

  const buscarCodigoPorDescricao = (
    estrutura: ContaEstrutura[],
    termosPreferenciais: string[][],
    fallbackCodigos: string[] = []
  ): string | null => {
    for (const termos of termosPreferenciais) {
      const matches = estrutura
        .filter((conta) => {
          const desc = normalizarTexto(conta.descricao || '');
          return termos.every((termo) => desc.includes(normalizarTexto(termo)));
        })
        .sort((a, b) => {
          const na = Number(a.nivel ?? Number.MAX_SAFE_INTEGER);
          const nb = Number(b.nivel ?? Number.MAX_SAFE_INTEGER);
          if (na !== nb) return na - nb;
          return String(a.codigo).localeCompare(String(b.codigo));
        });
      if (matches.length > 0) return matches[0].codigo;
    }

    for (const codigo of fallbackCodigos) {
      if (estrutura.some((conta) => conta.codigo === codigo)) return codigo;
    }

    return null;
  };

  const construirArvoreComValores = (
    estrutura: ContaEstrutura[],
    valoresPorCodigo: Record<string, number>
  ): ContaComValor[] => {
    const ordemPorCodigo = new Map<string, number>();
    estrutura.forEach((item, idx) => {
      ordemPorCodigo.set(item.codigo, Number.isFinite(Number(item.ordem)) ? Number(item.ordem) : idx + 1);
    });

    const mapa = new Map<string, ContaComValor>();
    estrutura.forEach((item) => {
      mapa.set(item.codigo, {
        codigo: item.codigo,
        descricao: item.descricao,
        codigoSuperior: item.codigoSuperior,
        nivel: item.nivel,
        nivelVisualizacao: item.nivelVisualizacao,
        valor: valoresPorCodigo[item.codigo] || 0,
        children: [],
      });
    });

    const roots: ContaComValor[] = [];
    estrutura.forEach((item) => {
      const atual = mapa.get(item.codigo)!;
      if (item.codigoSuperior) {
        const pai = mapa.get(item.codigoSuperior);
        if (pai) {
          pai.children!.push(atual);
          return;
        }
      }
      roots.push(atual);
    });

    const sortRec = (nodes: ContaComValor[]) => {
      nodes.sort((a, b) => {
        const oa = ordemPorCodigo.get(a.codigo) ?? Number.MAX_SAFE_INTEGER;
        const ob = ordemPorCodigo.get(b.codigo) ?? Number.MAX_SAFE_INTEGER;
        if (oa !== ob) return oa - ob;
        return a.codigo.localeCompare(b.codigo);
      });
      nodes.forEach((node) => {
        if (node.children?.length) sortRec(node.children);
      });
    };

    const preencherPais = (node: ContaComValor): number => {
      if (!node.children?.length) return node.valor;
      const somaFilhos = node.children.reduce((s, child) => s + preencherPais(child), 0);
      if (Math.abs(node.valor || 0) < 0.000001) node.valor = somaFilhos;
      return node.valor;
    };

    sortRec(roots);
    roots.forEach((root) => preencherPais(root));
    return roots;
  };

  const [estruturaDREPadrao, estruturaBPPadrao] = await Promise.all([
    loadEstruturaDRE(),
    loadEstruturaBP(),
  ]);

  const gerarEstruturaDREPadrao = (fatorDre: number): ContaComValor[] => {
    if (!estruturaDREPadrao.length) return [];

    const v = (val: number) => Math.round(val * fatorDre);
    const valores: Record<string, number> = {};

    const set = (termos: string[][], valor: number, fallback: string[] = []) => {
      const codigo = buscarCodigoPorDescricao(estruturaDREPadrao, termos, fallback);
      if (codigo) valores[codigo] = valor;
    };

    set([['receita', 'bruta']], v(receitaBruta), ['51']);
    set([['receitas', 'competicoes']], v(18000000 * factor), ['1']);
    set([['receitas', 'repasses']], v(13500000 * factor), ['19']);
    set([['outras', 'receitas', 'operacionais']], v(5000000 * factor), ['40']);
    set([['receita', 'liquida']], v(receitaLiquida), ['56']);

    set([['custos']], v(custos), ['57']);
    set([['arbitragem']], v(8000000 * factor), ['60']);
    set([['premiacoes']], v(7000000 * factor), ['65']);
    set([['infraestrutura', 'esportiva']], v(5000000 * factor), ['68']);
    set([['outros', 'custos']], v(5000000 * factor), ['72']);

    set([['margem', 'bruta']], v(margemBruta), ['109']);
    set([['despesas']], v(despesasGerais), ['110']);
    set([['despesas', 'administrativas']], v(5000000 * factor), ['125']);
    set([['despesas', 'pessoal']], v(3000000 * factor), ['105']);
    set([['despesas', 'comerciais'], ['marketing']], v(2000000 * factor), ['164']);

    set([['resultado', 'operacional']], v(resultadoOperacional), ['196', '211']);
    set([['lucro', 'antes', 'resultado', 'financeiro']], v(resultadoOperacional), ['197']);
    set([['resultado', 'financeiro']], v(resultadoFinanceiro), ['198', '190']);
    set([['receitas', 'financeiras']], v(500000 * factor), ['198.1', '191']);
    set([['despesas', 'financeiras']], v(-2500000 * factor), ['198.2', '199']);
    set([['lucro', 'antes', 'impostos']], v(lucroAntesIR), ['227']);
    set([['superavit', 'deficit', 'exercicio']], v(resultadoLiquido), ['229']);

    return ordenarArvoreDreReceitaBrutaPrimeiro(construirArvoreComValores(estruturaDREPadrao, valores));
  };

  const gerarEstruturaBPPadrao = (): ContaComValor[] => {
    if (!estruturaBPPadrao.length) return [];

    const valores: Record<string, number> = {};
    const set = (termos: string[][], valor: number, fallback: string[] = []) => {
      const codigo = buscarCodigoPorDescricao(estruturaBPPadrao, termos, fallback);
      if (codigo) valores[codigo] = Math.round(valor);
    };

    set([['ativo']], ativoTotal, ['1']);
    set([['ativo', 'circulante']], totalAtivoCirculante, ['2']);
    set([['disponibilidades']], disponibilidades + aplicacoesFinanceiras, ['3']);
    set([['contas', 'a', 'receber']], contasReceber, ['7']);
    set([['estoques']], estoques, ['17']);
    set([['ativo', 'nao', 'circulante']], totalAtivoNaoCirculante, ['33']);
    set([['realizavel', 'longo', 'prazo']], realizavelLP, ['34']);
    set([['imobilizado']], imobilizado, ['43']);

    set([['passivo', 'pl'], ['passivo', 'patrimonio']], totalPassivos + totalPL, ['76']);
    set([['passivo', 'circulante']], totalPassivoCirculante, ['77']);
    set([['fornecedores']], fornecedores, ['78']);
    set([['passivo', 'nao', 'circulante']], totalPassivoNaoCirculante, ['113']);
    set([['patrimonio', 'liquido']], totalPL, ['125']);
    set([['capital', 'social']], capitalSocial, ['126']);
    set([['superavit', 'acumulados'], ['lucros', 'acumulados']], lucrosAcumulados, ['141']);

    return construirArvoreComValores(estruturaBPPadrao, valores);
  };

  const estruturaDREMensal = gerarEstruturaDREPadrao(mFactor);
  const estruturaDREAnual = gerarEstruturaDREPadrao(1);
  const estruturaBPDemo = gerarEstruturaBPPadrao();

  if (viewMode === "mensal") {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthName = months[monthIndex] || "DEZ";
    const yearShort = year.slice(-2);
    
    return {
      bp,
      dre,
      indices,
      period: `${monthName}/${yearShort}`,
      estruturaDRE: estruturaDREMensal,
      estruturaBP: estruturaBPDemo,
      resultadoDRE: resultadoLiquido * mFactor,
      totalPassivoPL: totalPassivos + totalPL,
    };
  }

  // ═══ Visão anual ═══
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const yearShort = year.slice(-2);
  const monthlyIndices = months.map((m, i) => {
    // Pequena variação mensal para simular realismo
    const monthVariation = 0.9 + (i * 0.02);
    return {
      period: `${m}/${yearShort}`,
      indices: {
        liquidez: {
          corrente: Number((liqCorrente * monthVariation).toFixed(2)),
          seca: Number((liqSeca * monthVariation).toFixed(2)),
          imediata: Number((liqImediata * monthVariation).toFixed(2)),
          geral: Number((liqGeral * monthVariation).toFixed(2)),
        },
        rentabilidade: {
          margemBruta: Number(mgBruta.toFixed(2)),
          margemOperacional: Number(mgOperacional.toFixed(2)),
          margemLiquida: Number(mgLiquida.toFixed(2)),
          margemEbitda: Number(mgEbitda.toFixed(2)),
          roa: Number(roaCalc.toFixed(2)),
          roe: Number(roeCalc.toFixed(2)),
        },
        endividamento: indices.endividamento,
        atividade: indices.atividade,
      },
    };
  });

  return {
    bp,
    dre,
    indices,
    months: monthlyIndices,
    estruturaDRE: estruturaDREAnual,
    estruturaBP: estruturaBPDemo,
    resultadoDRE: resultadoLiquido,
    totalPassivoPL: totalPassivos + totalPL,
  };
}

function mapearDisponibilidadeIndices(indices: IndicesCalculados): IndexAvailability {
  return {
    liquidez: {
      corrente: indices.liquidez.corrente.disponivel,
      seca: indices.liquidez.seca.disponivel,
      imediata: indices.liquidez.imediata.disponivel,
      geral: indices.liquidez.geral.disponivel,
    },
    rentabilidade: {
      margemBruta: indices.rentabilidade.margemBruta.disponivel,
      margemOperacional: indices.rentabilidade.margemOperacional.disponivel,
      margemLiquida: indices.rentabilidade.margemLiquida.disponivel,
      margemEbitda: indices.rentabilidade.margemEbitda.disponivel,
      roa: indices.rentabilidade.roa.disponivel,
      roe: indices.rentabilidade.roe.disponivel,
    },
    endividamento: {
      endividamentoGeral: indices.endividamento.endividamentoGeral.disponivel,
      composicaoEndividamento: indices.endividamento.composicaoEndividamento.disponivel,
      grauAlavancagem: indices.endividamento.grauAlavancagem.disponivel,
      imobilizacaoPL: indices.endividamento.imobilizacaoPL.disponivel,
    },
    atividade: {
      giroAtivo: indices.atividade.giroAtivo.disponivel,
      prazoMedioRecebimento: indices.atividade.prazoMedioRecebimento.disponivel,
      prazoMedioPagamento: indices.atividade.prazoMedioPagamento.disponivel,
    },
  };
}