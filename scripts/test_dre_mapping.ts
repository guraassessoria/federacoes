import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Mapeamento atual da DRE
const MAPEAMENTO_DRE_PREFIXOS = [
  { prefixo: '3.1.11.200', codigoPadrao: '40', descricao: 'Outras Receitas Operacionais' },
  { prefixo: '3.1.11.400', codigoPadrao: '191', descricao: 'Receitas Financeiras' },
  { prefixo: '3.1.11', codigoPadrao: '2', descricao: 'Receitas de Competições' },
  { prefixo: '3.1', codigoPadrao: '1', descricao: 'RECEITAS' },
  { prefixo: '3', codigoPadrao: '1', descricao: 'RECEITAS' },
  { prefixo: '4.2.11.100.001', codigoPadrao: '106', descricao: 'Salários e Ordenados' },
  { prefixo: '4.2.11.100.003', codigoPadrao: '106', descricao: 'Férias' },
  { prefixo: '4.2.11.100.004', codigoPadrao: '106', descricao: '13º Salário' },
  { prefixo: '4.2.11.100.005', codigoPadrao: '111', descricao: 'INSS' },
  { prefixo: '4.2.11.100.006', codigoPadrao: '111', descricao: 'FGTS' },
  { prefixo: '4.2.11.100.011', codigoPadrao: '111', descricao: 'Outros Encargos' },
  { prefixo: '4.2.11.100.012', codigoPadrao: '115', descricao: 'Vale Transporte' },
  { prefixo: '4.2.11.100', codigoPadrao: '105', descricao: 'Despesas com Pessoal' },
  { prefixo: '4.2.11.200', codigoPadrao: '126', descricao: 'Instalações' },
  { prefixo: '4.2.11.300.001', codigoPadrao: '131', descricao: 'Energia Elétrica' },
  { prefixo: '4.2.11.300.002', codigoPadrao: '131', descricao: 'Água' },
  { prefixo: '4.2.11.300.003', codigoPadrao: '131', descricao: 'Telefone/Internet' },
  { prefixo: '4.2.11.300.007', codigoPadrao: '155', descricao: 'Seguros' },
  { prefixo: '4.2.11.300', codigoPadrao: '131', descricao: 'Utilidades' },
  { prefixo: '4.2.11.500.001', codigoPadrao: '158', descricao: 'Viagens Administrativas' },
  { prefixo: '4.2.11.500.002', codigoPadrao: '136', descricao: 'Material de Escritório' },
  { prefixo: '4.2.11.500.003', codigoPadrao: '69', descricao: 'Material Esportivo' },
  { prefixo: '4.2.11.500.006', codigoPadrao: '164', descricao: 'Marketing e Publicidade' },
  { prefixo: '4.2.11.500.013', codigoPadrao: '65', descricao: 'Premiações' },
  { prefixo: '4.2.11.500.014', codigoPadrao: '139', descricao: 'Serviços de Terceiros PJ' },
  { prefixo: '4.2.11.500.015', codigoPadrao: '139', descricao: 'Serviços de Terceiros PF' },
  { prefixo: '4.2.11.500.020', codigoPadrao: '105', descricao: 'Ajuda de Custo (Pessoal)' },
  { prefixo: '4.2.11.500.022', codigoPadrao: '54', descricao: 'Despesa de Jogos (Organização)' },
  { prefixo: '4.2.11.500.026', codigoPadrao: '60', descricao: 'Arbitragem' },
  { prefixo: '4.2.11.500.028', codigoPadrao: '54', descricao: 'CBF/Federações' },
  { prefixo: '4.2.11.500', codigoPadrao: '125', descricao: 'Despesas Administrativas' },
  { prefixo: '4.2.11.600', codigoPadrao: '199', descricao: 'Despesas Financeiras' },
  { prefixo: '4.2.11.700', codigoPadrao: '180', descricao: 'Tributos e Taxas' },
  { prefixo: '4.2.11.800', codigoPadrao: '53', descricao: 'Custos com Competições' },
  { prefixo: '4.2.11.8', codigoPadrao: '53', descricao: 'Custos com Competições' },
  { prefixo: '4.2.11.900', codigoPadrao: '60', descricao: 'Arbitragem (Departamento)' },
  { prefixo: '4.2.11.9', codigoPadrao: '60', descricao: 'Arbitragem' },
  { prefixo: '4.2.11', codigoPadrao: '104', descricao: 'DESPESAS' },
  { prefixo: '4.2', codigoPadrao: '104', descricao: 'DESPESAS' },
  { prefixo: '4', codigoPadrao: '52', descricao: 'CUSTOS' },
];

