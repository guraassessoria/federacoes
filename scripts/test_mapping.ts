import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Mapeamentos atualizados
const MAPEAMENTO_BP_PREFIXOS = [
  { prefixo: '1.1.10.100', codigoPadrao: '4', descricao: 'Caixa' },
  { prefixo: '1.1.10.200', codigoPadrao: '5', descricao: 'Bancos Conta Movimento' },
  { prefixo: '1.1.10.300', codigoPadrao: '6', descricao: 'Aplicações Financeiras' },
  { prefixo: '1.1.10', codigoPadrao: '3', descricao: 'Disponibilidades' },
  { prefixo: '1.1.20.100', codigoPadrao: '15', descricao: 'Outras Contas a Receber' },
  { prefixo: '1.1.20', codigoPadrao: '7', descricao: 'Contas a Receber' },
  { prefixo: '1.1.30', codigoPadrao: '17', descricao: 'Estoques' },
  { prefixo: '1.1', codigoPadrao: '2', descricao: 'Ativo Circulante' },
  { prefixo: '1.2.21.100', codigoPadrao: '55', descricao: 'Equipamentos' },
  { prefixo: '1.2.21.200', codigoPadrao: '45', descricao: 'Edificações' },
  { prefixo: '1.2.21.300', codigoPadrao: '64', descricao: 'Móveis e Utensílios' },
  { prefixo: '1.2.21.31', codigoPadrao: '60', descricao: 'Veículos' },
  { prefixo: '1.2.21.500.005', codigoPadrao: '59', descricao: 'Depreciação de Equipamentos (Informática)' },
  { prefixo: '1.2.21.500.006', codigoPadrao: '59', descricao: 'Depreciação de Equipamentos (Som)' },
  { prefixo: '1.2.21.500.100', codigoPadrao: '59', descricao: 'Depreciação de Equipamentos' },
  { prefixo: '1.2.21.500.200', codigoPadrao: '48', descricao: 'Depreciação de Edificações' },
  { prefixo: '1.2.21.500.300', codigoPadrao: '67', descricao: 'Depreciação de Móveis e Utensílios' },
  { prefixo: '1.2.21.500.500', codigoPadrao: '59', descricao: 'Depreciação de Equipamentos (Comunicação)' },
  { prefixo: '1.2.21.500.600', codigoPadrao: '63', descricao: 'Depreciação de Veículos' },
  { prefixo: '1.2.21', codigoPadrao: '43', descricao: 'Imobilizado' },
  { prefixo: '1.2', codigoPadrao: '33', descricao: 'Ativo Não Circulante' },
  { prefixo: '1', codigoPadrao: '1', descricao: 'ATIVO' },
  { prefixo: '2.1.20.100', codigoPadrao: '79', descricao: 'Fornecedores Nacionais' },
  { prefixo: '2.1.20.200.001', codigoPadrao: '83', descricao: 'INSS a Recolher' },
  { prefixo: '2.1.20.200.002', codigoPadrao: '84', descricao: 'FGTS a Recolher' },
  { prefixo: '2.1.20.200.010', codigoPadrao: '87', descricao: 'PIS a Recolher' },
  { prefixo: '2.1.20.200', codigoPadrao: '81', descricao: 'Obrigações Trabalhistas' },
  { prefixo: '2.1.20.400', codigoPadrao: '82', descricao: 'Salários a Pagar' },
  { prefixo: '2.1.20', codigoPadrao: '96', descricao: 'Contas a Pagar' },
  { prefixo: '2.1', codigoPadrao: '77', descricao: 'Passivo Circulante' },
  { prefixo: '2.2.11.100', codigoPadrao: '127', descricao: 'Capital Subscrito' },
  { prefixo: '2.2.11.300', codigoPadrao: '141', descricao: 'Superávits/Déficits Acumulados' },
  { prefixo: '2.2.11', codigoPadrao: '126', descricao: 'Capital Social / Patrimônio Social' },
  { prefixo: '2.2', codigoPadrao: '125', descricao: 'PATRIMÔNIO LÍQUIDO' },
  { prefixo: '2', codigoPadrao: '76', descricao: 'PASSIVO' },
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
  const ordenado = [...MAPEAMENTO_BP_PREFIXOS].sort((a, b) => b.prefixo.length - a.prefixo.length);
  for (const map of ordenado) {
    if (accountNumber.startsWith(map.prefixo)) {
      return { codigo: map.codigoPadrao, descricao: map.descricao };
    }
  }
  return null;
}

function ajustarSinal(valor: number, accountNumber: string): number {
  const firstChar = accountNumber.charAt(0);
  // Inverter sinal para Passivo/PL (2) e Receitas (3)
  if (firstChar === '2' || firstChar === '3') return valor * -1;
  return valor;
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
  
  // Agrupar por código padrão
  const valoresPorCodigo: Record<string, { total: number; contas: string[] }> = {};
  
  for (const conta of folhas.filter(c => c.accountCode.startsWith('1') || c.accountCode.startsWith('2'))) {
    const mapping = encontrarCodigoPadrao(conta.accountCode);
    const valorAjustado = ajustarSinal(Number(conta.closingBalance), conta.accountCode);
    
    if (mapping) {
      if (!valoresPorCodigo[mapping.codigo]) {
        valoresPorCodigo[mapping.codigo] = { total: 0, contas: [] };
      }
      valoresPorCodigo[mapping.codigo].total += valorAjustado;
      valoresPorCodigo[mapping.codigo].contas.push(
        `${conta.accountCode} (${conta.accountDescription?.substring(0, 25)}) = ${valorAjustado.toLocaleString('pt-BR')}`
      );
    } else {
      console.log(`SEM MAPEAMENTO: ${conta.accountCode} = ${valorAjustado}`);
    }
  }
  
  console.log('=== MAPEAMENTO POR CÓDIGO PADRÃO (BP) ===\n');
  const codigosOrdenados = Object.keys(valoresPorCodigo).sort((a, b) => parseInt(a) - parseInt(b));
  
  for (const codigo of codigosOrdenados) {
    const info = valoresPorCodigo[codigo];
    const mapping = MAPEAMENTO_BP_PREFIXOS.find(m => m.codigoPadrao === codigo);
    console.log(`\nCÓDIGO ${codigo} - ${mapping?.descricao || 'N/A'}`);
    console.log(`TOTAL: R$ ${info.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log('Contas:');
    info.contas.forEach(c => console.log(`  - ${c}`));
  }
  
  // Calcular totais principais
  let totalAtivo = 0;
  let totalPassivo = 0;
  let totalPL = 0;
  
  for (const [codigo, info] of Object.entries(valoresPorCodigo)) {
    const num = parseInt(codigo);
    // ATIVO: códigos < 76
    if (num < 76) totalAtivo += info.total;
    // PASSIVO: códigos 76-124
    else if (num >= 76 && num < 125) totalPassivo += info.total;
    // PL: códigos >= 125
    else totalPL += info.total;
  }
  
  console.log('\n=== RESUMO FINAL ===');
  console.log(`ATIVO: R$ ${totalAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`PASSIVO: R$ ${totalPassivo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`PATRIMÔNIO LÍQUIDO: R$ ${totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`\nATIVO = PASSIVO + PL? ${(Math.abs(totalAtivo - (totalPassivo + totalPL)) < 0.01) ? 'SIM ✓' : 'NÃO ✗'} (Diferença: ${(totalAtivo - (totalPassivo + totalPL)).toFixed(2)})`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
