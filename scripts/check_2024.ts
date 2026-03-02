import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Buscar dados de 2024 (DEZ/24)
  const dados2024 = await prisma.balancete.findMany({
    where: { period: 'DEZ/24' },
    orderBy: { accountCode: 'asc' }
  });
  
  console.log(`Total de registros DEZ/24: ${dados2024.length}`);
  
  // Função para verificar se é conta folha (analítica)
  function isLeaf(accountNumber: string): boolean {
    return !dados2024.some(other => 
      other.accountCode !== accountNumber && 
      other.accountCode.startsWith(accountNumber + '.')
    );
  }
  
  // Separar receitas (3.x) e custos (4.x) - APENAS FOLHAS
  const receitas = dados2024.filter(d => d.accountCode.startsWith('3') && isLeaf(d.accountCode));
  const custos = dados2024.filter(d => d.accountCode.startsWith('4') && isLeaf(d.accountCode));
  
  console.log('\n=== RECEITAS 2024 (apenas contas analíticas) ===');
  let totalReceitas = 0;
  receitas.forEach(d => {
    console.log(`${d.accountCode} - ${d.accountDescription}: ${Number(d.closingBalance).toFixed(2)}`);
    totalReceitas += Number(d.closingBalance);
  });
  console.log(`TOTAL RECEITAS: R$ ${totalReceitas.toFixed(2)}`);
  
  console.log('\n=== CUSTOS/DESPESAS 2024 (apenas contas analíticas) ===');
  let totalCustos = 0;
  custos.forEach(d => {
    console.log(`${d.accountCode} - ${d.accountDescription}: ${Number(d.closingBalance).toFixed(2)}`);
    totalCustos += Number(d.closingBalance);
  });
  console.log(`TOTAL CUSTOS/DESPESAS: R$ ${totalCustos.toFixed(2)}`);
  
  console.log(`\n=== RESULTADO ESPERADO 2024 ===`);
  console.log(`Receitas (valores negativos no balancete): R$ ${totalReceitas.toFixed(2)}`);
  console.log(`Custos/Despesas (valores positivos no balancete): R$ ${totalCustos.toFixed(2)}`);
  
  // No balancete: receitas são negativas, custos são positivos
  // Resultado = |Receitas| - Custos
  const receitasAjustadas = Math.abs(totalReceitas);
  const resultado = receitasAjustadas - totalCustos;
  
  console.log(`\nReceitas ajustadas (valor absoluto): R$ ${receitasAjustadas.toFixed(2)}`);
  console.log(`RESULTADO DO EXERCÍCIO 2024: R$ ${resultado.toFixed(2)}`);
  
  if (resultado > 0) {
    console.log(`=> SUPERÁVIT de R$ ${resultado.toFixed(2)}`);
  } else {
    console.log(`=> DÉFICIT de R$ ${Math.abs(resultado).toFixed(2)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
