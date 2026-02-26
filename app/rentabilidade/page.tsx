'use client';

import { motion } from 'framer-motion';
import { TrendingUp, Info } from 'lucide-react';
import { indicesFinanceiros, anos, formatPercent, formatCurrency } from '@/lib/data';
import IndicatorCard from '@/components/indicator-card';
import CustomLineChart from '@/components/charts/line-chart';
import CustomBarChart from '@/components/charts/bar-chart';

const rentabilidadeDescriptions: Record<string, string> = {
  'Margem Bruta (%)': 'Percentual da receita que sobra apos custos diretos',
  'Margem Operacional (%)': 'Percentual da receita que sobra apos custos e despesas operacionais',
  'Margem Liquida (%)': 'Percentual da receita que se converte em lucro liquido',
  'ROA (%)': 'Retorno sobre os ativos totais da organizacao',
  'ROE (%)': 'Retorno sobre o patrimonio liquido investido',
  'Margem EBITDA (%)': 'Margem antes de juros, impostos, depreciacao e amortizacao'
};

export default function RentabilidadePage() {
  const margens = ['Margem Bruta (%)', 'Margem Operacional (%)', 'Margem Liquida (%)'];
  const retornos = ['ROA (%)', 'ROE (%)'];
  
  const margensData = anos.map(ano => {
    const data: any = { name: ano };
    margens.forEach(m => {
      data[m.replace(' (%)', '')] = indicesFinanceiros?.[ano]?.Rentabilidade?.[m] ?? 0;
    });
    return data;
  });

  const retornosData = anos.map(ano => {
    const data: any = { name: ano };
    retornos.forEach(r => {
      data[r.replace(' (%)', '')] = indicesFinanceiros?.[ano]?.Rentabilidade?.[r] ?? 0;
    });
    return data;
  });

  const ebitdaData = anos.map(ano => ({
    name: ano,
    EBITDA: indicesFinanceiros?.[ano]?.Rentabilidade?.EBITDA ?? 0
  }));

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <TrendingUp className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Indices de Rentabilidade</h1>
        </div>
        <p className="text-green-100">Capacidade de gerar lucro e retorno sobre investimentos</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...margens, ...retornos, 'Margem EBITDA (%)'].map((idx, i) => (
          <IndicatorCard
            key={idx}
            title={idx}
            values={anos.map(ano => ({
              year: ano,
              value: indicesFinanceiros?.[ano]?.Rentabilidade?.[idx] ?? 0
            }))}
            format="percent"
            description={rentabilidadeDescriptions[idx]}
            delay={i * 0.1}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">Evolucao das Margens</h2>
          <CustomLineChart
            data={margensData}
            lines={[
              { dataKey: 'Margem Bruta', color: '#60B5FF', name: 'Bruta' },
              { dataKey: 'Margem Operacional', color: '#FF9149', name: 'Operacional' },
              { dataKey: 'Margem Liquida', color: '#80D8C3', name: 'Liquida' }
            ]}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">ROA vs ROE</h2>
          <CustomLineChart
            data={retornosData}
            lines={[
              { dataKey: 'ROA', color: '#A19AD3', name: 'ROA' },
              { dataKey: 'ROE', color: '#72BF78', name: 'ROE' }
            ]}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">EBITDA por Ano (R$ mil)</h2>
        <CustomBarChart
          data={ebitdaData}
          bars={[{ dataKey: 'EBITDA', color: '#60B5FF', name: 'EBITDA' }]}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-emerald-50 border border-emerald-200 rounded-xl p-6"
      >
        <h3 className="font-semibold text-emerald-900 mb-3">Análise de Tendência</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-emerald-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">Margem Líquida</p>
            <p className="text-lg font-bold text-emerald-700">Estável em 8.33%</p>
            <p className="text-xs text-gray-600 mt-1">Margem mantida nos 3 anos</p>
          </div>
          <div className="bg-emerald-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">ROE</p>
            <p className="text-lg font-bold text-emerald-700">Crescimento de 9.4%</p>
            <p className="text-xs text-gray-600 mt-1">De 7.84% para 8.58%</p>
          </div>
          <div className="bg-emerald-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">EBITDA</p>
            <p className="text-lg font-bold text-emerald-700">+15% no período</p>
            <p className="text-xs text-gray-600 mt-1">R$ 3.1M para R$ 3.6M</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
