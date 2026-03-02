import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

function filtrarContasFolhas(dados: any[]): any[] {
  const todosCodigos = [...new Set(dados.map(c => c.accountCode))];
  return dados.filter(conta => {
    const codigoAtual = conta.accountNumber;
    for (const codigo of todosCodigos) {
      if (codigo === codigoAtual) continue;
      if (eFilho(codigoAtual, codigo)) return false;
    }
    return true;
  });
}

async function main() {
  const dados2024 = await prisma.balancete.findMany({
    where: { period: 'DEZ/24' },
    orderBy: { accountCode: 'asc' }
  });
  
  const contasDRE = dados2024.filter(d => 
    d.accountCode.startsWith('3') || d.accountCode.startsWith('4')
  );
  const folhas = filtrarContasFolhas(contasDRE);
  
  console.log('=== TODAS AS CONTAS FOLHAS DRE 2024 ===');
  let total = 0;
  folhas.forEach(c => {
    const valor = Number(c.closingBalance);
    total += valor;
    console.log(`${c.accountCode.padEnd(20)} | ${c.accountDescription.padEnd(50)} | ${valor.toFixed(2)}`);
  });
  
  console.log(`\nTotal: ${total.toFixed(2)}`);
  
  // Calcular resultado correto
  const receitas = folhas.filter(c => c.accountCode.startsWith('3'));
  const custosDespesas = folhas.filter(c => c.accountCode.startsWith('4'));
  
  const totalReceitas = receitas.reduce((sum, c) => sum + Math.abs(Number(c.closingBalance)), 0);
  const totalCustosDespesas = custosDespesas.reduce((sum, c) => sum + Number(c.closingBalance), 0);
  
  console.log(`\nReceitas: ${totalReceitas.toFixed(2)}`);
  console.log(`Custos/Despesas: ${totalCustosDespesas.toFixed(2)}`);
  console.log(`Resultado: ${(totalReceitas - totalCustosDespesas).toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
