"use client";

import { motion } from "framer-motion";
import KPICard from "@/components/kpi-card";
import AlertCard from "@/components/alert-card";
import CustomLineChart from "@/components/charts/line-chart";
import CustomPieChart from "@/components/charts/pie-chart";
import { DollarSign, TrendingUp, PiggyBank, Wallet, AlertCircle, Info, Building2 } from "lucide-react";
import { useFinancialData, useFinancialFormatters } from "@/hooks/useFinancialData";
import { useDashboard } from "@/lib/contexts/DashboardContext";

// Helper: busca valor por código na árvore de ContaComValor
function buscarValorEstrutura(contas: any[], codigo: string): number | null {
  for (const c of contas) {
    if (c.codigo === codigo) return c.valor !== 0 ? c.valor : null;
    if (c.children?.length) {
      const v = buscarValorEstrutura(c.children, codigo);
      if (v !== null) return v;
    }
  }
  return null;
}

export default function DashboardPage() {
  const { data, loading, error, source, message } = useFinancialData();
  const { formatCurrency } = useFinancialFormatters();
  const { viewMode, selectedYear, selectedMonth, availableMonths } = useDashboard();

  const getMonthName = (monthValue: string) => {
    const month = availableMonths.find((m) => m.value === monthValue);
    return month?.label || monthValue;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center bg-red-50 p-6 rounded-lg">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Extrai dados do resultado
  const dre = data.dre;
  const bp = data.bp;
  const indices = data.indices;
  
  // Dados da estrutura de-para (quando disponíveis, são mais precisos)
  const estruturaDRE = (data as any).estruturaDRE as any[] | undefined;
  const estruturaBP = (data as any).estruturaBP as any[] | undefined;
  const resultadoDREVal = (data as any).resultadoDRE as number | undefined;

  // ═══ KPIs: prioriza estrutura de-para, fallback para formato flat ═══
  let receitaTotal = 0;
  let resultadoLiquido = 0;
  let ativoTotal = 0;
  let passivoTotal = 0;
  let patrimonioLiquido = 0;

  if (estruturaDRE && estruturaDRE.length > 0) {
    // Fonte primária: estrutura de-para (códigos da estrutura padrão)
    receitaTotal = buscarValorEstrutura(estruturaDRE, '1') || buscarValorEstrutura(estruturaDRE, '51') || 0;
    resultadoLiquido = resultadoDREVal ?? (buscarValorEstrutura(estruturaDRE, '225') || buscarValorEstrutura(estruturaDRE, '229') || buscarValorEstrutura(estruturaDRE, '210') || 0);
  } else if (dre?.resultados) {
    // Fallback: formato flat antigo
    receitaTotal = dre.resultados.totalReceitas || 0;
    resultadoLiquido = dre.resultados.resultadoLiquido || 0;
  }

  if (estruturaBP && estruturaBP.length > 0) {
    ativoTotal = buscarValorEstrutura(estruturaBP, '1') || 0;
    const passivoCirculante = buscarValorEstrutura(estruturaBP, '77') || 0;
    const passivoNaoCirculante = buscarValorEstrutura(estruturaBP, '113') || 0;
    passivoTotal = passivoCirculante + passivoNaoCirculante;
    patrimonioLiquido = buscarValorEstrutura(estruturaBP, '125') || 0;
  } else if (bp) {
    ativoTotal = bp.totalAtivo || 0;
    const passivoCirculante = bp.passivoCirculante?.["TOTAL_PASSIVO_CIRCULANTE"] || 0;
    const passivoNaoCirculante = bp.passivoNaoCirculante?.["TOTAL_PASSIVO_NAO_CIRCULANTE"] || 0;
    passivoTotal = passivoCirculante + passivoNaoCirculante;
    patrimonioLiquido = bp.patrimonioLiquido?.["TOTAL_PATRIMONIO_LIQUIDO"] || 0;
  }

  // Composição até o 2º nível da DRE (com fallback flat)
  const receitasEstruturaData = montarComposicaoNivel2(estruturaDRE, ["51", "56", "1"]);
  const custosEstruturaData = montarComposicaoNivel2(estruturaDRE, ["57", "52"]);
  const despesasEstruturaData = montarComposicaoNivel2(estruturaDRE, ["110", "104"]);

  const receitasFlatData = dre?.receitas
    ? Object.entries(dre.receitas).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value: Math.abs(value as number),
      }))
    : [];

  const custosFlatData = dre?.custos
    ? Object.entries(dre.custos).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value: Math.abs(value as number),
      }))
    : [];

  const despesasFlatData = dre?.despesas
    ? Object.entries(dre.despesas).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value: Math.abs(value as number),
      }))
    : [];

  const receitasData = receitasEstruturaData.length > 0 ? receitasEstruturaData : receitasFlatData;
  const custosData = custosEstruturaData.length > 0 ? custosEstruturaData : custosFlatData;
  const despesasData = despesasEstruturaData.length > 0 ? despesasEstruturaData : despesasFlatData;

  const receitasColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
  const custosColors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#6366F1"];
  const despesasColors = ["#F43F5E", "#FB7185", "#E11D48", "#BE123C", "#9F1239"];

  // Dados para gráfico de evolução
  const lineChartData = data.months
    ? data.months.map((m) => ({
        name: m.period,
        liquidez: m.indices?.liquidez?.corrente || 0,
        rentabilidade: m.indices?.rentabilidade?.margemLiquida || 0,
      }))
    : [{ name: selectedYear, liquidez: indices?.liquidez?.corrente || 0, rentabilidade: indices?.rentabilidade?.margemLiquida || 0 }];

  // Alertas baseados nos índices
  const alertas: Array<{tipo: string; categoria: string; descricao: string; valor: number; recomendacao: string}> = [];
  if (indices) {
    if (indices.liquidez.corrente < 1) {
      alertas.push({ tipo: "atencao", categoria: "Liquidez", descricao: "Liquidez corrente abaixo de 1", valor: indices.liquidez.corrente, recomendacao: "Avaliar necessidade de capital de giro" });
    }
    if (indices.endividamento.endividamentoGeral > 70) {
      alertas.push({ tipo: "atencao", categoria: "Endividamento", descricao: "Endividamento geral elevado", valor: indices.endividamento.endividamentoGeral, recomendacao: "Considerar redução de dívidas" });
    }
    if (indices.rentabilidade.roe > 15) {
      alertas.push({ tipo: "positivo", categoria: "Rentabilidade", descricao: "ROE acima da média do mercado", valor: indices.rentabilidade.roe, recomendacao: "Manter estratégia atual" });
    }
    if (indices.rentabilidade.margemLiquida > 10) {
      alertas.push({ tipo: "oportunidade", categoria: "Margem", descricao: "Margem líquida saudável", valor: indices.rentabilidade.margemLiquida, recomendacao: "Considerar expansão de operações" });
    }
  }

  const periodLabel = viewMode === "mensal" 
    ? `${getMonthName(selectedMonth)}/${selectedYear}` 
    : selectedYear;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-gray-800">Resumo Executivo</h1>
        <p className="text-gray-500 mt-1">
          Visão {viewMode === "mensal" ? "mensal" : "anual"} dos indicadores financeiros - {periodLabel}
        </p>
        {source === "demonstration" && (
          <div className="mt-2 flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-sm">
            <Info className="w-4 h-4" />
            <span>{message || "Exibindo dados de demonstração. Faça upload de balancetes para ver dados reais."}</span>
          </div>
        )}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <KPICard title="Receita Total" value={formatCurrency(receitaTotal)} change={0} icon={DollarSign} color="blue" />
        <KPICard title="Resultado Líquido" value={formatCurrency(resultadoLiquido)} change={0} icon={TrendingUp} color={resultadoLiquido >= 0 ? "green" : "red"} />
        <KPICard title="Ativo Total" value={formatCurrency(ativoTotal)} change={0} icon={PiggyBank} color="purple" />
        <KPICard title="Passivo Total" value={formatCurrency(passivoTotal)} change={0} icon={Building2} color="red" />
        <KPICard title="Patrimônio Líquido" value={formatCurrency(patrimonioLiquido)} change={0} icon={Wallet} color="orange" />
      </div>

      {/* Key Indices Summary */}
      {indices && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Principais Índices - {periodLabel}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Liquidez Corrente</p>
              <p className="text-2xl font-bold text-blue-600">{indices.liquidez.corrente.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Margem Líquida</p>
              <p className="text-2xl font-bold text-green-600">{indices.rentabilidade.margemLiquida.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">ROE</p>
              <p className="text-2xl font-bold text-purple-600">{indices.rentabilidade.roe.toFixed(1)}%</p>
            </div>
            <div className="bg-white p-4 rounded-lg">
              <p className="text-sm text-gray-500">Endividamento</p>
              <p className="text-2xl font-bold text-orange-600">{indices.endividamento.endividamentoGeral.toFixed(1)}%</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {viewMode === "anual" && lineChartData.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Evolução dos Índices ao Longo do Ano</h2>
            <CustomLineChart
              data={lineChartData}
              lines={[
                { dataKey: "liquidez", color: "#3B82F6", name: "Liquidez Corrente" },
                { dataKey: "rentabilidade", color: "#10B981", name: "Margem Líquida (%)" },
              ]}
            />
          </motion.div>
        )}

        {receitasData.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Composição das Receitas</h2>
            <CustomPieChart data={receitasData} colors={receitasColors} />
          </motion.div>
        )}
      </div>

      {/* Costs / Expenses Pie Charts */}
      {(custosData.length > 0 || despesasData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {custosData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
              className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Distribuição de Custos</h2>
              <div className="h-80">
                <CustomPieChart data={custosData} colors={custosColors} />
              </div>
            </motion.div>
          )}

          {despesasData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
              className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Distribuição de Despesas</h2>
              <div className="h-80">
                <CustomPieChart data={despesasData} colors={despesasColors} />
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Alerts */}
      {alertas.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Alertas e Recomendações</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {alertas.map((alerta, index) => (
              <AlertCard
                key={index}
                tipo={alerta.tipo}
                categoria={alerta.categoria}
                descricao={alerta.descricao}
                valor={alerta.valor}
                recomendacao={alerta.recomendacao}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function flattenEstrutura(contas: any[]): any[] {
  const result: any[] = [];
  const walk = (items: any[]) => {
    for (const item of items || []) {
      result.push(item);
      if (item.children?.length) {
        walk(item.children);
      }
    }
  };
  walk(contas || []);
  return result;
}

function montarComposicaoNivel2(
  estruturaDRE: any[] | undefined,
  rootCodes: string[],
): Array<{ name: string; value: number }> {
  if (!estruturaDRE || estruturaDRE.length === 0) return [];

  const flat = flattenEstrutura(estruturaDRE);
  const parentMap = new Map<string, string | null>();
  flat.forEach((conta) => {
    parentMap.set(conta.codigo, conta.codigoSuperior ?? null);
  });

  const isUnderRoot = (codigo: string): boolean => {
    let current = codigo;
    const visited = new Set<string>();

    while (current && !visited.has(current)) {
      if (rootCodes.includes(current)) return true;
      visited.add(current);
      current = parentMap.get(current) || '';
    }

    return false;
  };

  const usados = new Set<string>();
  return flat
    .filter((conta) => {
      const nivel = conta.nivelVisualizacao || conta.nivel || 0;
      return nivel === 2 && isUnderRoot(conta.codigo);
    })
    .filter((conta) => {
      if (usados.has(conta.codigo)) return false;
      usados.add(conta.codigo);
      return true;
    })
    .map((conta) => ({
      name: conta.descricao,
      value: Math.abs(Number(conta.valor || 0)),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}