'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Info, AlertCircle } from 'lucide-react';
import IndicatorCard from '@/components/indicator-card';
import CustomLineChart from '@/components/charts/line-chart';
import CustomBarChart from '@/components/charts/bar-chart';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useDashboard } from '@/lib/contexts/DashboardContext';

const rentabilidadeDescriptions: Record<string, string> = {
  'Margem Bruta': 'Percentual da receita que sobra após deduzir custos diretos. Ideal: > 40%',
  'Margem Operacional': 'Eficiência operacional antes de despesas financeiras. Ideal: > 20%',
  'Margem Líquida': 'Lucro líquido em relação à receita total. Ideal: > 10%',
  'Margem EBITDA': 'Lucro antes de juros, impostos, depreciação e amortização. Ideal: > 25%',
  'ROA': 'Retorno sobre os ativos totais. Ideal: > 5%',
  'ROE': 'Retorno sobre o patrimônio líquido. Ideal: > 15%'
};

const rentabilidadeBenchmarks: Record<string, { min: number; max: number }> = {
  'Margem Bruta': { min: 40, max: 60 },
  'Margem Operacional': { min: 15, max: 30 },
  'Margem Líquida': { min: 10, max: 20 },
  'Margem EBITDA': { min: 20, max: 35 },
  'ROA': { min: 5, max: 15 },
  'ROE': { min: 12, max: 25 }
};

export default function RentabilidadePage() {
  const { data, loading, error, source, message } = useFinancialData();
  const { viewMode, selectedYear, selectedMonth, availableMonths } = useDashboard();
  
  const getMonthName = (monthValue: string) => {
    const month = availableMonths.find((m) => m.value === monthValue);
    return month?.label || monthValue;
  };

  const periodLabel = viewMode === "mensal" 
    ? `${getMonthName(selectedMonth)}/${selectedYear}` 
    : selectedYear;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando índices de rentabilidade...</p>
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

  const indices = data.indices;
  const indexAvailability = data.indexAvailability;
  
  const rentabilidadeData = indices?.rentabilidade ? [
    { key: 'Margem Bruta', value: indices.rentabilidade.margemBruta, unavailable: indexAvailability?.rentabilidade?.margemBruta === false },
    { key: 'Margem Operacional', value: indices.rentabilidade.margemOperacional, unavailable: indexAvailability?.rentabilidade?.margemOperacional === false },
    { key: 'Margem Líquida', value: indices.rentabilidade.margemLiquida, unavailable: indexAvailability?.rentabilidade?.margemLiquida === false },
    { key: 'Margem EBITDA', value: indices.rentabilidade.margemEbitda, unavailable: indexAvailability?.rentabilidade?.margemEbitda === false },
    { key: 'ROA', value: indices.rentabilidade.roa, unavailable: indexAvailability?.rentabilidade?.roa === false },
    { key: 'ROE', value: indices.rentabilidade.roe, unavailable: indexAvailability?.rentabilidade?.roe === false },
  ] : [];

  // Dados para gráfico de evolução mensal (se disponível)
  const chartDataMargens = data.months 
    ? data.months.map((m) => ({
        name: m.period,
        'Margem Bruta': m.indices?.rentabilidade?.margemBruta || 0,
        'Margem Operacional': m.indices?.rentabilidade?.margemOperacional || 0,
        'Margem Líquida': m.indices?.rentabilidade?.margemLiquida || 0,
      }))
    : [{
        name: periodLabel,
        'Margem Bruta': indices?.rentabilidade?.margemBruta || 0,
        'Margem Operacional': indices?.rentabilidade?.margemOperacional || 0,
        'Margem Líquida': indices?.rentabilidade?.margemLiquida || 0,
      }];

  const chartDataRetornos = data.months 
    ? data.months.map((m) => ({
        name: m.period,
        'ROA': m.indices?.rentabilidade?.roa || 0,
        'ROE': m.indices?.rentabilidade?.roe || 0,
      }))
    : [{
        name: periodLabel,
        'ROA': indices?.rentabilidade?.roa || 0,
        'ROE': indices?.rentabilidade?.roe || 0,
      }];

  const barChartData = rentabilidadeData.map(item => ({
    name: item.key,
    value: item.value
  }));

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-[#08C97D] to-[#07B670] rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Índices de Rentabilidade</h1>
        </div>
        <p className="text-emerald-100">Capacidade de gerar lucros e retornos - {periodLabel}</p>
        {source === 'demonstration' && (
          <p className="text-emerald-200 text-sm mt-2">
            <Info className="w-4 h-4 inline mr-1" />
            {message || "Dados de demonstração"}
          </p>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rentabilidadeData.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <IndicatorCard
              title={item.key}
              values={{ [periodLabel]: item.value }}
              benchmark={rentabilidadeBenchmarks[item.key]}
              description={rentabilidadeDescriptions[item.key]}
              type="percent"
              unavailable={item.unavailable}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {viewMode === 'anual' && chartDataMargens.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Evolução das Margens</h2>
            <CustomLineChart
              data={chartDataMargens}
              lines={[
                { dataKey: 'Margem Bruta', color: '#10B981', name: 'Bruta' },
                { dataKey: 'Margem Operacional', color: '#059669', name: 'Operacional' },
                { dataKey: 'Margem Líquida', color: '#047857', name: 'Líquida' },
              ]}
            />
          </motion.div>
        )}

        {viewMode === 'anual' && chartDataRetornos.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">ROA vs ROE</h2>
            <CustomLineChart
              data={chartDataRetornos}
              lines={[
                { dataKey: 'ROA', color: '#3B82F6', name: 'ROA' },
                { dataKey: 'ROE', color: '#8B5CF6', name: 'ROE' },
              ]}
            />
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Índices de Rentabilidade - {periodLabel}</h2>
        <CustomBarChart
          data={barChartData}
          bars={[{ dataKey: 'value', color: '#10B981', name: 'Valor (%)' }]}
          layout="vertical"
          showPercent
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6"
      >
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Análise de Tendência</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">Margens</h3>
            <p className="text-sm text-gray-600">
              A margem líquida de {indices?.rentabilidade?.margemLiquida?.toFixed(1)}% indica que 
              a cada R$ 100 de receita, R$ {indices?.rentabilidade?.margemLiquida?.toFixed(2)} são convertidos em lucro.
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">Retornos</h3>
            <p className="text-sm text-gray-600">
              ROE de {indices?.rentabilidade?.roe?.toFixed(1)}% significa que para cada R$ 100 investidos 
              pelos associados, há um retorno de R$ {indices?.rentabilidade?.roe?.toFixed(2)}.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
