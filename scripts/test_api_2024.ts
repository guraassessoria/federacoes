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

function filtrarContasFolhas(dados: any[]): any[] {
  const todosCodigos = [...new Set(dados.map(c => c.accountNumber))];
  
  return dados.filter(conta => {
    const codigoAtual = conta.accountNumber;
    
    for (const codigo of todosCodigos) {
      if (codigo === codigoAtual) continue;
      if (eFilho(codigoAtual, codigo)) {
        return false;
      }
    }
    return true;
  });
}

async function main() {
  const dados2024 = await prisma.balanceteData.findMany({
    where: { period: 'DEZ/24' },
    orderBy: { accountNumber: 'asc' }
  });
  
  console.log(`Total de registros: ${dados2024.length}`);
  
  // Filtrar DRE (contas 3.x e 4.x)
  const contasDRE = dados2024.filter(d => 
    d.accountNumber.startsWith('3') || d.accountNumber.startsWith('4')
  );
  
  console.log(`Contas DRE (3.x + 4.x): ${contasDRE.length}`);
  
  // Aplicar filtro de folhas
  const folhas = filtrarContasFolhas(contasDRE);
  console.log(`Contas folhas: ${folhas.length}`);
  
  // Verificar se 4.2.11.8 está nas folhas
  const conta428 = folhas.find(c => c.accountNumber === '4.2.11.8');
  console.log(`\n4.2.11.8 está nas folhas? ${conta428 ? 'SIM - PROBLEMA!' : 'NÃO - OK'}`);
  
  const conta429 = folhas.find(c => c.accountNumber === '4.2.11.9');
  console.log(`4.2.11.9 está nas folhas? ${conta429 ? 'SIM - PROBLEMA!' : 'NÃO - OK'}`);
  
  // Calcular resultado correto
  const receitas = folhas.filter(c => c.accountNumber.startsWith('3'));
  const custos = folhas.filter(c => c.accountNumber.startsWith('4'));
  
  let totalReceitas = receitas.reduce((sum, c) => sum + Number(c.finalBalance), 0);
  let totalCustos = custos.reduce((sum, c) => sum + Number(c.finalBalance), 0);
  
  console.log(`\n=== RESULTADO CORRETO 2024 ===`);
  console.log(`Receitas (${receitas.length} contas): R$ ${totalReceitas.toFixed(2)}`);
  console.log(`Custos (${custos.length} contas): R$ ${totalCustos.toFixed(2)}`);
  
  const receitasAjustadas = Math.abs(totalReceitas);
  const resultado = receitasAjustadas - totalCustos;
  
  console.log(`\nReceitas ajustadas: R$ ${receitasAjustadas.toFixed(2)}`);
  console.log(`RESULTADO: R$ ${resultado.toFixed(2)}`);
  console.log(resultado >= 0 ? `=> SUPERÁVIT` : `=> DÉFICIT`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
