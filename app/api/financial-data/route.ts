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
  mapBalanceteToEstrutura,
  processarDadosFinanceiros,
  ContaComValor,
  DeParaRecord 
} from "@/lib/services/estruturaMapping";

export const dynamic = "force-dynamic";

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
    const companyId = searchParams.get("companyId");
    const viewMode = searchParams.get("viewMode") || "anual";
    const year = searchParams.get("year") || "2025";
    const month = searchParams.get("month") || "12";

    if (!companyId) {
      return NextResponse.json({ error: "companyId é obrigatório" }, { status: 400 });
    }

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
    const periods = await prisma.balanceteData.findMany({
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
        data: generateDemoData(viewMode, year, month),
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
        data: generateDemoData(viewMode, year, month),
      });
    }

    // Processa dados mensais
    const monthlyDataArray: MonthlyData[] = [];
    // Armazena contas processadas do último período para dados hierárquicos
    let lastProcessedAccounts: ReturnType<typeof processBalanceteData> = [];

    for (const period of filteredPeriods) {
      const balanceteData = await prisma.balanceteData.findMany({
        where: {
          companyId,
          period,
        },
      });

      if (balanceteData.length > 0) {
        const processedAccounts = processBalanceteData(balanceteData);
        lastProcessedAccounts = processedAccounts; // Guarda para uso nos hierárquicos
        const bp = groupAccountsForBP(processedAccounts);
        const dre = groupAccountsForDRE(processedAccounts);
        const indices = calculateFinancialIndices(bp, dre);

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
        return parsed && parsed.month === month.padStart(2, "0");
      });

      if (viewMode === "mensal") {
      // Retorna dados do mês específico
      const monthData = monthlyDataArray.find((m) => {
        const parsed = parsePeriod(m.period);
        return parsed && parsed.month === month.padStart(2, "0");
      });

      if (monthData) {
        // ═══ PROCESSAR estruturaDRE para o mês ═══
        let estruturaDREMensal: ContaComValor[] | null = null;
        try {
          // Busca dados do balancete APENAS deste mês
          const balanceteMes = await prisma.balanceteData.findMany({
            where: { companyId, period: monthData.period },
          });

          if (balanceteMes.length > 0) {
            // Carrega de-para
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

            const processado = await processarDadosFinanceiros(balanceteMes, deParaRecords);
            estruturaDREMensal = processado.dre;
          }
        } catch (error) {
          console.error(`Erro ao processar estrutura mensal ${month}/${year}:`, error);
        }

        return NextResponse.json({
          success: true,
          source: "database",
          viewMode: "mensal",
          year,
          month,
          data: {
            bp: monthData.bp,
            dre: monthData.dre,
            indices: monthData.indices,
            period: monthData.period,
            estruturaDRE: estruturaDREMensal,
          },
        });
      } else {
        // Retorna demonstração para o mês sem dados
        return NextResponse.json({
          success: true,
          source: "demonstration",
          message: `Sem dados para ${month}/${year}`,
          viewMode: "mensal",
          year,
          month,
          data: generateDemoData("mensal", year, month),
        });
      }
    } else {
      // Consolida dados anuais
      const yearlyData = consolidateYearlyData(monthlyDataArray);
      
      if (yearlyData) {
        // Busca todos os dados do balancete para o ano
        const allBalanceteData = await prisma.balanceteData.findMany({
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
        
        if (allBalanceteData.length > 0) {
  try {
    // Carrega o de-para do banco para a empresa
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
    console.log(`[financial-data] De-para: ${deParaRecords.length} registros`);
    
    const processado = await processarDadosFinanceiros(allBalanceteData, deParaRecords);
            estruturaDRE = processado.dre;
            estruturaBP = processado.bp;
            resultadoDRE = processado.resultadoDRE;
            totalPassivoPL = processado.totalPassivoPL;
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
            indices: yearlyData.consolidated.indices,
            months: yearlyData.months.map((m) => ({
              period: m.period,
              indices: m.indices,
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
          data: generateDemoData("anual", year, month),
        });
      }
    }
  } catch (error) {
    console.error("Erro ao buscar dados financeiros:", error);
    return NextResponse.json(
      { error: "Erro interno ao processar dados financeiros" },
      { status: 500 }
    );
  }
}

/**
 * Gera dados de demonstração quando não há dados reais no banco
 */
function generateDemoData(
  viewMode: string,
  year: string,
  month: string
): {
  bp: ProcessedBP;
  dre: ProcessedDRE;
  indices: FinancialIndices;
  period?: string;
  months?: Array<{ period: string; indices: FinancialIndices }>;
} {
  // Fatores de variação por ano para simular crescimento
  const yearFactors: Record<string, number> = {
    "2023": 0.85,
    "2024": 0.95,
    "2025": 1.0,
    "2026": 1.05,
  };
  const factor = yearFactors[year] || 1.0;

  // Dados base (valores em milhares)
  const baseReceitas = 45000 * factor;
  const baseCustos = 25000 * factor;
  const baseDespesas = 12000 * factor;
  
  const baseAtivoCirculante = 15000 * factor;
  const baseAtivoNaoCirculante = 35000 * factor;
  const basePassivoCirculante = 10000 * factor;
  const basePassivoNaoCirculante = 15000 * factor;
  const basePL = 25000 * factor;

  const monthFactor = viewMode === "mensal" ? 1 / 12 : 1;

  const bp: ProcessedBP = {
    ativoCirculante: {
      "Disponibilidades": 3000 * factor,
      "Aplicações Financeiras": 5000 * factor,
      "Contas a Receber": 4500 * factor,
      "Estoques": 1500 * factor,
      "Outros Ativos Circulantes": 1000 * factor,
      "TOTAL_ATIVO_CIRCULANTE": baseAtivoCirculante,
    },
    ativoNaoCirculante: {
      "Realizável a Longo Prazo": 5000 * factor,
      "Investimentos": 8000 * factor,
      "Imobilizado": 20000 * factor,
      "Intangível": 2000 * factor,
      "TOTAL_ATIVO_NAO_CIRCULANTE": baseAtivoNaoCirculante,
    },
    passivoCirculante: {
      "Fornecedores": 3000 * factor,
      "Obrigações Trabalhistas": 2500 * factor,
      "Obrigações Fiscais": 2000 * factor,
      "Empréstimos CP": 2500 * factor,
      "TOTAL_PASSIVO_CIRCULANTE": basePassivoCirculante,
    },
    passivoNaoCirculante: {
      "Empréstimos LP": 12000 * factor,
      "Provisões": 3000 * factor,
      "TOTAL_PASSIVO_NAO_CIRCULANTE": basePassivoNaoCirculante,
    },
    patrimonioLiquido: {
      "Capital Social": 15000 * factor,
      "Reservas": 5000 * factor,
      "Lucros Acumulados": 5000 * factor,
      "TOTAL_PATRIMONIO_LIQUIDO": basePL,
    },
    totalAtivo: baseAtivoCirculante + baseAtivoNaoCirculante,
    totalPassivo: basePassivoCirculante + basePassivoNaoCirculante + basePL,
  };

  const dre: ProcessedDRE = {
    receitas: {
      "Receitas de Competições": 18000 * factor * monthFactor,
      "Patrocínios": 12000 * factor * monthFactor,
      "Direitos de Transmissão": 10000 * factor * monthFactor,
      "Outras Receitas": 5000 * factor * monthFactor,
    },
    custos: {
      "Arbitragem": 8000 * factor * monthFactor,
      "Premiações": 7000 * factor * monthFactor,
      "Infraestrutura": 5000 * factor * monthFactor,
      "Outros Custos": 5000 * factor * monthFactor,
    },
    despesas: {
      "Despesas Administrativas": 6000 * factor * monthFactor,
      "Despesas com Pessoal": 4000 * factor * monthFactor,
      "Despesas Financeiras": 2000 * factor * monthFactor,
    },
    resultados: {
      totalReceitas: baseReceitas * monthFactor,
      totalCustos: baseCustos * monthFactor,
      resultadoBruto: (baseReceitas - baseCustos) * monthFactor,
      totalDespesas: baseDespesas * monthFactor,
      resultadoOperacional: (baseReceitas - baseCustos - baseDespesas) * monthFactor,
      resultadoLiquido: (baseReceitas - baseCustos - baseDespesas) * monthFactor,
    },
    total: (baseReceitas - baseCustos - baseDespesas) * monthFactor,
  };

  const indices: FinancialIndices = {
    liquidez: {
      corrente: Number((baseAtivoCirculante / basePassivoCirculante).toFixed(2)),
      seca: Number(((baseAtivoCirculante - 1500 * factor) / basePassivoCirculante).toFixed(2)),
      imediata: Number((3000 * factor / basePassivoCirculante).toFixed(2)),
      geral: Number((baseAtivoCirculante / (basePassivoCirculante + basePassivoNaoCirculante)).toFixed(2)),
    },
    rentabilidade: {
      margemBruta: Number((((baseReceitas - baseCustos) / baseReceitas) * 100).toFixed(2)),
      margemOperacional: Number((((baseReceitas - baseCustos - baseDespesas) / baseReceitas) * 100).toFixed(2)),
      margemLiquida: Number((((baseReceitas - baseCustos - baseDespesas) / baseReceitas) * 100).toFixed(2)),
      margemEbitda: Number((((baseReceitas - baseCustos - baseDespesas * 0.8) / baseReceitas) * 100).toFixed(2)),
      roa: Number((((baseReceitas - baseCustos - baseDespesas) / (baseAtivoCirculante + baseAtivoNaoCirculante)) * 100).toFixed(2)),
      roe: Number((((baseReceitas - baseCustos - baseDespesas) / basePL) * 100).toFixed(2)),
    },
    endividamento: {
      endividamentoGeral: Number((((basePassivoCirculante + basePassivoNaoCirculante) / (baseAtivoCirculante + baseAtivoNaoCirculante)) * 100).toFixed(2)),
      composicaoEndividamento: Number(((basePassivoCirculante / (basePassivoCirculante + basePassivoNaoCirculante)) * 100).toFixed(2)),
      grauAlavancagem: Number(((basePassivoCirculante + basePassivoNaoCirculante) / basePL).toFixed(2)),
      imobilizacaoPL: Number(((20000 * factor / basePL) * 100).toFixed(2)),
    },
    atividade: {
      giroAtivo: Number((baseReceitas / (baseAtivoCirculante + baseAtivoNaoCirculante)).toFixed(2)),
      prazoMedioRecebimento: Math.round((4500 * factor * 360) / baseReceitas),
      prazoMedioPagamento: Math.round((3000 * factor * 360) / baseCustos),
    },
  };

  if (viewMode === "mensal") {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthIndex = parseInt(month) - 1;
    const monthName = months[monthIndex] || "DEZ";
    const yearShort = year.slice(-2);
    
    return {
      bp,
      dre,
      indices,
      period: `${monthName}/${yearShort}`,
    };
  }

  // Gera dados mensais para visão anual
  const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  const yearShort = year.slice(-2);
  const monthlyIndices = months.map((m, i) => {
    const monthFactor = 0.9 + (i * 0.02); // Simula crescimento ao longo do ano
    return {
      period: `${m}/${yearShort}`,
      indices: {
        liquidez: {
          corrente: Number((indices.liquidez.corrente * monthFactor).toFixed(2)),
          seca: Number((indices.liquidez.seca * monthFactor).toFixed(2)),
          imediata: Number((indices.liquidez.imediata * monthFactor).toFixed(2)),
          geral: Number((indices.liquidez.geral * monthFactor).toFixed(2)),
        },
        rentabilidade: {
          margemBruta: Number((indices.rentabilidade.margemBruta * monthFactor).toFixed(2)),
          margemOperacional: Number((indices.rentabilidade.margemOperacional * monthFactor).toFixed(2)),
          margemLiquida: Number((indices.rentabilidade.margemLiquida * monthFactor).toFixed(2)),
          margemEbitda: Number((indices.rentabilidade.margemEbitda * monthFactor).toFixed(2)),
          roa: Number((indices.rentabilidade.roa * monthFactor).toFixed(2)),
          roe: Number((indices.rentabilidade.roe * monthFactor).toFixed(2)),
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
  };
}
