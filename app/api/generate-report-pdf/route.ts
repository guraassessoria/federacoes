import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processarDadosFinanceiros, ContaComValor, flattenHierarchy, DeParaRecord } from '@/lib/services/estruturaMapping';
import { ordenarArvoreDreReceitaBrutaPrimeiro } from '@/lib/services/drePresentation';
import { handleApiError } from '@/lib/errorHandler';
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

function normalizarTexto(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function flattenContas(contas: ContaComValor[]): ContaComValor[] {
  const result: ContaComValor[] = [];
  const walk = (items: ContaComValor[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children?.length) walk(item.children);
    }
  };
  walk(contas || []);
  return result;
}

function encontrarCodigoPorDescricao(
  contas: ContaComValor[],
  termosPreferenciais: string[][],
  fallbackCodigo: string,
  exclusoesPorTermo: string[][][] = []
): string {
  const flat = flattenContas(contas);
  for (let i = 0; i < termosPreferenciais.length; i++) {
    const termos = termosPreferenciais[i];
    const exclusoes = exclusoesPorTermo[i] || [];
    const matches = flat.filter((conta) => {
      const desc = normalizarTexto(conta.descricao || '');
      const matchPrincipal = termos.every((termo) => desc.includes(normalizarTexto(termo)));
      if (!matchPrincipal) return false;
      if (!exclusoes.length) return true;
      return !exclusoes.some((exclusao) => exclusao.every((termo) => desc.includes(normalizarTexto(termo))));
    });
    if (matches.length > 0) {
      matches.sort((a, b) => {
        const na = Number(a.nivel ?? Number.MAX_SAFE_INTEGER);
        const nb = Number(b.nivel ?? Number.MAX_SAFE_INTEGER);
        if (na !== nb) return na - nb;
        const oa = Number((a as any).ordem ?? Number.MAX_SAFE_INTEGER);
        const ob = Number((b as any).ordem ?? Number.MAX_SAFE_INTEGER);
        if (oa !== ob) return oa - ob;
        return String(a.codigo).localeCompare(String(b.codigo));
      });
      return matches[0].codigo;
    }
  }
  return fallbackCodigo;
}

// Função para extrair valores principais das demonstrações
function extrairValoresPrincipais(dre: ContaComValor[], bp: ContaComValor[]) {
  const valores = extrairValores(bp, dre);

  return {
    // BP
    ativoTotal: valores.ativoTotal,
    ativoCirculante: valores.ativoCirculante,
    disponibilidades: valores.disponibilidades,
    ativoNaoCirculante: valores.ativoNaoCirculante,
    imobilizado: valores.imobilizado,
    passivoCirculante: valores.passivoCirculante,
    passivoNaoCirculante: valores.passivoNaoCirculante,
    patrimonioLiquido: valores.patrimonioLiquido,
    // DRE
    receitasTotal: valores.receitasTotal,
    custosTotal: valores.custosTotal,
    despesasTotal: valores.despesasTotal,
    resultadoFinanceiro: valores.resultadoFinanceiro,
    resultadoLiquido: valores.resultadoLiquido
  };
}

function gerarLinhasTabela(contas: ContaComValor[], maxNivel: number = 3): string {
  let html = '';
  
  function processar(conta: ContaComValor, nivel: number = 0): void {
    if (nivel > maxNivel) return;
    
    // Ocultar linhas sem valor (exceto totalizadores principais de nível 1)
    if (conta.valor === 0 && conta.nivel > 1) return;
    
    const indent = '&nbsp;'.repeat(nivel * 4);
    const isTotal = conta.nivel === 1;
    const isSubtotal = conta.nivel === 2;
    const valor = conta.valor !== 0 ? formatCurrency(conta.valor) : '-';
    
    let rowClass = '';
    if (isTotal) rowClass = 'class="total-row"';
    else if (isSubtotal) rowClass = 'class="subtotal-row"';
    
    html += `<tr ${rowClass}><td>${indent}${conta.descricao}</td><td>${valor}</td></tr>`;
    
    if (conta.children?.length) {
      conta.children.forEach(child => processar(child, nivel + 1));
    }
  }
  
  contas.forEach(conta => processar(conta, 0));
  return html;
}

