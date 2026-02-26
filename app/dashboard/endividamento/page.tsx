'use client';

import { motion } from 'framer-motion';
import { Percent, Info, AlertCircle } from 'lucide-react';
import IndicatorCard from '@/components/indicator-card';
import CustomLineChart from '@/components/charts/line-chart';
import CustomPieChart from '@/components/charts/pie-chart';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useDashboard } from '@/lib/contexts/DashboardContext';

const endividamentoDescriptions: Record<string, string> = {
  'Endividamento Geral': 'Proporção de capital de terceiros em relação ao ativo total. Ideal: < 60%',
  'Composição do Endividamento': 'Percentual da dívida que vence no curto prazo. Ideal: < 50%',
  'Grau de Alavancagem': 'Relação entre capital de terceiros e capital próprio. Ideal: < 1.5',
  'Imobilização do PL': 'Quanto do patrimônio líquido está investido em ativos fixos. Ideal: < 80%'
};

const endividamentoBenchmarks: Record<string, { min: number; max: number }> = {
  'Endividamento Geral': { min: 40, max: 60 },
  'Composição do Endividamento': { min: 30, max: 50 },
  'Grau de Alavancagem': { min: 0.5, max: 1.5 },
  'Imobilização do PL': { min: 50, max: 80 }
};

export default function EndividamentoPage() {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando índices de endividamento...</p>
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
  const bp = data.bp;
  
  const endividamentoData = indices?.endividamento ? [
    { key: 'Endividamento Geral', value: indices.endividamento.endividamentoGeral, type: 'percent' as const },
    { key: 'Composição do Endividamento', value: indices.endividamento.composicaoEndividamento, type: 'percent' as const },
    { key: 'Grau de Alavancagem', value: indices.endividamento.grauAlavancagem, type: 'number' as const },
    { key: 'Imobilização do PL', value: indices.endividamento.imobilizacaoPL, type: 'percent' as const },
  ] : [];

  // Dados para gráfico de evolução mensal (se disponível)
  const chartData = data.months 
    ? data.months.map((m) => ({
        name: m.period,
        'Endividamento Geral': m.indices?.endividamento?.endividamentoGeral || 0,
        'Alavancagem': m.indices?.endividamento?.grauAlavancagem || 0,
      }))
    : [{
        name: periodLabel,
        'Endividamento Geral': indices?.endividamento?.endividamentoGeral || 0,
        'Alavancagem': indices?.endividamento?.grauAlavancagem || 0,
      }];

  // Estrutura de capital para pie chart
  const passivoCirculante = bp?.passivoCirculante?.['TOTAL_PASSIVO_CIRCULANTE'] || 0;
  const passivoNaoCirculante = bp?.passivoNaoCirculante?.['TOTAL_PASSIVO_NAO_CIRCULANTE'] || 0;
  const patrimonioLiquido = bp?.patrimonioLiquido?.['TOTAL_PATRIMONIO_LIQUIDO'] || 0;

  const estruturaCapitalData = [
    { name: 'Passivo Circulante', value: passivoCirculante },
    { name: 'Passivo Não Circulante', value: passivoNaoCirculante },
    { name: 'Patrimônio Líquido', value: patrimonioLiquido },
  ];

  const estruturaCapitalColors = ['#EF4444', '#F97316', '#22C55E'];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <Percent className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Índices de Endividamento</h1>
        </div>
        <p className="text-orange-100">Estrutura de capital e nível de endividamento - {periodLabel}</p>
        {source === 'demonstration' && (
          <p className="text-orange-200 text-sm mt-2">
            <Info className="w-4 h-4 inline mr-1" />
            {message || "Dados de demonstração"}
          </p>
        )}
      </motion.div>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-orange-800">
          <p className="font-semibold mb-1">Interpretação do Endividamento:</p>
          <p className="text-orange-700">
            Níveis moderados de endividamento podem ser saudáveis para alavancagem, 
            mas excessos aumentam o risco financeiro. A composição entre curto e longo prazo 
            é tão importante quanto o nível total.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {endividamentoData.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <IndicatorCard
              title={item.key}
              values={{ [periodLabel]: item.value }}
              benchmark={endividamentoBenchmarks[item.key]}
              description={endividamentoDescriptions[item.key]}
              type={item.type}
              invertColors={item.key !== 'Grau de Alavancagem'}
            />
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {viewMode === 'anual' && chartData.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-lg p-6"
          >
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Evolução do Endividamento</h2>
            <CustomLineChart
              data={chartData}
              lines={[
                { dataKey: 'Endividamento Geral', color: '#EF4444', name: 'Endivid. Geral (%)' },
                { dataKey: 'Alavancagem', color: '#F97316', name: 'Alavancagem' },
              ]}
            />
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Estrutura de Capital - {periodLabel}</h2>
          <CustomPieChart data={estruturaCapitalData} colors={estruturaCapitalColors} showLabels />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Endividamento Geral</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> (Passivo Circulante + Passivo Não Circulante) / Ativo Total
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Mede a proporção dos ativos financiados por capital de terceiros.
            Um índice de {indices?.endividamento?.endividamentoGeral?.toFixed(1)}% indica que 
            {indices?.endividamento?.endividamentoGeral?.toFixed(1)}% dos ativos são financiados por dívidas.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Grau de Alavancagem</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> Passivo Total / Patrimônio Líquido
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Relaciona o capital de terceiros com o capital próprio.
            Um grau de {indices?.endividamento?.grauAlavancagem?.toFixed(2)} significa que para cada 
            R$ 1 de capital próprio, há R$ {indices?.endividamento?.grauAlavancagem?.toFixed(2)} de dívidas.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
