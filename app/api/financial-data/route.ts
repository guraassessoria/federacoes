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
 * Inclui estruturaDRE para visão mensal funcionar corretamente
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
  estruturaDRE?: ContaComValor[];
  estruturaBP?: ContaComValor[];
  resultadoDRE?: number;
  totalPassivoPL?: number;
} {
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

  // ═══ ESTRUTURA DRE FICTÍCIA (formato sequencial) ═══
  // Segue a mesma estrutura que o mapBalanceteToDRE gera
  const gerarEstruturaDRE = (fatorMes: number): ContaComValor[] => {
    const v = (val: number) => Math.round(val * fatorMes);
    
    const conta = (codigo: string, descricao: string, valor: number, nivelVis: number, children?: ContaComValor[]): ContaComValor => ({
      codigo,
      descricao,
      codigoSuperior: null,
      nivel: 1,
      nivelVisualizacao: nivelVis,
      valor: v(valor),
      children: children || [],
    });

    return [
      // Receita Bruta (expandível)
      conta('51', 'Receita Bruta', receitaBruta, 1, [
        conta('51.1', 'Receitas de Competições', 18000000 * factor, 2),
        conta('51.2', 'Patrocínios e Publicidade', 12000000 * factor, 2),
        conta('51.3', 'Direitos de Transmissão', 10000000 * factor, 2),
        conta('51.4', 'Outras Receitas Operacionais', 5000000 * factor, 2),
      ]),
      // Receita Líquida (calculada, sem children)
      conta('56', 'Receita Líquida', receitaLiquida, 1),
      // Custos (expandível)
      conta('57', '(-) Custos dos Serviços', custos, 1, [
        conta('57.1', 'Custos com Arbitragem', 8000000 * factor, 2),
        conta('57.2', 'Premiações', 7000000 * factor, 2),
        conta('57.3', 'Infraestrutura Esportiva', 5000000 * factor, 2),
        conta('57.4', 'Outros Custos', 5000000 * factor, 2),
      ]),
      // Margem Bruta (calculada)
      conta('109', 'Margem Bruta', margemBruta, 1),
      // Despesas (expandível)
      conta('110', '(-) Despesas Gerais', despesasGerais, 1, [
        conta('110.1', 'Despesas Administrativas', 5000000 * factor, 2),
        conta('110.2', 'Despesas com Pessoal', 3000000 * factor, 2),
        conta('110.3', 'Despesas Comerciais e Marketing', 2000000 * factor, 2),
      ]),
      // Resultado Operacional (calculado)
      conta('196', 'Resultado Operacional', resultadoOperacional, 1),
      // Lucro Antes do Resultado Financeiro (calculado)
      conta('197', 'Lucro Antes do Resultado Financeiro', resultadoOperacional, 1),
      // Resultado Financeiro (expandível, indentado)
      { ...conta('198', '(+/-) Resultado Financeiro', resultadoFinanceiro, 2, [
        conta('198.1', 'Receitas Financeiras', 500000 * factor, 3),
        conta('198.2', '(-) Despesas Financeiras', -2500000 * factor, 3),
      ]) },
      // Lucro Líquido Antes dos Impostos
      conta('227', 'Lucro Líquido Antes dos Impostos', lucroAntesIR, 1),
      // Superávit/Déficit
      conta('229', 'Superávit/Déficit do Exercício', resultadoLiquido, 1),
    ];
  };

  const estruturaDRE = gerarEstruturaDRE(mFactor);

  if (viewMode === "mensal") {
    const months = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
    const monthName = months[monthIndex] || "DEZ";
    const yearShort = year.slice(-2);
    
    return {
      bp,
      dre,
      indices,
      period: `${monthName}/${yearShort}`,
      estruturaDRE,
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
    estruturaDRE: gerarEstruturaDRE(1), // Anual: fator 1
    resultadoDRE: resultadoLiquido,
    totalPassivoPL: totalPassivos + totalPL,
  };
}