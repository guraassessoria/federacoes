'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Loader2 } from 'lucide-react';
import CustomBarChart from '@/components/charts/bar-chart';
import { useDashboard } from '@/lib/contexts/DashboardContext';

interface ContaVertical {
  codigo: string;
  descricao: string;
  nivel: number;
  valor: number;
  percentual: number;
}

interface VerticalAno {
  base: {
    codigo: string;
    descricao: string;
    valor: number;
  };
  contas: ContaVertical[];
}

interface AnaliseVerticalData {
  meta: {
    companyId: string;
    anosSolicitados: string[];
    anosDisponiveis: string[];
    parametros: {
      maxNivel: number;
      incluirZeros: boolean;
    };
  };
  DRE: Record<string, VerticalAno>;
  BP: Record<string, VerticalAno>;
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function shortLabel(text: string, limit: number = 34): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}...`;
}

export default function AnaliseVerticalPage() {
  const [activeTab, setActiveTab] = useState<'dre' | 'bp'>('dre');
  const { selectedYear, selectedCompanyId, availableYears } = useDashboard();
  const [analiseVertical, setAnaliseVertical] = useState<AnaliseVerticalData | null>(null);
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
    fetch(`/api/analise-vertical?companyId=${selectedCompanyId}&anos=${anos}&maxNivel=3`)
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar análise vertical');
        return res.json();
      })
      .then(data => {
        setAnaliseVertical(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [selectedCompanyId, availableYears]);

  const fonteAtual = activeTab === 'dre' ? analiseVertical?.DRE : analiseVertical?.BP;
  const anosDisponiveis = Object.keys(fonteAtual ?? {});
  const effectiveYear = fonteAtual?.[selectedYear]
    ? selectedYear
    : (anosDisponiveis[anosDisponiveis.length - 1] ?? availableYears[availableYears.length - 1]);

  const dadosAnoAtual = fonteAtual?.[effectiveYear];
  const contasTabela = (dadosAnoAtual?.contas ?? []).filter(conta => conta.nivel <= 3);

  const contasComparativas = (dadosAnoAtual?.contas ?? [])
    .filter(conta => conta.nivel <= 2 && conta.codigo !== dadosAnoAtual.base.codigo)
    .sort((a, b) => Math.abs(b.percentual) - Math.abs(a.percentual))
    .slice(0, 8);

  const comparativoData = contasComparativas.map(conta => {
    const item: Record<string, string | number> = {
      name: shortLabel(conta.descricao),
    };
    anosDisponiveis.forEach(ano => {
      const contaAno = fonteAtual?.[ano]?.contas.find(c => c.codigo === conta.codigo);
      item[ano] = contaAno?.percentual ?? 0;
    });
    return item;
  });

  const chartColors = ['#60B5FF', '#FF9149', '#80D8C3', '#A19AD3', '#FF90BB', '#72BF78'];
  const chartBars = anosDisponiveis.map((ano, idx) => ({
    dataKey: ano,
    color: chartColors[idx % chartColors.length],
    name: ano,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !analiseVertical) {
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
        className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Análise Vertical</h1>
        </div>
        <p className="text-indigo-100">Composição percentual por modelo contábil (DRE e BP)</p>
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
            Balanço Patrimonial
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Ano de referência</p>
          <p className="text-lg font-semibold text-slate-800">{effectiveYear}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Base contábil</p>
          <p className="text-sm font-semibold text-slate-800">
            {dadosAnoAtual?.base.codigo} - {dadosAnoAtual?.base.descricao}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-xs text-slate-500 mb-1">Contas consideradas</p>
          <p className="text-lg font-semibold text-slate-800">{contasTabela.length}</p>
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
            {activeTab === 'dre' ? 'DRE' : 'Balanço Patrimonial'} - Análise Vertical {effectiveYear}
          </h2>
          <p className="text-sm text-gray-600">
            Percentual em relação à conta base {dadosAnoAtual?.base.codigo} ({dadosAnoAtual?.base.descricao})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Código</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Conta</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Valor</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-700">Percentual</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700 w-1/2">Composicao</th>
              </tr>
            </thead>
            <tbody>
              {contasTabela.map((conta, idx) => {
                const offset = Math.max(0, (conta.nivel - 1) * 16);
                const value = conta.percentual ?? 0;
                return (
                  <tr key={`${conta.codigo}-${idx}`} className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                    <td className="px-4 py-3 text-slate-700 font-mono">{conta.codigo}</td>
                    <td className="px-4 py-3 text-slate-700" style={{ paddingLeft: `${offset + 16}px` }}>{conta.descricao}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{conta.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatPercent(value)}</td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-slate-200 rounded-full h-4">
                        <div 
                          className="bg-indigo-500 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(Math.abs(value), 100)}%` }}
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

      <div className="grid grid-cols-1 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">Contas relevantes por ano (%)</h2>
          {comparativoData.length > 0 ? (
            <CustomBarChart
              data={comparativoData}
              bars={chartBars}
              layout="vertical"
              showPercent={true}
            />
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-600">
              Não há contas suficientes para montar o comparativo multianual.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
