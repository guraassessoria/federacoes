import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processarDadosFinanceiros, ContaComValor } from '@/lib/services/estruturaMapping';
import { calcularIndices, indicesParaPDF, extrairValores } from '@/lib/services/indicesFinanceiros';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D';
  return `${value.toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/D';
  return value.toFixed(2);
}

// Interface para dados processados de uma federação
interface DadosFederacao {
  id: string;
  nome: string;
  sigla: string;
  dre: ContaComValor[];
  bp: ContaComValor[];
  resultadoDRE: number;
  totalPassivoPL: number;
  valores: {
    ativoTotal: number | null;
    ativoCirculante: number | null;
    passivoCirculante: number | null;
    passivoNaoCirculante: number | null;
    patrimonioLiquido: number | null;
    receitasTotal: number | null;
    custosTotal: number | null;
    despesasTotal: number | null;
  };
  indices: ReturnType<typeof indicesParaPDF>;
}

// Função para extrair valores principais
function extrairValoresPrincipais(dre: ContaComValor[], bp: ContaComValor[]) {
  const buscar = (contas: ContaComValor[], codigo: string): number | null => {
    for (const conta of contas) {
      if (conta.codigo === codigo) return conta.valor !== 0 ? conta.valor : null;
      if (conta.children?.length) {
        const v = buscar(conta.children, codigo);
        if (v !== null) return v;
      }
    }
    return null;
  };

  return {
    ativoTotal: buscar(bp, '1'),
    ativoCirculante: buscar(bp, '2'),
    passivoCirculante: buscar(bp, '77'),
    passivoNaoCirculante: buscar(bp, '113'),
    patrimonioLiquido: buscar(bp, '125'),
    receitasTotal: buscar(dre, '1'),
    custosTotal: buscar(dre, '52'),
    despesasTotal: buscar(dre, '104')
  };
}

// Gerar sigla a partir do nome
function gerarSigla(nome: string): string {
  const palavras = nome.split(' ').filter(p => p.length > 2 && !['de', 'do', 'da', 'dos', 'das'].includes(p.toLowerCase()));
  return palavras.map(p => p[0].toUpperCase()).join('').slice(0, 4);
}

function generateComparativeHTML(
  federacoes: DadosFederacao[],
  periodo: string
): string {
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Função para gerar cabeçalho da tabela com federações
  const headerFederacoes = federacoes.map(f => `<th>${f.sigla}</th>`).join('');

  // Função para gerar linha de comparação
  const gerarLinhaComparacao = (
    label: string, 
    getValue: (f: DadosFederacao) => number | null | undefined, 
    formato: 'moeda' | 'percentual' | 'numero' = 'moeda'
  ): string => {
    const valores = federacoes.map(f => {
      const v = getValue(f);
      if (v === null || v === undefined) return '<td>N/D</td>';
      switch (formato) {
        case 'moeda': return `<td>${formatCurrency(v)}</td>`;
        case 'percentual': return `<td>${formatPercent(v)}</td>`;
        case 'numero': return `<td>${formatNumber(v)}</td>`;
      }
    }).join('');
    return `<tr><td>${label}</td>${valores}</tr>`;
  };

  // Calcular rankings
  const rankings = {
    receita: [...federacoes].sort((a, b) => (b.valores.receitasTotal ?? 0) - (a.valores.receitasTotal ?? 0)),
    resultado: [...federacoes].sort((a, b) => b.resultadoDRE - a.resultadoDRE),
    liquidez: [...federacoes].sort((a, b) => (b.indices.liquidez.corrente ?? 0) - (a.indices.liquidez.corrente ?? 0)),
    ativo: [...federacoes].sort((a, b) => (b.valores.ativoTotal ?? 0) - (a.valores.ativoTotal ?? 0))
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Comparativo - Federações</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 9px; line-height: 1.3; color: #1f2937; background: #fff; }
    .page { padding: 25px 30px; page-break-after: always; min-height: 100vh; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
    .header h1 { font-size: 14px; color: #1e40af; font-weight: 700; }
    .header .date { font-size: 9px; color: #6b7280; }
    .section-title { font-size: 12px; color: #1e40af; font-weight: 600; margin: 12px 0 8px 0; padding-bottom: 4px; border-bottom: 2px solid #dbeafe; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8px; }
    th, td { padding: 4px 6px; text-align: right; border: 1px solid #e5e7eb; }
    th { background: #1e40af; color: white; font-weight: 600; font-size: 7px; }
    th:first-child { text-align: left; }
    td:first-child { text-align: left; font-weight: 500; }
    tr:nth-child(even) { background: #f9fafb; }
    tr.total-row { background: #1e3a5f !important; color: white; font-weight: 700; }
    tr.subtotal-row { background: #e0e7ff !important; font-weight: 600; }
    .ranking-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
    .ranking-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; background: #f9fafb; }
    .ranking-card h4 { font-size: 9px; color: #1e40af; margin-bottom: 6px; }
    .ranking-item { display: flex; justify-content: space-between; font-size: 8px; padding: 2px 0; border-bottom: 1px dotted #e5e7eb; }
    .ranking-item:last-child { border-bottom: none; }
    .ranking-item .pos { color: #6b7280; width: 20px; }
    .ranking-item .name { flex: 1; }
    .ranking-item .value { font-weight: 600; color: #1e40af; }
    .cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
    .cover-page h1 { font-size: 22px; color: #1e40af; margin-bottom: 8px; }
    .cover-page h2 { font-size: 14px; color: #374151; font-weight: 400; margin-bottom: 20px; }
    .cover-page .period { font-size: 12px; color: #6b7280; margin-bottom: 30px; }
    .cover-page .logo { width: 70px; height: 70px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    .cover-page .logo span { font-size: 32px; color: white; }
    .fed-list { text-align: left; background: #f0f9ff; padding: 12px; border-radius: 8px; margin-top: 20px; }
    .fed-list h4 { color: #1e40af; margin-bottom: 8px; font-size: 10px; }
    .fed-list ul { margin-left: 15px; font-size: 9px; color: #374151; }
    .fed-list li { margin-bottom: 3px; }
    .analysis-box { background: #f0f9ff; border-left: 4px solid #1e40af; padding: 8px; margin: 8px 0; font-size: 8px; }
    .unavailable-note { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 8px; margin: 8px 0; font-size: 8px; color: #92400e; }
    .footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 7px; color: #9ca3af; }
  </style>
</head>
<body>
  <!-- CAPA -->
  <div class="page cover-page">
    <div class="logo"><span>⚽</span></div>
    <h1>Relatório Comparativo</h1>
    <h2>Análise Financeira de Federações de Futebol</h2>
    <div class="period">Período: ${periodo}</div>
    <p style="color: #9ca3af; font-size: 10px;">Gerado em ${currentDate}</p>
    <div class="fed-list">
      <h4>Federações Comparadas:</h4>
      <ul>
        ${federacoes.map(f => `<li>${f.nome} (${f.sigla})</li>`).join('')}
      </ul>
    </div>
  </div>

  <!-- PÁGINA 1: RANKINGS -->
  <div class="page">
    <div class="header">
      <h1>1. Rankings Comparativos</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <div class="ranking-grid">
      <div class="ranking-card">
        <h4>🏆 Ranking por Receita Total</h4>
        ${rankings.receita.map((f, i) => `
          <div class="ranking-item">
            <span class="pos">${i + 1}º</span>
            <span class="name">${f.sigla}</span>
            <span class="value">${formatCurrency(f.valores.receitasTotal)}</span>
          </div>
        `).join('')}
      </div>
      <div class="ranking-card">
        <h4>💰 Ranking por Resultado Líquido</h4>
        ${rankings.resultado.map((f, i) => `
          <div class="ranking-item">
            <span class="pos">${i + 1}º</span>
            <span class="name">${f.sigla}</span>
            <span class="value">${formatCurrency(f.resultadoDRE)}</span>
          </div>
        `).join('')}
      </div>
      <div class="ranking-card">
        <h4>📊 Ranking por Liquidez Corrente</h4>
        ${rankings.liquidez.map((f, i) => `
          <div class="ranking-item">
            <span class="pos">${i + 1}º</span>
            <span class="name">${f.sigla}</span>
            <span class="value">${formatNumber(f.indices.liquidez.corrente)}</span>
          </div>
        `).join('')}
      </div>
      <div class="ranking-card">
        <h4>🏢 Ranking por Ativo Total</h4>
        ${rankings.ativo.map((f, i) => `
          <div class="ranking-item">
            <span class="pos">${i + 1}º</span>
            <span class="name">${f.sigla}</span>
            <span class="value">${formatCurrency(f.valores.ativoTotal)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  </div>

  <!-- PÁGINA 2: BALANÇO PATRIMONIAL COMPARATIVO -->
  <div class="page">
    <div class="header">
      <h1>2. Balanço Patrimonial Comparativo</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <div class="section-title">Estrutura Patrimonial</div>
    <table>
      <tr>
        <th style="width: 25%;">Conta</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Ativo Total', f => f.valores.ativoTotal)}
      ${gerarLinhaComparacao('Ativo Circulante', f => f.valores.ativoCirculante)}
      ${gerarLinhaComparacao('Passivo Circulante', f => f.valores.passivoCirculante)}
      ${gerarLinhaComparacao('Passivo Não Circulante', f => f.valores.passivoNaoCirculante)}
      ${gerarLinhaComparacao('Patrimônio Líquido', f => f.valores.patrimonioLiquido)}
      <tr class="total-row">
        <td>Total Passivo + PL</td>
        ${federacoes.map(f => `<td>${formatCurrency(f.totalPassivoPL)}</td>`).join('')}
      </tr>
    </table>
  </div>

  <!-- PÁGINA 3: DRE COMPARATIVO -->
  <div class="page">
    <div class="header">
      <h1>3. Demonstração do Resultado Comparativa</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 25%;">Conta</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Receitas Totais', f => f.valores.receitasTotal)}
      ${gerarLinhaComparacao('(-) Custos Totais', f => f.valores.custosTotal)}
      ${gerarLinhaComparacao('(-) Despesas Totais', f => f.valores.despesasTotal)}
      <tr class="total-row">
        <td>= Resultado Líquido</td>
        ${federacoes.map(f => `<td>${formatCurrency(f.resultadoDRE)}</td>`).join('')}
      </tr>
    </table>

    <div class="section-title">Margens (%)</div>
    <table>
      <tr>
        <th style="width: 25%;">Margem</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Margem Bruta', f => f.indices.rentabilidade.margemBruta, 'percentual')}
      ${gerarLinhaComparacao('Margem Operacional', f => f.indices.rentabilidade.margemOp, 'percentual')}
      ${gerarLinhaComparacao('Margem Líquida', f => f.indices.rentabilidade.margemLiq, 'percentual')}
    </table>
  </div>

  <!-- PÁGINA 4: ÍNDICES DE LIQUIDEZ -->
  <div class="page">
    <div class="header">
      <h1>4. Índices de Liquidez Comparativos</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 25%;">Indicador</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Liquidez Corrente', f => f.indices.liquidez.corrente, 'numero')}
      ${gerarLinhaComparacao('Liquidez Seca', f => f.indices.liquidez.seca, 'numero')}
      ${gerarLinhaComparacao('Liquidez Imediata', f => f.indices.liquidez.imediata, 'numero')}
      ${gerarLinhaComparacao('Liquidez Geral', f => f.indices.liquidez.geral, 'numero')}
    </table>

    <div class="analysis-box">
      <strong>Interpretação:</strong> Liquidez Corrente > 1,0 indica capacidade de pagar dívidas de curto prazo. 
      Valores mais altos representam maior folga financeira.
    </div>
  </div>

  <!-- PÁGINA 5: ÍNDICES DE RENTABILIDADE -->
  <div class="page">
    <div class="header">
      <h1>5. Índices de Rentabilidade Comparativos</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 25%;">Indicador</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Margem Bruta', f => f.indices.rentabilidade.margemBruta, 'percentual')}
      ${gerarLinhaComparacao('Margem Operacional', f => f.indices.rentabilidade.margemOp, 'percentual')}
      ${gerarLinhaComparacao('Margem Líquida', f => f.indices.rentabilidade.margemLiq, 'percentual')}
      ${gerarLinhaComparacao('ROA', f => f.indices.rentabilidade.roa, 'percentual')}
      ${gerarLinhaComparacao('ROE', f => f.indices.rentabilidade.roe, 'percentual')}
    </table>

    <div class="analysis-box">
      <strong>Interpretação:</strong> Margens positivas indicam operação superávitária. 
      ROA e ROE medem o retorno sobre ativos e patrimônio líquido, respectivamente.
    </div>
  </div>

  <!-- PÁGINA 6: ÍNDICES DE ENDIVIDAMENTO -->
  <div class="page">
    <div class="header">
      <h1>6. Índices de Endividamento Comparativos</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 25%;">Indicador</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Endividamento Geral', f => f.indices.endividamento.geral, 'percentual')}
      ${gerarLinhaComparacao('Composição Endividamento', f => f.indices.endividamento.composicao, 'percentual')}
      ${gerarLinhaComparacao('Grau de Alavancagem', f => f.indices.endividamento.alavancagem, 'numero')}
      ${gerarLinhaComparacao('Imobilização do PL', f => f.indices.endividamento.imobilizacaoPL, 'percentual')}
    </table>

    <div class="analysis-box">
      <strong>Interpretação:</strong> Endividamento geral < 50% indica baixa dependência de capital de terceiros. 
      Composição do endividamento alta indica maior concentração de dívidas no curto prazo.
    </div>
  </div>

  <!-- PÁGINA 7: ÍNDICES DE ATIVIDADE -->
  <div class="page">
    <div class="header">
      <h1>7. Índices de Atividade Comparativos</h1>
      <div class="date">Comparação ${periodo} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 25%;">Indicador</th>
        ${headerFederacoes}
      </tr>
      ${gerarLinhaComparacao('Giro do Ativo', f => f.indices.atividade.giroAtivo, 'numero')}
      ${gerarLinhaComparacao('PMR (dias)', f => f.indices.atividade.pmr, 'numero')}
      ${gerarLinhaComparacao('PMP (dias)', f => f.indices.atividade.pmp, 'numero')}
    </table>

    <div class="analysis-box">
      <strong>Interpretação:</strong> O giro do ativo mostra quantas vezes o ativo foi "girado" em receitas. 
      PMR = Prazo Médio de Recebimento; PMP = Prazo Médio de Pagamento.
    </div>

    <div class="footer">
      <p>Relatório gerado automaticamente pelo Sistema de Gestão Financeira de Federações</p>
      <p>${currentDate}</p>
    </div>
  </div>
</body>
</html>
`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

   const body = await request.json();
    const { year, companyIds, federacoes: federacoesNomes } = body;

    // Buscar empresas - prioriza companyIds (IDs reais), fallback para nomes
    let companies: { id: string; name: string }[] = [];
    
    if (companyIds && Array.isArray(companyIds) && companyIds.length > 0) {
      // Novo formato: recebe IDs reais das empresas
      companies = await prisma.company.findMany({
        where: { id: { in: companyIds } },
        select: { id: true, name: true },
      });
    } else if (federacoesNomes && Array.isArray(federacoesNomes) && federacoesNomes.length > 0) {
      // Formato antigo (compatibilidade): recebe nomes
      companies = await prisma.company.findMany({
        where: { name: { in: federacoesNomes } },
        select: { id: true, name: true },
      });
    } else {
      // Fallback: todas as empresas do usuário
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { companies: { include: { company: { select: { id: true, name: true } } } } }
      });
      
      if (user?.companies) {
        companies = user.companies.map(uc => uc.company);
      }
    }

    if (companies.length < 2) {
      return NextResponse.json({ 
        error: 'Não foram encontradas federações suficientes no banco de dados' 
      }, { status: 404 });
    }

    const yearFilter = year || '25';
    const federacoes: DadosFederacao[] = [];

    // Processar cada federação
    for (const company of companies) {
      const balanceteData = await prisma.balanceteData.findMany({
        where: {
          companyId: company.id,
          period: { contains: yearFilter }
        },
        orderBy: { accountNumber: 'asc' }
      });

      if (balanceteData.length === 0) {
        console.log(`Sem dados para ${company.name}`);
        continue;
      }

      const { dre, bp, resultadoDRE, totalPassivoPL } = await processarDadosFinanceiros(balanceteData);
      const indices = calcularIndices(bp, dre);
      const indicesPDF = indicesParaPDF(indices);
      const valores = extrairValoresPrincipais(dre, bp);

      federacoes.push({
        id: company.id,
        nome: company.name,
        sigla: gerarSigla(company.name),
        dre,
        bp,
        resultadoDRE,
        totalPassivoPL,
        valores,
        indices: indicesPDF
      });
    }

    if (federacoes.length < 2) {
      return NextResponse.json({ 
        error: 'Não há dados de balancete suficientes para gerar o relatório comparativo. Verifique se as federações possuem balancetes carregados para o ano selecionado.' 
      }, { status: 400 });
    }

    // Gerar HTML
    const periodo = `20${yearFilter}`;
    const html = generateComparativeHTML(federacoes, periodo);

    // Verificar se API de PDF está configurada
    const html2pdfUrl = process.env.HTML2PDF_API_URL;
    const html2pdfKey = process.env.HTML2PDF_API_KEY;

    if (!html2pdfUrl || !html2pdfKey) {
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="comparativo_federacoes_${periodo}.html"`
        }
      });
    }

    // Gerar PDF via API
    const pdfResponse = await fetch(html2pdfUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${html2pdfKey}`
      },
      body: JSON.stringify({
        html,
        options: {
          format: 'A4',
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
          printBackground: true
        }
      })
    });

    if (!pdfResponse.ok) {
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="comparativo_federacoes_${periodo}.html"`
        }
      });
    }

    // Verificar se é resposta assíncrona
    const contentType = pdfResponse.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const jobData = await pdfResponse.json();
      
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusResponse = await fetch(`${html2pdfUrl}/status/${jobData.jobId}`, {
          headers: { 'Authorization': `Bearer ${html2pdfKey}` }
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed' && statusData.pdfUrl) {
            const pdfDownload = await fetch(statusData.pdfUrl);
            const pdfBuffer = await pdfDownload.arrayBuffer();
            
            return new NextResponse(pdfBuffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="comparativo_federacoes_${periodo}.pdf"`
              }
            });
          } else if (statusData.status === 'failed') {
            throw new Error('Falha na geração do PDF');
          }
        }
        
        attempts++;
      }
      
      throw new Error('Timeout na geração do PDF');
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="comparativo_federacoes_${periodo}.pdf"`
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório comparativo:', error);
    return NextResponse.json({ 
      error: 'Erro ao gerar relatório comparativo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
