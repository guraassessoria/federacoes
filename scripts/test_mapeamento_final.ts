import { PrismaClient } from '@prisma/client';
import { mapBalanceteToEstrutura } from '../lib/services/estruturaMapping';

const prisma = new PrismaClient();

async function main() {
  // Buscar dados de 2024
  const dados2024 = await prisma.balanceteData.findMany({
    where: { period: 'DEZ/24' }
  });
  
  console.log(`Total de registros DEZ/24: ${dados2024.length}`);
  
  // Mapear para estrutura DRE
  const estruturaDRE = await mapBalanceteToEstrutura(dados2024, 'DRE');
  
  // Buscar contas de nível 1
  function findAccount(accounts: any[], codigo: string): any {
    for (const account of accounts) {
      if (account.codigo === codigo) return account;
      if (account.children) {
        const found = findAccount(account.children, codigo);
        if (found) return found;
      }
    }
    return null;
  }
  
  console.log('\n=== VALORES CALCULADOS PELO SERVIÇO DE MAPEAMENTO ===');
  
  const receitas = findAccount(estruturaDRE, '1');
  const custos = findAccount(estruturaDRE, '52');
  const despesas = findAccount(estruturaDRE, '104');
  const resultadoFinanceiro = findAccount(estruturaDRE, '190');
  const resultado = findAccount(estruturaDRE, '210');
  const resultadoLiquido = findAccount(estruturaDRE, '225');
  
  console.log(`RECEITAS (1): R$ ${receitas?.valor?.toFixed(2)}`);
  console.log(`CUSTOS (52): R$ ${custos?.valor?.toFixed(2)}`);
  console.log(`DESPESAS (104): R$ ${despesas?.valor?.toFixed(2)}`);
  console.log(`RESULTADO FINANCEIRO (190): R$ ${resultadoFinanceiro?.valor?.toFixed(2)}`);
  console.log(`RESULTADO (210): R$ ${resultado?.valor?.toFixed(2)}`);
  console.log(`RESULTADO LÍQUIDO (225): R$ ${resultadoLiquido?.valor?.toFixed(2)}`);
  
  if (resultadoLiquido) {
    console.log(resultadoLiquido.valor >= 0 ? '\n=> SUPERÁVIT' : '\n=> DÉFICIT');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
