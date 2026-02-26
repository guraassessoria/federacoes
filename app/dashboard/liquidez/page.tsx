'use client';

import { motion } from 'framer-motion';
import { Droplets, Info, AlertCircle } from 'lucide-react';
import IndicatorCard from '@/components/indicator-card';
import CustomLineChart from '@/components/charts/line-chart';
import { useFinancialData } from '@/hooks/useFinancialData';
import { useDashboard } from '@/lib/contexts/DashboardContext';

const liquidezDescriptions: Record<string, string> = {
  'Liquidez Corrente': 'Capacidade de pagar dívidas de curto prazo com ativos circulantes. Ideal: > 1.5',
  'Liquidez Seca': 'Similar à corrente, mas exclui estoques. Ideal: > 1.0',
  'Liquidez Imediata': 'Capacidade de pagar dívidas imediatamente com caixa. Ideal: > 0.5',
  'Liquidez Geral': 'Capacidade de honrar todas as obrigações com todos os ativos realizáveis. Ideal: > 1.0'
};

const liquidezBenchmarks: Record<string, { min: number; max: number }> = {
  'Liquidez Corrente': { min: 1.5, max: 2.0 },
  'Liquidez Seca': { min: 1.0, max: 1.5 },
  'Liquidez Imediata': { min: 0.5, max: 1.0 },
  'Liquidez Geral': { min: 1.0, max: 1.5 }
};

export default function LiquidezPage() {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando índices de liquidez...</p>
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
  
  const liquidezData = indices?.liquidez ? [
    { key: 'Liquidez Corrente', value: indices.liquidez.corrente },
    { key: 'Liquidez Seca', value: indices.liquidez.seca },
    { key: 'Liquidez Imediata', value: indices.liquidez.imediata },
    { key: 'Liquidez Geral', value: indices.liquidez.geral },
  ] : [];

  // Dados para gráfico de evolução mensal (se disponível)
  const chartData = data.months 
    ? data.months.map((m) => ({
        name: m.period,
        'Liquidez Corrente': m.indices?.liquidez?.corrente || 0,
        'Liquidez Seca': m.indices?.liquidez?.seca || 0,
        'Liquidez Imediata': m.indices?.liquidez?.imediata || 0,
      }))
    : [{
        name: periodLabel,
        'Liquidez Corrente': indices?.liquidez?.corrente || 0,
        'Liquidez Seca': indices?.liquidez?.seca || 0,
        'Liquidez Imediata': indices?.liquidez?.imediata || 0,
      }];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <Droplets className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Índices de Liquidez</h1>
        </div>
        <p className="text-cyan-100">Capacidade de pagamento das obrigações de curto prazo - {periodLabel}</p>
        {source === 'demonstration' && (
          <p className="text-cyan-200 text-sm mt-2">
            <Info className="w-4 h-4 inline mr-1" />
            {message || "Dados de demonstração"}
          </p>
        )}
      </motion.div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Como interpretar:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li><span className="text-green-600 font-medium">Verde</span>: Índice dentro ou acima da faixa ideal</li>
            <li><span className="text-yellow-600 font-medium">Amarelo</span>: Índice abaixo do ideal, requer atenção</li>
            <li><span className="text-red-600 font-medium">Vermelho</span>: Índice crítico, ação imediata necessária</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {liquidezData.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <IndicatorCard
              title={item.key}
              values={{ [periodLabel]: item.value }}
              benchmark={liquidezBenchmarks[item.key]}
              description={liquidezDescriptions[item.key]}
              type="number"
            />
          </motion.div>
        ))}
      </div>

      {viewMode === 'anual' && chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Evolução dos Índices de Liquidez</h2>
          <CustomLineChart
            data={chartData}
            lines={[
              { dataKey: 'Liquidez Corrente', color: '#0891B2', name: 'Corrente' },
              { dataKey: 'Liquidez Seca', color: '#0D9488', name: 'Seca' },
              { dataKey: 'Liquidez Imediata', color: '#0EA5E9', name: 'Imediata' },
            ]}
          />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
      >
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Liquidez Corrente</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> Ativo Circulante / Passivo Circulante
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Mede a capacidade da organização de pagar suas dívidas de curto prazo utilizando seus ativos circulantes. 
            Um índice acima de 1 indica que a empresa possui mais ativos do que passivos de curto prazo.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Liquidez Seca</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> (Ativo Circulante - Estoques) / Passivo Circulante
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Similar à liquidez corrente, mas exclui os estoques, que podem ser de difícil conversão em dinheiro. 
            É uma medida mais conservadora da capacidade de pagamento.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Liquidez Imediata</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> Disponibilidades / Passivo Circulante
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Mede a capacidade de pagar dívidas de curto prazo utilizando apenas o dinheiro disponível em caixa 
            e aplicações de liquidez imediata.
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="font-semibold text-gray-800 mb-3">Liquidez Geral</h3>
          <p className="text-gray-600 text-sm">
            <strong>Fórmula:</strong> (AC + RLP) / (PC + PNC)
          </p>
          <p className="text-gray-600 text-sm mt-2">
            Considera todos os ativos realizáveis (circulantes e de longo prazo) em relação a todas as obrigações. 
            Oferece uma visão mais ampla da capacidade de pagamento.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