function generateReportHTML(
  companyName: string,
  dre: ContaComValor[],
  bp: ContaComValor[],
  resultadoDRE: number,
  totalPassivoPL: number,
  periodo: string
): string {
  const currentDate = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  // Calcular índices
  const indices = calcularIndices(bp, dre);
  const indicesPDF = indicesParaPDF(indices);
  const valores = extrairValoresPrincipais(dre, bp);

  const codigoAtivo = encontrarCodigoPorDescricao(bp, [['ativo']], '1');
  const codigoPassivo = encontrarCodigoPorDescricao(bp, [['passivo']], '76');
  const codigoPL = encontrarCodigoPorDescricao(bp, [['patrimonio', 'liquido']], '125');

  // Função para gerar card de índice apenas se disponível
  const gerarCardIndice = (nome: string, valor: number | undefined, formato: 'numero' | 'percentual' = 'numero'): string => {
    if (valor === undefined) return '';
    const valorFormatado = formato === 'percentual' ? formatPercent(valor) : formatNumber(valor);
    return `
      <div class="index-card">
        <div class="name">${nome}</div>
        <div class="value">${valorFormatado}</div>
      </div>
    `;
  };

  // Função para gerar linha de índice na tabela apenas se disponível
  const gerarLinhaIndice = (nome: string, valor: number | undefined, formato: 'numero' | 'percentual' = 'numero', descricao: string = ''): string => {
    if (valor === undefined) return '';
    const valorFormatado = formato === 'percentual' ? formatPercent(valor) : formatNumber(valor);
    return `<tr><td>${nome}</td><td>${valorFormatado}</td><td>${descricao}</td></tr>`;
  };

  // Gerar seção de índices indisponíveis
  const gerarIndicesIndisponiveis = (): string => {
    const motivos = indicesPDF.indisponiveisMotivos;
    if (Object.keys(motivos).length === 0) return '';
    
    let html = '<div class="unavailable-indices"><h4>Índices Não Calculados</h4><ul>';
    for (const [nome, motivo] of Object.entries(motivos)) {
      html += `<li><strong>${nome}:</strong> ${motivo}</li>`;
    }
    html += '</ul></div>';
    return html;
  };

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Financeiro - ${companyName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; line-height: 1.4; color: #1f2937; background: #fff; }
    .page { padding: 30px 35px; page-break-after: always; min-height: 100vh; }
    .page:last-child { page-break-after: avoid; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 16px; color: #1e40af; font-weight: 700; }
    .header .date { font-size: 10px; color: #6b7280; }
    .section-title { font-size: 14px; color: #1e40af; font-weight: 600; margin: 15px 0 10px 0; padding-bottom: 5px; border-bottom: 2px solid #dbeafe; }
    .subsection-title { font-size: 12px; color: #374151; font-weight: 600; margin: 12px 0 6px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px; }
    th, td { padding: 5px 8px; text-align: left; border: 1px solid #e5e7eb; }
    th { background: #1e40af; color: white; font-weight: 600; text-align: center; }
    th:first-child { text-align: left; }
    td { text-align: right; }
    td:first-child { text-align: left; font-weight: 500; }
    tr:nth-child(even) { background: #f9fafb; }
    tr.group-header { background: #dbeafe !important; font-weight: 600; }
    tr.total-row { background: #1e3a5f !important; color: white; font-weight: 700; }
    tr.subtotal-row { background: #e0e7ff !important; font-weight: 600; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
    .kpi-card { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: white; padding: 12px; border-radius: 6px; text-align: center; }
    .kpi-card .label { font-size: 9px; opacity: 0.9; margin-bottom: 4px; }
    .kpi-card .value { font-size: 14px; font-weight: 700; }
    .indices-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
    .index-card { border: 1px solid #e5e7eb; border-radius: 5px; padding: 8px; background: #f9fafb; text-align: center; }
    .index-card .name { font-size: 8px; font-weight: 600; color: #374151; margin-bottom: 4px; }
    .index-card .value { font-size: 12px; font-weight: 700; color: #1e40af; }
    .analysis-box { background: #f0f9ff; border-left: 4px solid #1e40af; padding: 10px; margin: 10px 0; font-size: 9px; }
    .unavailable-indices { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px; margin: 10px 0; font-size: 8px; }
    .unavailable-indices h4 { color: #92400e; margin-bottom: 5px; }
    .unavailable-indices ul { margin-left: 15px; color: #78350f; }
    .unavailable-indices li { margin-bottom: 3px; }
    .cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; text-align: center; }
    .cover-page h1 { font-size: 24px; color: #1e40af; margin-bottom: 8px; }
    .cover-page h2 { font-size: 16px; color: #374151; font-weight: 400; margin-bottom: 25px; }
    .cover-page .period { font-size: 14px; color: #6b7280; margin-bottom: 40px; }
    .cover-page .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); border-radius: 16px; display: flex; align-items: center; justify-content: center; margin-bottom: 25px; }
    .cover-page .logo span { font-size: 36px; color: white; }
    .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 8px; color: #9ca3af; }
  </style>
</head>
<body>
  <!-- CAPA -->
  <div class="page cover-page">
    <div class="logo"><span>⚽</span></div>
    <h1>${companyName}</h1>
    <h2>Relatório de Análise Financeira</h2>
    <div class="period">Período: ${periodo}</div>
    <p style="color: #9ca3af; font-size: 11px;">Gerado em ${currentDate}</p>
    <div style="margin-top: 40px; padding: 15px; background: #f0f9ff; border-radius: 8px; max-width: 400px;">
      <p style="font-size: 10px; color: #374151; margin-bottom: 8px;"><strong>Este relatório contém:</strong></p>
      <p style="font-size: 9px; color: #6b7280; line-height: 1.6;">
        • Resumo Executivo e KPIs<br>
        • Balanço Patrimonial Completo<br>
        • Demonstração do Resultado (DRE)<br>
        • Índices de Liquidez, Rentabilidade, Endividamento e Atividade
      </p>
    </div>
  </div>

  <!-- PÁGINA 1: RESUMO EXECUTIVO -->
  <div class="page">
    <div class="header">
      <h1>1. Resumo Executivo</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="label">Receita Total</div>
        <div class="value">${formatCurrency(valores.receitasTotal)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Resultado Líquido</div>
        <div class="value">${formatCurrency(resultadoDRE)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Ativo Total</div>
        <div class="value">${formatCurrency(valores.ativoTotal)}</div>
      </div>
      <div class="kpi-card">
        <div class="label">Patrimônio Líquido</div>
        <div class="value">${formatCurrency(valores.patrimonioLiquido)}</div>
      </div>
    </div>

    <div class="section-title">Principais Índices</div>
    <div class="indices-grid">
      ${gerarCardIndice('Liquidez Corrente', indicesPDF.liquidez.corrente)}
      ${gerarCardIndice('Liquidez Seca', indicesPDF.liquidez.seca)}
      ${gerarCardIndice('Liquidez Imediata', indicesPDF.liquidez.imediata)}
      ${gerarCardIndice('Liquidez Geral', indicesPDF.liquidez.geral)}
      ${gerarCardIndice('Margem Bruta', indicesPDF.rentabilidade.margemBruta, 'percentual')}
      ${gerarCardIndice('Margem Operacional', indicesPDF.rentabilidade.margemOp, 'percentual')}
      ${gerarCardIndice('Margem Líquida', indicesPDF.rentabilidade.margemLiq, 'percentual')}
      ${gerarCardIndice('ROA', indicesPDF.rentabilidade.roa, 'percentual')}
      ${gerarCardIndice('ROE', indicesPDF.rentabilidade.roe, 'percentual')}
      ${gerarCardIndice('Endiv. Geral', indicesPDF.endividamento.geral, 'percentual')}
      ${gerarCardIndice('Grau Alavancagem', indicesPDF.endividamento.alavancagem)}
      ${gerarCardIndice('Giro do Ativo', indicesPDF.atividade.giroAtivo)}
    </div>

    <div class="analysis-box">
      <strong>Análise:</strong> Este relatório apresenta a situação financeira da ${companyName} 
      com base nos dados do período ${periodo}. Os índices financeiros foram calculados a partir 
      das demonstrações contábeis processadas do balancete.
    </div>

    ${gerarIndicesIndisponiveis()}
  </div>

  <!-- PÁGINA 2: BALANÇO PATRIMONIAL -->
  <div class="page">
    <div class="header">
      <h1>2. Balanço Patrimonial</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <div class="subsection-title">ATIVO</div>
    <table>
      <tr>
        <th style="width: 70%;">Conta</th>
        <th>Valor</th>
      </tr>
      ${gerarLinhasTabela(bp.filter(c => c.codigo === codigoAtivo), 3)}
    </table>

    <div class="subsection-title">PASSIVO</div>
    <table>
      <tr>
        <th style="width: 70%;">Conta</th>
        <th>Valor</th>
      </tr>
      ${gerarLinhasTabela(bp.filter(c => c.codigo === codigoPassivo), 3)}
    </table>

    <div class="subsection-title">PATRIMÔNIO LÍQUIDO</div>
    <table>
      <tr>
        <th style="width: 70%;">Conta</th>
        <th>Valor</th>
      </tr>
      ${gerarLinhasTabela(bp.filter(c => c.codigo === codigoPL), 3)}
    </table>
  </div>

  <!-- PÁGINA 3: DRE -->
  <div class="page">
    <div class="header">
      <h1>3. Demonstração do Resultado do Exercício (DRE)</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 70%;">Conta</th>
        <th>Valor</th>
      </tr>
      ${gerarLinhasTabela(dre, 3)}
    </table>

    <table>
      <tr class="total-row">
        <td style="width: 70%;">RESULTADO LÍQUIDO DO EXERCÍCIO</td>
        <td>${formatCurrency(resultadoDRE)}</td>
      </tr>
    </table>

    <div class="analysis-box">
      <strong>Análise da DRE:</strong> 
      ${valores.receitasTotal ? `Receita total de ${formatCurrency(valores.receitasTotal)}.` : ''}
      ${valores.custosTotal ? ` Custos de ${formatCurrency(valores.custosTotal)}.` : ''}
      ${valores.despesasTotal ? ` Despesas de ${formatCurrency(valores.despesasTotal)}.` : ''}
      Resultado líquido de ${formatCurrency(resultadoDRE)}.
    </div>
  </div>

  <!-- PÁGINA 4: ÍNDICES DE LIQUIDEZ -->
  <div class="page">
    <div class="header">
      <h1>4. Índices de Liquidez</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 30%;">Indicador</th>
        <th style="width: 20%;">Valor</th>
        <th style="width: 50%;">Interpretação</th>
      </tr>
      ${gerarLinhaIndice('Liquidez Corrente', indicesPDF.liquidez.corrente, 'numero', 'Capacidade de pagar dívidas de curto prazo. Ideal > 1,0')}
      ${gerarLinhaIndice('Liquidez Seca', indicesPDF.liquidez.seca, 'numero', 'Liquidez excluindo estoques. Ideal > 1,0')}
      ${gerarLinhaIndice('Liquidez Imediata', indicesPDF.liquidez.imediata, 'numero', 'Disponibilidades / PC. Ideal > 0,3')}
      ${gerarLinhaIndice('Liquidez Geral', indicesPDF.liquidez.geral, 'numero', 'Capacidade de longo prazo. Ideal > 1,0')}
    </table>

    <div class="analysis-box">
      <strong>Análise:</strong> Os índices de liquidez medem a capacidade da federação de honrar seus compromissos financeiros. 
      ${indicesPDF.liquidez.corrente !== undefined && indicesPDF.liquidez.corrente > 1 ? 'A liquidez corrente está em nível saudável.' : ''}
      ${indicesPDF.liquidez.corrente !== undefined && indicesPDF.liquidez.corrente < 1 ? 'Atenção: liquidez corrente abaixo de 1 indica possível dificuldade de pagamento.' : ''}
    </div>
  </div>

  <!-- PÁGINA 5: ÍNDICES DE RENTABILIDADE -->
  <div class="page">
    <div class="header">
      <h1>5. Índices de Rentabilidade</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 30%;">Indicador</th>
        <th style="width: 20%;">Valor</th>
        <th style="width: 50%;">Interpretação</th>
      </tr>
      ${gerarLinhaIndice('Margem Bruta', indicesPDF.rentabilidade.margemBruta, 'percentual', '(Receitas - Custos) / Receitas')}
      ${gerarLinhaIndice('Margem Operacional', indicesPDF.rentabilidade.margemOp, 'percentual', 'Resultado Operacional / Receitas')}
      ${gerarLinhaIndice('Margem Líquida', indicesPDF.rentabilidade.margemLiq, 'percentual', 'Resultado Líquido / Receitas')}
      ${gerarLinhaIndice('Margem EBITDA', indicesPDF.rentabilidade.margemEbitda, 'percentual', 'EBITDA / Receitas (aproximado)')}
      ${gerarLinhaIndice('ROA', indicesPDF.rentabilidade.roa, 'percentual', 'Resultado Líquido / Ativo Total')}
      ${gerarLinhaIndice('ROE', indicesPDF.rentabilidade.roe, 'percentual', 'Resultado Líquido / Patrimônio Líquido')}
    </table>

    <div class="analysis-box">
      <strong>Análise:</strong> Os índices de rentabilidade avaliam a eficiência da federação em gerar resultados.
      ${indicesPDF.rentabilidade.margemLiq !== undefined && indicesPDF.rentabilidade.margemLiq > 0 ? ' A margem líquida positiva indica operação superávitária.' : ''}
      ${indicesPDF.rentabilidade.margemLiq !== undefined && indicesPDF.rentabilidade.margemLiq < 0 ? ' Atenção: margem líquida negativa indica operação deficitária.' : ''}
    </div>
  </div>

  <!-- PÁGINA 6: ÍNDICES DE ENDIVIDAMENTO -->
  <div class="page">
    <div class="header">
      <h1>6. Índices de Endividamento</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 30%;">Indicador</th>
        <th style="width: 20%;">Valor</th>
        <th style="width: 50%;">Interpretação</th>
      </tr>
      ${gerarLinhaIndice('Endividamento Geral', indicesPDF.endividamento.geral, 'percentual', '(PC + PNC) / Ativo Total')}
      ${gerarLinhaIndice('Composição do Endividamento', indicesPDF.endividamento.composicao, 'percentual', 'PC / (PC + PNC) - % dívidas de curto prazo')}
      ${gerarLinhaIndice('Grau de Alavancagem', indicesPDF.endividamento.alavancagem, 'numero', '(PC + PNC) / PL')}
      ${gerarLinhaIndice('Imobilização do PL', indicesPDF.endividamento.imobilizacaoPL, 'percentual', 'Imobilizado / PL')}
    </table>

    <div class="analysis-box">
      <strong>Análise:</strong> Os índices de endividamento medem o grau de utilização de capital de terceiros.
      ${indicesPDF.endividamento.geral !== undefined && indicesPDF.endividamento.geral < 50 ? ' O endividamento está em nível controlado (< 50%).' : ''}
      ${indicesPDF.endividamento.geral !== undefined && indicesPDF.endividamento.geral >= 50 ? ' Atenção: endividamento elevado (≥ 50%).' : ''}
    </div>
  </div>

  <!-- PÁGINA 7: ÍNDICES DE ATIVIDADE -->
  <div class="page">
    <div class="header">
      <h1>7. Índices de Atividade</h1>
      <div class="date">${companyName} | ${currentDate}</div>
    </div>

    <table>
      <tr>
        <th style="width: 30%;">Indicador</th>
        <th style="width: 20%;">Valor</th>
        <th style="width: 50%;">Interpretação</th>
      </tr>
      ${gerarLinhaIndice('Giro do Ativo', indicesPDF.atividade.giroAtivo, 'numero', 'Receitas / Ativo Total - eficiência do uso dos ativos')}
      ${gerarLinhaIndice('Prazo Médio de Recebimento', indicesPDF.atividade.pmr, 'numero', '(Contas a Receber / Receitas) x 360 dias')}
      ${gerarLinhaIndice('Prazo Médio de Pagamento', indicesPDF.atividade.pmp, 'numero', '(Fornecedores / Custos) x 360 dias')}
    </table>

    <div class="analysis-box">
      <strong>Análise:</strong> Os índices de atividade avaliam a eficiência operacional da federação.
      ${indicesPDF.atividade.giroAtivo !== undefined ? ` O giro do ativo de ${formatNumber(indicesPDF.atividade.giroAtivo)} indica quantas vezes o ativo foi "girado" em receitas no período.` : ''}
    </div>

    ${gerarIndicesIndisponiveis()}

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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, year } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'ID da empresa é obrigatório' }, { status: 400 });
    }

    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Buscar dados do balancete
    // year vem como "2025" (4 dígitos), períodos são "JAN/25" (2 dígitos)
    const yearShort = year ? year.slice(-2) : '25';
    
    // Compatibilidade: tentar balancete ou balanceteRow
    const balanceteModel = (prisma as any).balancete ?? (prisma as any).balanceteRow;
    const balancetes = await balanceteModel.findMany({
      where: {
        companyId,
        period: { contains: `/${yearShort}` }
      },
      orderBy: { accountCode: 'asc' }
    });

    if (balancetes.length === 0) {
      return NextResponse.json({ 
        error: `Nenhum dado de balancete encontrado para o ano ${yearShort}` 
      }, { status: 404 });
    }

    // Processar dados financeiros
    const deParaRows = await prisma.deParaMapping.findMany({
  where: { companyId },
  select: { contaFederacao: true, padraoBP: true, padraoDRE: true, padraoDFC: true, padraoDMPL: true },
});
const deParaRecords: DeParaRecord[] = deParaRows.map(r => ({
  contaFederacao: r.contaFederacao,
  padraoBP: r.padraoBP,
  padraoDRE: r.padraoDRE,
  padraoDFC: r.padraoDFC,
  padraoDMPL: r.padraoDMPL,
}));
    const { dre, bp, resultadoDRE, totalPassivoPL } = await processarDadosFinanceiros(balancetes, deParaRecords);
    const dreApresentacao = ordenarArvoreDreReceitaBrutaPrimeiro(dre);

    // Gerar HTML
    const periodo = year || `20${yearShort}`;
    const html = generateReportHTML(
      company.name,
      dreApresentacao,
      bp,
      resultadoDRE,
      totalPassivoPL,
      periodo
    );

    // Verificar se API de PDF está configurada
    const html2pdfUrl =
      process.env.HTML2PDF_API_URL ||
      process.env.NEXT_PUBLIC_HTML2PDF_API_URL ||
      process.env.HTML2PDF_URL ||
      process.env.NEXT_PUBLIC_HTML2PDF_URL ||
      process.env.PDF_API_URL ||
      process.env.NEXT_PUBLIC_PDF_API_URL;

    const html2pdfKey =
      process.env.HTML2PDF_API_KEY ||
      process.env.NEXT_PUBLIC_HTML2PDF_API_KEY ||
      process.env.HTML2PDF_KEY ||
      process.env.NEXT_PUBLIC_HTML2PDF_KEY ||
      process.env.PDF_API_KEY ||
      process.env.NEXT_PUBLIC_PDF_API_KEY;

    if (!html2pdfUrl) {
      return NextResponse.json({
        error: 'Serviço de geração de PDF não configurado. Defina uma URL em HTML2PDF_API_URL (ou HTML2PDF_URL / PDF_API_URL).'
      }, { status: 500 });
    }

    const isHtml2PdfApp = /api\.html2pdf\.app/i.test(html2pdfUrl);

    // Gerar PDF via API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (html2pdfKey && !isHtml2PdfApp) {
      headers['Authorization'] = `Bearer ${html2pdfKey}`;
    }

    const payload = isHtml2PdfApp
      ? {
          html,
          apiKey: html2pdfKey,
          format: 'A4',
        }
      : {
          html,
          options: {
            format: 'A4',
            margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            printBackground: true,
          },
        };

    const pdfResponse = await fetch(html2pdfUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('Erro ao gerar PDF:', errorText);
      return NextResponse.json({
        error: `Falha no serviço de PDF: ${errorText || 'erro desconhecido'}`
      }, { status: 502 });
    }

    // Verificar se é resposta assíncrona (job)
    const contentType = pdfResponse.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const jobData = await pdfResponse.json();
      
      // Polling para obter o PDF
      let attempts = 0;
      const maxAttempts = 30;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const statusHeaders: Record<string, string> = {};
        if (html2pdfKey && !isHtml2PdfApp) {
          statusHeaders['Authorization'] = `Bearer ${html2pdfKey}`;
        }

        const statusResponse = await fetch(`${html2pdfUrl}/status/${jobData.jobId}`, {
          headers: statusHeaders
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          
          if (statusData.status === 'completed' && statusData.pdfUrl) {
            const pdfDownload = await fetch(statusData.pdfUrl);
            const downloadType = pdfDownload.headers.get('content-type') || '';
            if (!downloadType.includes('application/pdf')) {
              const invalidBody = await pdfDownload.text();
              throw new Error(`Resposta inválida do serviço de PDF: ${invalidBody.slice(0, 200)}`);
            }
            const pdfBuffer = await pdfDownload.arrayBuffer();
            
            return new NextResponse(pdfBuffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="relatorio_${company.name.replace(/\s+/g, '_')}_${periodo}.pdf"`
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

    // Resposta direta com PDF
    if (!contentType?.includes('application/pdf')) {
      const invalidBody = await pdfResponse.text();
      return NextResponse.json({
        error: `Serviço retornou conteúdo não-PDF: ${invalidBody.slice(0, 200)}`
      }, { status: 502 });
    }
    const pdfBuffer = await pdfResponse.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="relatorio_${company.name.replace(/\s+/g, '_')}_${periodo}.pdf"`
      }
    });

  } catch (error) {
    const { status, body } = handleApiError(error);
    // augment message for this context
    body.error = body.error || 'Erro ao gerar relatório';
    return NextResponse.json(body, { status });
  }
}