function eFilho(codigoPai: string, codigoFilho: string): boolean {
  if (codigoFilho.startsWith(codigoPai + '.')) return true;
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  if (partesFilho.length < partesPai.length) return false;
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) return false;
  }
  const ultimaPartePai = partesPai[partesPai.length - 1];
  const parteCorrespondente = partesFilho[partesPai.length - 1];
  if (parteCorrespondente.startsWith(ultimaPartePai)) {
    if (parteCorrespondente.length > ultimaPartePai.length) return true;
    if (partesFilho.length > partesPai.length) return true;
  }
  return false;
}

function encontrarCodigoPadrao(accountNumber: string): { codigo: string; descricao: string } | null {
  const ordenado = [...MAPEAMENTO_DRE_PREFIXOS].sort((a, b) => b.prefixo.length - a.prefixo.length);
  for (const map of ordenado) {
    if (accountNumber.startsWith(map.prefixo)) {
      return { codigo: map.codigoPadrao, descricao: map.descricao };
    }
  }
  return null;
}

async function main() {
  const contas = await prisma.balancete.findMany({
    where: { period: { contains: '25' } },
    select: { accountCode: true, accountDescription: true, closingBalance: true },
    distinct: ['accountCode'],
    orderBy: { accountCode: 'asc' }
  });
  
  const todosCodigos = [...new Set(contas.map(c => c.accountCode))];
  const folhas = contas.filter(conta => {
    for (const codigo of todosCodigos) {
      if (codigo === conta.accountCode) continue;
      if (eFilho(conta.accountCode, codigo)) return false;
    }
    return true;
  });
  
  console.log('=== CONTAS FOLHAS DRE ===');
  console.log('\n--- RECEITAS (3.x) ---');
  folhas.filter(c => c.accountCode.startsWith('3')).forEach(c => {
    const mapping = encontrarCodigoPadrao(c.accountCode);
    console.log(`${c.accountCode.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${String(c.closingBalance).padStart(15)} | -> ${mapping?.codigo || 'SEM'} (${mapping?.descricao || 'N/A'})`);
  });
  
  console.log('\n--- CUSTOS/DESPESAS (4.x) ---');
  folhas.filter(c => c.accountCode.startsWith('4')).forEach(c => {
    const mapping = encontrarCodigoPadrao(c.accountCode);
    console.log(`${c.accountCode.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${String(c.closingBalance).padStart(15)} | -> ${mapping?.codigo || 'SEM'} (${mapping?.descricao || 'N/A'})`);
  });
  
  // Agrupar por código padrão
  const valoresPorCodigo: Record<string, { total: number; contas: string[] }> = {};
  
  for (const conta of folhas.filter(c => c.accountCode.startsWith('3') || c.accountCode.startsWith('4'))) {
    const mapping = encontrarCodigoPadrao(conta.accountCode);
    const valor = Number(conta.closingBalance);
    
    if (mapping) {
      if (!valoresPorCodigo[mapping.codigo]) {
        valoresPorCodigo[mapping.codigo] = { total: 0, contas: [] };
      }
      valoresPorCodigo[mapping.codigo].total += valor;
      valoresPorCodigo[mapping.codigo].contas.push(
        `${conta.accountCode} = ${valor.toLocaleString('pt-BR')}`
      );
    }
  }
  
  console.log('\n=== RESUMO POR CÓDIGO PADRÃO ===');
  const codigosOrdenados = Object.keys(valoresPorCodigo).sort((a, b) => parseInt(a) - parseInt(b));
  
  for (const codigo of codigosOrdenados) {
    const info = valoresPorCodigo[codigo];
    const mapping = MAPEAMENTO_DRE_PREFIXOS.find(m => m.codigoPadrao === codigo);
    console.log(`\nCÓDIGO ${codigo} - ${mapping?.descricao || 'N/A'}`);
    console.log(`TOTAL: R$ ${info.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  }
  
  // Totais
  const totalReceitas = folhas.filter(c => c.accountCode.startsWith('3')).reduce((s, c) => s + Number(c.closingBalance), 0);
  const totalCustos = folhas.filter(c => c.accountCode.startsWith('4')).reduce((s, c) => s + Number(c.closingBalance), 0);
  
  console.log('\n=== TOTAIS DO BALANCETE ===');
  console.log(`RECEITAS (soma folhas): ${totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`CUSTOS (soma folhas): ${totalCustos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`RESULTADO: ${(totalReceitas + totalCustos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  // Verificar conta raiz
  const receitaRaiz = contas.find(c => c.accountNumber === '3');
  const custoRaiz = contas.find(c => c.accountNumber === '4');
  console.log('\n=== CONTAS RAIZ (verificação) ===');
  console.log(`RECEITAS (3): ${receitaRaiz?.closingBalance}`);
  console.log(`CUSTOS (4): ${custoRaiz?.closingBalance}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
