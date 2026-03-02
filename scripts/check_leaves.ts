import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

function eFilho(codigoPai: string, codigoFilho: string): boolean {
  if (codigoFilho.startsWith(codigoPai + '.')) {
    return true;
  }
  const partesPai = codigoPai.split('.');
  const partesFilho = codigoFilho.split('.');
  if (partesFilho.length < partesPai.length) {
    return false;
  }
  for (let i = 0; i < partesPai.length - 1; i++) {
    if (partesPai[i] !== partesFilho[i]) {
      return false;
    }
  }
  const ultimaPartePai = partesPai[partesPai.length - 1];
  const parteCorrespondente = partesFilho[partesPai.length - 1];
  if (parteCorrespondente.startsWith(ultimaPartePai)) {
    if (parteCorrespondente.length > ultimaPartePai.length) {
      return true;
    }
    if (partesFilho.length > partesPai.length) {
      return true;
    }
  }
  return false;
}

async function main() {
  const contas = await prisma.balancete.findMany({
    where: { period: { contains: '25' } },
    select: { accountNumber: true, accountDescription: true, finalBalance: true },
    distinct: ['accountNumber'],
    orderBy: { accountNumber: 'asc' }
  });
  
  const todosCodigos = [...new Set(contas.map(c => c.accountNumber))];
  
  // Identificar folhas
  const folhas = contas.filter(conta => {
    for (const codigo of todosCodigos) {
      if (codigo === conta.accountNumber) continue;
      if (eFilho(conta.accountNumber, codigo)) {
        return false;
      }
    }
    return true;
  });
  
  console.log('=== CONTAS FOLHAS ATIVO (1.x) ===');
  folhas.filter(c => c.accountNumber.startsWith('1')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== CONTAS FOLHAS PASSIVO (2.x) ===');
  folhas.filter(c => c.accountNumber.startsWith('2')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== CONTAS FOLHAS RECEITAS (3.x) ===');
  folhas.filter(c => c.accountNumber.startsWith('3')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== CONTAS FOLHAS CUSTOS (4.x) ===');
  folhas.filter(c => c.accountNumber.startsWith('4')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 35).padEnd(35)} | ${c.finalBalance}`);
  });
  
  // Resumo
  const somaAtivo = folhas.filter(c => c.accountNumber.startsWith('1')).reduce((s, c) => s + Number(c.finalBalance), 0);
  const somaPassivo = folhas.filter(c => c.accountNumber.startsWith('2')).reduce((s, c) => s + Number(c.finalBalance), 0);
  const somaReceitas = folhas.filter(c => c.accountNumber.startsWith('3')).reduce((s, c) => s + Number(c.finalBalance), 0);
  const somaCustos = folhas.filter(c => c.accountNumber.startsWith('4')).reduce((s, c) => s + Number(c.finalBalance), 0);
  
  console.log('\n=== RESUMO SOMA DAS FOLHAS ===');
  console.log(`ATIVO:    ${somaAtivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`PASSIVO:  ${somaPassivo.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`RECEITAS: ${somaReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  console.log(`CUSTOS:   ${somaCustos.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`);
  
  console.log('\n=== TOTAIS DO BALANCETE (conta raiz) ===');
  const contaRaiz = contas.filter(c => c.accountNumber === '1' || c.accountNumber === '2' || c.accountNumber === '3' || c.accountNumber === '4');
  contaRaiz.forEach(c => {
    console.log(`${c.accountNumber}: ${c.finalBalance}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
