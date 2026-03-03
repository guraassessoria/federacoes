'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function EndividamentoPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard/endividamento');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <p className="text-slate-600">Redirecionando...</p>
    </div>
  );
}
  'Endividamento Geral (%)': 'Percentual do ativo financiado por terceiros',
  'Composicao do Endividamento (%)': 'Percentual da divida que vence no curto prazo',
  'Grau de Alavancagem': 'Relacao entre passivo total e patrimonio liquido',
  'Participacao de Capital de Terceiros (%)': 'Peso do capital de terceiros na estrutura',
  'Imobilizacao do PL (%)': 'Quanto do PL esta aplicado em ativos imobilizados'
};

export default function EndividamentoPage() {
  const indices = ['Endividamento Geral (%)', 'Composicao do Endividamento (%)', 'Grau de Alavancagem', 'Imobilizacao do PL (%)'];

  const chartData = anos.map(ano => {
    return {
      name: ano,
      'Endividamento Geral': indicesFinanceiros?.[ano]?.Endividamento?.['Endividamento Geral (%)'] ?? 0,
      'Composicao Endividamento': indicesFinanceiros?.[ano]?.Endividamento?.['Composicao do Endividamento (%)'] ?? 0,
    };
  });

  const alavancagemData = anos.map(ano => ({
    name: ano,
    Alavancagem: indicesFinanceiros?.[ano]?.Endividamento?.['Grau de Alavancagem'] ?? 0
  }));

  const kpis2025 = resumoExecutivo?.kpis_principais?.['2025'] ?? {};
  const passivoCirculante = (kpis2025?.ativo_total ?? 0) * 0.1318;
  const passivoNaoCirculante = (kpis2025?.ativo_total ?? 0) * 0.1449;
  const patrimonioLiquido = kpis2025?.patrimonio_liquido ?? 0;

  const composicaoData = [
    { name: 'Passivo Circulante', value: passivoCirculante },
    { name: 'Passivo Nao Circulante', value: passivoNaoCirculante },
    { name: 'Patrimonio Liquido', value: patrimonioLiquido }
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-purple-600 to-purple-700 rounded-2xl p-8 text-white shadow-xl"
      >
        <div className="flex items-center gap-3 mb-2">
          <Scale className="w-8 h-8" />
          <h1 className="text-3xl font-bold">Indices de Endividamento</h1>
        </div>
        <p className="text-purple-100">Estrutura de capital e nivel de alavancagem financeira</p>
      </motion.div>

      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-purple-800">
          <p className="font-semibold mb-1">Interpretacao:</p>
          <p className="text-purple-700">
            Endividamento baixo ({`<`}30%) indica solidez financeira e menor risco. 
            A federacao apresenta tendencia de reducao do endividamento, o que e positivo.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {indices.map((idx, i) => (
          <IndicatorCard
            key={idx}
            title={idx.replace(' (%)', '')}
            values={anos.map(ano => ({
              year: ano,
              value: indicesFinanceiros?.[ano]?.Endividamento?.[idx] ?? 0
            }))}
            format={idx.includes('Grau') ? 'number' : 'percent'}
            description={endividamentoDescriptions[idx]}
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
          <h2 className="text-lg font-bold text-slate-800 mb-4">Evolucao do Endividamento</h2>
          <CustomLineChart
            data={chartData}
            lines={[
              { dataKey: 'Endividamento Geral', color: '#A19AD3', name: 'Endivid. Geral' },
              { dataKey: 'Composicao Endividamento', color: '#FF90BB', name: 'Composicao' }
            ]}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-xl shadow-lg p-6"
        >
          <h2 className="text-lg font-bold text-slate-800 mb-4">Estrutura de Capital 2025</h2>
          <CustomPieChart
            data={composicaoData}
            colors={['#FF9149', '#A19AD3', '#80D8C3']}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-xl shadow-lg p-6"
      >
        <h2 className="text-lg font-bold text-slate-800 mb-4">Grau de Alavancagem</h2>
        <CustomBarChart
          data={alavancagemData}
          bars={[{ dataKey: 'Alavancagem', color: '#A19AD3', name: 'Alavancagem' }]}
          showPercent={false}
        />
        <p className="text-sm text-slate-500 mt-4">
          O grau de alavancagem indica a relacao entre passivo e patrimonio liquido. 
          Valores abaixo de 1 indicam que o patrimonio liquido supera as dividas.
        </p>
      </motion.div>
    </div>
  );
}
