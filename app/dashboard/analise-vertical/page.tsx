'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { analiseVertical } from '@/lib/data';
import CustomBarChart from '@/components/charts/bar-chart';
import { useDashboard } from '@/lib/contexts/DashboardContext';

export default function AnaliseVerticalPage() {
  const [activeTab, setActiveTab] = useState<'dre' | 'bp'>('dre');
  const { selectedYear } = useDashboard();
  const effectiveYear = analiseVertical?.DRE?.[selectedYear] ? selectedYear : '2025';

  const dreKeys = Object.keys(analiseVertical?.DRE?.['2025'] ?? {}).filter(k => !k.includes('Total'));
  const bpKeys = Object.keys(analiseVertical?.BP?.['2025'] ?? {}).filter(k => !k.includes('Total'));

  const currentData = activeTab === 'dre' ? analiseVertical?.DRE : analiseVertical?.BP;
  const currentKeys = activeTab === 'dre' ? dreKeys : bpKeys;

  const composicaoReceitaData = [
    { name: 'Competicoes', '2023': 34.72, '2024': 34.72, '2025': 34.72 },
    { name: 'Repasses', '2023': 50.0, '2024': 50.0, '2025': 50.0 },
    { name: 'Convenios', '2023': 9.72, '2024': 9.72, '2025': 9.72 },
    { name: 'Outras', '2023': 5.56, '2024': 5.56, '2025': 5.56 },
  ];

  const composicaoAtivoData = [
    { name: 'Ativo Circulante', '2023': 43.04, '2024': 46.64, '2025': 50.15 },
    { name: 'Ativo Nao Circulante', '2023': 56.96, '2024': 53.36, '2025': 49.85 },
  ];

  const composicaoPassivoData = [
    { name: 'Passivo Circulante', '2023': 13.46, '2024': 13.32, '2025': 13.18 },
    { name: 'Passivo Nao Circ.', '2023': 16.48, '2024': 15.43, '2025': 14.49 },
    { name: 'Patrimonio Liquido', '2023': 70.05, '2024': 71.25, '2025': 72.33 },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Analise Vertical</h1>
        </div>
        <p className="text-indigo-100">Composicao percentual das demonstracoes financeiras</p>
      </motion.div>

      <div className="flex flex-wrap gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('dre')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            DRE
          </button>
          <button
            onClick={() => setActiveTab('bp')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === 'bp' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Balanco Patrimonial
          </button>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">
            {activeTab === 'dre' ? 'DRE' : 'Balanco Patrimonial'} - Analise Vertical {effectiveYear}
          </h2>
          <p className="text-sm text-gray-600">
            {activeTab === 'dre' ? 'Percentual em relação à Receita Total' : 'Percentual em relação ao Ativo Total'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Percentual</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-1/2">Composicao</th>
              </tr>
            </thead>
            <tbody>
              {currentKeys.map((key, idx) => {
                const value = currentData?.[effectiveYear]?.[key] ?? 0;
                return (
                  <tr key={key} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-slate-700">{key}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{value?.toFixed?.(2) ?? '0.00'}%</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-slate-200 rounded-full h-4">
                        <div 
                          className="bg-indigo-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(value ?? 0, 100)}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            {activeTab === 'dre' ? 'Composicao da Receita' : 'Composicao do Ativo'}
          </h2>
          <CustomBarChart
            data={activeTab === 'dre' ? composicaoReceitaData : composicaoAtivoData}
            bars={[
              { dataKey: '2023', color: '#60B5FF', name: '2023' },
              { dataKey: '2024', color: '#FF9149', name: '2024' },
              { dataKey: '2025', color: '#80D8C3', name: '2025' }
            ]}
            showPercent={true}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            {activeTab === 'dre' ? 'Evolucao da Estrutura DRE' : 'Estrutura de Capital'}
          </h2>
          <CustomBarChart
            data={activeTab === 'dre' ? composicaoReceitaData : composicaoPassivoData}
            bars={[
              { dataKey: '2023', color: '#A19AD3', name: '2023' },
              { dataKey: '2024', color: '#FF90BB', name: '2024' },
              { dataKey: '2025', color: '#72BF78', name: '2025' }
            ]}
            showPercent={true}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-indigo-50 border border-indigo-200 rounded-xl p-6"
      >
        <h3 className="font-semibold text-indigo-900 mb-3">Principais Observações</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-indigo-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">Receitas de Repasses</p>
            <p className="text-lg font-bold text-indigo-800">50% da Receita Total</p>
            <p className="text-xs text-gray-600 mt-1">Principal fonte de recursos</p>
          </div>
          <div className="bg-indigo-100 rounded-lg p-4">
            <p className="text-sm text-gray-700 mb-1">Patrimônio Líquido</p>
            <p className="text-lg font-bold text-indigo-800">72.33% do Passivo Total</p>
            <p className="text-xs text-gray-600 mt-1">Estrutura de capital sólida</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
