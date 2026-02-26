"use client";

import { motion } from "framer-motion";
import KPICard from "@/components/kpi-card";
import AlertCard from "@/components/alert-card";
import CustomLineChart from "@/components/charts/line-chart";
import CustomPieChart from "@/components/charts/pie-chart";
import { DollarSign, TrendingUp, PiggyBank, Wallet, AlertCircle, Info } from "lucide-react";
import { useFinancialData, useFinancialFormatters } from "@/hooks/useFinancialData";
import { useDashboard } from "@/lib/contexts/DashboardContext";

export default function DashboardPage() {
  const { data, loading, error, source, message } = useFinancialData();
  const { formatCurrency } = useFinancialFormatters();
  const { viewMode, selectedYear, selectedMonth, availableMonths } = useDashboard();

  const calcChange = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const getMonthName = (monthValue: string) => {
    const month = availableMonths.find((m) => m.value === monthValue);
    return month?.label || monthValue;
  };

  // Exibe loading
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

  // Exibe erro
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

  // KPIs principais
  const receitaTotal = dre?.resultados?.totalReceitas || 0;
  const resultadoLiquido = dre?.resultados?.resultadoLiquido || 0;
  const ativoTotal = bp?.totalAtivo || 0;
  const patrimonioLiquido = bp?.patrimonioLiquido?.["TOTAL_PATRIMONIO_LIQUIDO"] || 0;

  // Composição de receitas
  const receitasData = dre?.receitas
    ? Object.entries(dre.receitas).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value: value as number,
      }))
    : [];

  // Composição de custos
  const custosData = dre?.custos
    ? Object.entries(dre.custos).map(([name, value]) => ({
        name: name.replace(/_/g, " "),
        value: value as number,
      }))
    : [];

  const receitasColors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
  const custosColors = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#6366F1"];

  // Dados para gráfico de evolução (usando índices mensais quando disponível)
  const lineChartData = data.months
    ? data.months.map((m) => ({
        name: m.period,
        liquidez: m.indices?.liquidez?.corrente || 0,
        rentabilidade: m.indices?.rentabilidade?.margemLiquida || 0,
      }))
    : [{ name: selectedYear, liquidez: indices?.liquidez?.corrente || 0, rentabilidade: indices?.rentabilidade?.margemLiquida || 0 }];

  // Alertas baseados nos índices
  const alertas = [];
  if (indices) {
    if (indices.liquidez.corrente < 1) {
      alertas.push({
        tipo: "atencao",
        categoria: "Liquidez",
        descricao: "Liquidez corrente abaixo de 1",
        valor: indices.liquidez.corrente,
        recomendacao: "Avaliar necessidade de capital de giro",
      });
    }
    if (indices.endividamento.endividamentoGeral > 70) {
      alertas.push({
        tipo: "atencao",
        categoria: "Endividamento",
        descricao: "Endividamento geral elevado",
        valor: indices.endividamento.endividamentoGeral,
        recomendacao: "Considerar redução de dívidas",
      });
    }
    if (indices.rentabilidade.roe > 15) {
      alertas.push({
        tipo: "positivo",
        categoria: "Rentabilidade",
        descricao: "ROE acima da média do mercado",
        valor: indices.rentabilidade.roe,
        recomendacao: "Manter estratégia atual",
      });
    }
    if (indices.rentabilidade.margemLiquida > 10) {
      alertas.push({
        tipo: "oportunidade",
        categoria: "Margem",
        descricao: "Margem líquida saudável",
        valor: indices.rentabilidade.margemLiquida,
        recomendacao: "Considerar expansão de operações",
      });
    }
  }

  const periodLabel = viewMode === "mensal" 
    ? `${getMonthName(selectedMonth)}/${selectedYear}` 
    : selectedYear;

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Receita Total"
          value={formatCurrency(receitaTotal)}
          change={0}
          icon={DollarSign}
          color="blue"
        />
        <KPICard
          title="Resultado Líquido"
          value={formatCurrency(resultadoLiquido)}
          change={0}
          icon={TrendingUp}
          color={resultadoLiquido >= 0 ? "green" : "red"}
        />
        <KPICard
          title="Ativo Total"
          value={formatCurrency(ativoTotal)}
          change={0}
          icon={PiggyBank}
          color="purple"
        />
        <KPICard
          title="Patrimônio Líquido"
          value={formatCurrency(patrimonioLiquido)}
          change={0}
          icon={Wallet}
          color="orange"
        />
      </div>

      {/* Key Indices Summary */}
      {indices && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Principais Índices - {periodLabel}
          </h2>
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
        {/* Line Chart */}
        {viewMode === "anual" && lineChartData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Evolução dos Índices ao Longo do Ano
            </h2>
            <CustomLineChart
              data={lineChartData}
              lines={[
                { dataKey: "liquidez", color: "#3B82F6", name: "Liquidez Corrente" },
                { dataKey: "rentabilidade", color: "#10B981", name: "Margem Líquida (%)" },
              ]}
            />
          </motion.div>
        )}

        {/* Pie Chart Receitas */}
        {receitasData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Composição das Receitas
            </h2>
            <CustomPieChart data={receitasData} colors={receitasColors} />
          </motion.div>
        )}
      </div>

      {/* Costs Pie Chart */}
      {custosData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Distribuição de Custos
          </h2>
          <div className="h-80">
            <CustomPieChart data={custosData} colors={custosColors} />
          </div>
        </motion.div>
      )}

      {/* Alerts */}
      {alertas && alertas.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Alertas e Recomendações
          </h2>
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
