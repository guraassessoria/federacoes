'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import CustomBarChart from '@/components/charts/bar-chart';
import { useDashboard } from '@/lib/contexts/DashboardContext';

interface ContaHorizontal {
  codigo: string;
  descricao: string;
  nivel: number;
  valores: Record<string, number>;
  variacoes: Record<string, number>;
}

interface AnaliseHorizontalData {
  meta: {
    companyId: string;
    anosSolicitados: string[];
    anosDisponiveis: string[];
    parametros: {
      maxNivel: number;
      incluirZeros: boolean;
    };
  };
  DRE: Record<string, ContaHorizontal>;
  BP: Record<string, ContaHorizontal>;
}

export default function AnaliseHorizontalPage() {
  const { selectedCompanyId, availableYears } = useDashboard();
  const [analiseHorizontal, setAnaliseHorizontal] = useState<AnaliseHorizontalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompanyId) {
      setError('Nenhuma empresa selecionada');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const anos = availableYears.join(',');
    fetch(`/api/analise-horizontal?companyId=${selectedCompanyId}&anos=${anos}&maxNivel=3`)
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar análise horizontal');
        return res.json();
      })
      .then(data => {
        setAnaliseHorizontal(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [selectedCompanyId, availableYears]);

  const anosDisponiveis = analiseHorizontal?.meta.anosDisponiveis ?? [];
  const paresAnos = anosDisponiveis.slice(1).map((ano, idx) => {
    const anterior = anosDisponiveis[idx];
    return {
      from: anterior,
      to: ano,
      key: `Variacao ${anterior}-${ano} (%)`,
      label: `${anterior}-${ano}`,
    };
  });
  const variacaoAcumuladaKey =
    anosDisponiveis.length >= 2
      ? `Variacao ${anosDisponiveis[0]}-${anosDisponiveis[anosDisponiveis.length - 1]} (%)`
      : null;

  const dreItems = Object.values(analiseHorizontal?.DRE ?? {});
  const bpItems = Object.values(analiseHorizontal?.BP ?? {});

  const topDre = [...dreItems]
    .sort((a, b) => Math.abs((b.variacoes[variacaoAcumuladaKey || ''] ?? 0)) - Math.abs((a.variacoes[variacaoAcumuladaKey || ''] ?? 0)))
    .slice(0, 10);

  const topBp = [...bpItems]
    .sort((a, b) => Math.abs((b.variacoes[variacaoAcumuladaKey || ''] ?? 0)) - Math.abs((a.variacoes[variacaoAcumuladaKey || ''] ?? 0)))
    .slice(0, 10);

  const dreData = topDre.map(item => ({
    name: item.descricao.length > 28 ? `${item.descricao.slice(0, 28)}...` : item.descricao,
    Acumulada: variacaoAcumuladaKey ? item.variacoes[variacaoAcumuladaKey] ?? 0 : 0,
  }));

  const bpData = topBp.map(item => ({
    name: item.descricao.length > 28 ? `${item.descricao.slice(0, 28)}...` : item.descricao,
    Acumulada: variacaoAcumuladaKey ? item.variacoes[variacaoAcumuladaKey] ?? 0 : 0,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (error || !analiseHorizontal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-semibold mb-2">Erro ao carregar dados</p>
          <p className="text-red-600 text-sm">{error || 'Dados não disponíveis'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <ArrowLeftRight className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Análise Horizontal</h1>
        </div>
        <p className="text-orange-100">Variação percentual por código contábil (modelo DRE/BP)</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Anos com dados</p>
          <p className="text-lg font-semibold text-slate-800">{anosDisponiveis.join(', ') || 'N/D'}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Contas DRE analisadas</p>
          <p className="text-lg font-semibold text-slate-800">{dreItems.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Contas BP analisadas</p>
          <p className="text-lg font-semibold text-slate-800">{bpItems.length}</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">DRE - Variação entre períodos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                {paresAnos.map(par => (
                  <th key={par.key} className="text-right px-4 py-3 font-semibold text-slate-700">{par.label}</th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-slate-700">
                  {variacaoAcumuladaKey ? `Acumulada ${anosDisponiveis[0]}-${anosDisponiveis[anosDisponiveis.length - 1]}` : 'Acumulada'}
                </th>
              </tr>
            </thead>
            <tbody>
              {dreItems.map((item, idx) => (
                <tr key={`dre-${item.codigo}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-700 font-mono">{item.codigo}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{item.descricao}</td>
                  {paresAnos.map(par => (
                    <td key={`${item.codigo}-${par.key}`} className="px-4 py-3 text-right">
                      {renderVariation(item.variacoes[par.key] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold">
                    {renderVariation(variacaoAcumuladaKey ? item.variacoes[variacaoAcumuladaKey] ?? 0 : 0)}
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
        <h2 className="text-lg font-bold text-slate-800 mb-4">DRE - Top variações acumuladas</h2>
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
          <h2 className="text-lg font-bold text-slate-800">Balanço Patrimonial - Variação entre períodos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                {paresAnos.map(par => (
                  <th key={par.key} className="text-right px-4 py-3 font-semibold text-slate-700">{par.label}</th>
                ))}
                <th className="text-right px-4 py-3 font-semibold text-slate-700">
                  {variacaoAcumuladaKey ? `Acumulada ${anosDisponiveis[0]}-${anosDisponiveis[anosDisponiveis.length - 1]}` : 'Acumulada'}
                </th>
              </tr>
            </thead>
            <tbody>
              {bpItems.map((item, idx) => (
                <tr key={`bp-${item.codigo}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="px-4 py-3 text-slate-700 font-mono">{item.codigo}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{item.descricao}</td>
                  {paresAnos.map(par => (
                    <td key={`${item.codigo}-${par.key}`} className="px-4 py-3 text-right">
                      {renderVariation(item.variacoes[par.key] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-semibold">
                    {renderVariation(variacaoAcumuladaKey ? item.variacoes[variacaoAcumuladaKey] ?? 0 : 0)}
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
        <h2 className="text-lg font-bold text-slate-800 mb-4">BP - Top variações acumuladas</h2>
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
