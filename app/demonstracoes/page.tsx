'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileSpreadsheet, ChevronDown, ChevronRight } from 'lucide-react';
import { demonstracoesFinanceiras, analiseVertical, formatCurrency, formatPercent, anos } from '@/lib/data';
import CustomBarChart from '@/components/charts/bar-chart';

const dreGroups = [
  { title: 'Receitas Operacionais', keys: ['Receitas de Competicoes', 'Receitas de Repasses', 'Receitas de Convenios e Parcerias', 'Outras Receitas Operacionais', 'Total Receitas Operacionais'], total: 'Total Receitas Operacionais' },
  { title: 'Custos', keys: ['Custos com Competicoes', 'Custos com Desenvolvimento do Futebol', 'Custos com Infraestrutura Esportiva', 'Total Custos'], total: 'Total Custos' },
  { title: 'Despesas Operacionais', keys: ['Despesas com Pessoal', 'Despesas Administrativas', 'Despesas Comerciais e Marketing', 'Outras Despesas Operacionais', 'Total Despesas Operacionais'], total: 'Total Despesas Operacionais' },
  { title: 'Resultados', keys: ['Resultado Operacional', 'Resultado Financeiro', 'Resultado Nao Operacional', 'Resultado Liquido'], total: 'Resultado Liquido' }
];

const bpGroups = [
  { title: 'Ativo Circulante', keys: ['Total Disponibilidades', 'Total Contas a Receber', 'Total Estoques', 'Total Ativo Circulante'], total: 'Total Ativo Circulante' },
  { title: 'Ativo Nao Circulante', keys: ['Total Imobilizado Liquido', 'Total Intangivel', 'Total Ativo Nao Circulante'], total: 'Total Ativo Nao Circulante' },
  { title: 'Passivo Circulante', keys: ['Fornecedores', 'Emprestimos Bancarios CP', 'Total Passivo Circulante'], total: 'Total Passivo Circulante' },
  { title: 'Passivo Nao Circulante', keys: ['Emprestimos Bancarios LP', 'Financiamentos LP', 'Total Passivo Nao Circulante'], total: 'Total Passivo Nao Circulante' },
  { title: 'Patrimonio Liquido', keys: ['Capital Social', 'Reserva Legal', 'Superavits Acumulados', 'Total Patrimonio Liquido'], total: 'Total Patrimonio Liquido' }
];

export default function DemonstracoesPage() {
  const [activeTab, setActiveTab] = useState<'dre' | 'bp'>('dre');
  const [expandedGroups, setExpandedGroups] = useState<string[]>(['Receitas Operacionais', 'Resultados', 'Ativo Circulante', 'Patrimonio Liquido']);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => 
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  };

  const getDreValue = (year: string, key: string) => {
    const dre = demonstracoesFinanceiras?.[year]?.DRE ?? {};
    const normalizedKey = Object.keys(dre).find(k => 
      k.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    return normalizedKey ? dre[normalizedKey] ?? 0 : 0;
  };

  const getBpValue = (year: string, key: string) => {
    const bp = demonstracoesFinanceiras?.[year]?.BP ?? {};
    const normalizedKey = Object.keys(bp).find(k => 
      k.toLowerCase().replace(/[^a-z0-9]/g, '') === key.toLowerCase().replace(/[^a-z0-9]/g, '')
    );
    return normalizedKey ? bp[normalizedKey] ?? 0 : 0;
  };

  const groups = activeTab === 'dre' ? dreGroups : bpGroups;
  const getValue = activeTab === 'dre' ? getDreValue : getBpValue;

  const chartData = groups.map(g => ({
    name: g.title.substring(0, 15),
    '2023': getValue('2023', g.total),
    '2024': getValue('2024', g.total),
    '2025': getValue('2025', g.total)
  }));

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <FileSpreadsheet className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Demonstracoes Financeiras</h1>
        </div>
        <p className="text-blue-100">DRE e Balanco Patrimonial com Analise Vertical</p>
      </motion.div>

      <div className="flex gap-4">
        <button
          onClick={() => setActiveTab('dre')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === 'dre' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          DRE - Demonstracao do Resultado
        </button>
        <button
          onClick={() => setActiveTab('bp')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${activeTab === 'bp' ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
        >
          Balanco Patrimonial
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-4 py-3 font-semibold text-slate-700 w-1/3">Conta</th>
              {anos.map(ano => (
                <th key={ano} className="text-right px-4 py-3 font-semibold text-slate-700">
                  {ano}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <React.Fragment key={group.title}>
                <tr 
                  className="bg-slate-50 cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleGroup(group.title)}
                >
                  <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-2">
                    {expandedGroups.includes(group.title) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {group.title}
                  </td>
                  {anos.map(ano => (
                    <td key={ano} className="text-right px-4 py-3 font-semibold text-slate-800">
                      {formatCurrency(getValue(ano, group.total))}
                    </td>
                  ))}
                </tr>
                {expandedGroups.includes(group.title) && group.keys.filter(k => k !== group.total).map((key) => (
                  <tr key={key} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-2 pl-10 text-slate-600">{key}</td>
                    {anos.map(ano => (
                      <td key={ano} className="text-right px-4 py-2 text-slate-700">
                        {formatCurrency(getValue(ano, key))}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">Comparativo por Grupo</h2>
        <CustomBarChart
          data={chartData}
          bars={[
            { dataKey: '2023', color: '#60B5FF', name: '2023' },
            { dataKey: '2024', color: '#FF9149', name: '2024' },
            { dataKey: '2025', color: '#80D8C3', name: '2025' }
          ]}
        />
      </motion.div>
    </div>
  );
}
