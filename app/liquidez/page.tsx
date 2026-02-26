'use client';

import { motion } from 'framer-motion';
import { Droplets, Info } from 'lucide-react';
import { indicesFinanceiros, anos } from '@/lib/data';
import IndicatorCard from '@/components/indicator-card';
import CustomLineChart from '@/components/charts/line-chart';

const liquidezDescriptions: Record<string, string> = {
  'Liquidez Corrente': 'Capacidade de pagar dividas de curto prazo com ativos circulantes. Ideal: > 1.5',
  'Liquidez Seca': 'Similar a corrente, mas exclui estoques. Ideal: > 1.0',
  'Liquidez Imediata': 'Capacidade de pagar dividas imediatamente com caixa. Ideal: > 0.5'
};

const liquidezBenchmarks: Record<string, { min: number; max: number }> = {
  'Liquidez Corrente': { min: 1.5, max: 2.0 },
  'Liquidez Seca': { min: 1.0, max: 1.5 },
  'Liquidez Imediata': { min: 0.5, max: 1.0 }
};

export default function LiquidezPage() {
  const indices = ['Liquidez Corrente', 'Liquidez Seca', 'Liquidez Imediata'];
  
  const chartData = anos.map(ano => {
    const data: any = { name: ano };
    indices.forEach(idx => {
      data[idx] = indicesFinanceiros?.[ano]?.Liquidez?.[idx] ?? 0;
    });
    return data;
  });

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-cyan-600 to-cyan-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <Droplets className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Indices de Liquidez</h1>
        </div>
        <p className="text-cyan-100">Capacidade de pagamento das obrigacoes de curto prazo</p>
      </motion.div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">Como interpretar:</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li><strong>Verde:</strong> Indice acima do ideal - situacao confortavel</li>
            <li><strong>Amarelo:</strong> Indice dentro da faixa aceitavel</li>
            <li><strong>Vermelho:</strong> Indice abaixo do minimo - atencao necessaria</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indices.map((idx, i) => (
          <IndicatorCard
            key={idx}
            title={idx}
            values={anos.map(ano => ({
              year: ano,
              value: indicesFinanceiros?.[ano]?.Liquidez?.[idx] ?? 0
            }))}
            format="number"
            benchmark={liquidezBenchmarks[idx]}
            description={liquidezDescriptions[idx]}
            delay={i * 0.1}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">Evolucao dos Indices de Liquidez</h2>
        <CustomLineChart
          data={chartData}
          lines={[
            { dataKey: 'Liquidez Corrente', color: '#60B5FF', name: 'Corrente' },
            { dataKey: 'Liquidez Seca', color: '#FF9149', name: 'Seca' },
            { dataKey: 'Liquidez Imediata', color: '#80D8C3', name: 'Imediata' }
          ]}
        />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {indices.map((idx, i) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="bg-white rounded-xl shadow-lg p-5"
          >
            <h3 className="font-semibold text-slate-800 mb-2">{idx}</h3>
            <p className="text-sm text-slate-600 mb-3">{liquidezDescriptions[idx]}</p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Formula:</span>
                <span className="text-slate-700 font-medium">
                  {idx === 'Liquidez Corrente' && 'AC / PC'}
                  {idx === 'Liquidez Seca' && '(AC - Estoques) / PC'}
                  {idx === 'Liquidez Imediata' && 'Disponivel / PC'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Referencia:</span>
                <span className="text-emerald-600 font-medium">
                  {'>'}  {liquidezBenchmarks[idx]?.max ?? 1}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
