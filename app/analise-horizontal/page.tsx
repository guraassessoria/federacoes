'use client';

import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';
import { analiseHorizontal, anos } from '@/lib/data';
import CustomBarChart from '@/components/charts/bar-chart';

export default function AnaliseHorizontalPage() {
  const dreKeys = Object.keys(analiseHorizontal?.DRE ?? {});
  const bpKeys = Object.keys(analiseHorizontal?.BP ?? {});

  const dreData = dreKeys.map(key => ({
    name: key.length > 25 ? key.substring(0, 25) + '...' : key,
    '2023-2024': analiseHorizontal?.DRE?.[key]?.['Variacao 2023-2024 (%)'] ?? 0,
    '2024-2025': analiseHorizontal?.DRE?.[key]?.['Variacao 2024-2025 (%)'] ?? 0,
    'Acumulada': analiseHorizontal?.DRE?.[key]?.['Variacao 2023-2025 (%)'] ?? 0
  }));

  const bpData = bpKeys.map(key => ({
    name: key.length > 25 ? key.substring(0, 25) + '...' : key,
    '2023-2024': analiseHorizontal?.BP?.[key]?.['Variacao 2023-2024 (%)'] ?? 0,
    '2024-2025': analiseHorizontal?.BP?.[key]?.['Variacao 2024-2025 (%)'] ?? 0,
    'Acumulada': analiseHorizontal?.BP?.[key]?.['Variacao 2023-2025 (%)'] ?? 0
  }));

  const renderVariation = (value: number) => {
    const val = value ?? 0;
    const isPositive = val > 0;
    const isNegative = val < 0;
    return (
      <span className={`flex items-center gap-1 ${isPositive ? 'text-emerald-600' : isNegative ? 'text-red-600' : 'text-slate-500'}`}>
        {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
        {isPositive ? '+' : ''}{val?.toFixed?.(2) ?? '0.00'}%
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <ArrowLeftRight className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Analise Horizontal</h1>
        </div>
        <p className="text-orange-100">Variacao percentual das contas entre os periodos</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">DRE - Variacao entre Periodos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">2023-2024</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">2024-2025</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Acumulada 2023-2025</th>
              </tr>
            </thead>
            <tbody>
              {dreKeys.map((key, idx) => (
                <tr key={key} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-700 font-medium">{key}</td>
                  <td className="px-4 py-3 text-right">
                    {renderVariation(analiseHorizontal?.DRE?.[key]?.['Variacao 2023-2024 (%)'] ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderVariation(analiseHorizontal?.DRE?.[key]?.['Variacao 2024-2025 (%)'] ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {renderVariation(analiseHorizontal?.DRE?.[key]?.['Variacao 2023-2025 (%)'] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">DRE - Variacao Acumulada 2023-2025</h2>
        <CustomBarChart
          data={dreData}
          bars={[{ dataKey: 'Acumulada', color: '#FF9149', name: 'Variacao %' }]}
          layout="vertical"
          showPercent={true}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Balanco Patrimonial - Variacao entre Periodos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">2023-2024</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">2024-2025</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Acumulada 2023-2025</th>
              </tr>
            </thead>
            <tbody>
              {bpKeys.map((key, idx) => (
                <tr key={key} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-700 font-medium">{key}</td>
                  <td className="px-4 py-3 text-right">
                    {renderVariation(analiseHorizontal?.BP?.[key]?.['Variacao 2023-2024 (%)'] ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {renderVariation(analiseHorizontal?.BP?.[key]?.['Variacao 2024-2025 (%)'] ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {renderVariation(analiseHorizontal?.BP?.[key]?.['Variacao 2023-2025 (%)'] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">BP - Variacao Acumulada 2023-2025</h2>
        <CustomBarChart
          data={bpData}
          bars={[{ dataKey: 'Acumulada', color: '#60B5FF', name: 'Variacao %' }]}
          layout="vertical"
          showPercent={true}
        />
      </motion.div>
    </div>
  );
}
