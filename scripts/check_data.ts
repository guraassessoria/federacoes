import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const contas = await prisma.balanceteData.findMany({
    where: {
      period: { contains: '25' }
    },
    select: {
      accountNumber: true,
      accountDescription: true,
      finalBalance: true
    },
    distinct: ['accountNumber'],
    orderBy: { accountNumber: 'asc' }
  });
  
  console.log('=== ATIVO (1.x) ===');
  contas.filter(c => c.accountNumber.startsWith('1')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 40).padEnd(40)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== PASSIVO (2.x) ===');
  contas.filter(c => c.accountNumber.startsWith('2')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 40).padEnd(40)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== RECEITAS (3.x) ===');
  contas.filter(c => c.accountNumber.startsWith('3')).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 40).padEnd(40)} | ${c.finalBalance}`);
  });
  
  console.log('\n=== CUSTOS/DESPESAS (4.x) - primeiros 30 ===');
  contas.filter(c => c.accountNumber.startsWith('4')).slice(0, 30).forEach(c => {
    console.log(`${c.accountNumber.padEnd(20)} | ${c.accountDescription?.substring(0, 40).padEnd(40)} | ${c.finalBalance}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
