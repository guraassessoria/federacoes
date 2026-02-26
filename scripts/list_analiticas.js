const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const contas = await prisma.balanceteData.findMany({
    where: { period: { contains: '25' } },
    select: { accountNumber: true, accountDescription: true, finalBalance: true },
    orderBy: { accountNumber: 'asc' }
  });
  
  const allAccounts = contas.map(c => c.accountNumber);
  
  const analiticas = contas.filter(conta => {
    const prefix = conta.accountNumber + '.';
    return !allAccounts.some(other => other.startsWith(prefix));
  });
  
  console.log('=== BP ===');
  analiticas.filter(c => (c.accountNumber.startsWith('1') || c.accountNumber.startsWith('2')) && c.finalBalance !== 0)
    .forEach(c => console.log(c.accountNumber + '|' + c.accountDescription + '|' + c.finalBalance));
  
  console.log('');
  console.log('=== DRE ===');
  analiticas.filter(c => (c.accountNumber.startsWith('3') || c.accountNumber.startsWith('4')) && c.finalBalance !== 0)
    .forEach(c => console.log(c.accountNumber + '|' + c.accountDescription + '|' + c.finalBalance));
  
  await prisma.$disconnect();
}
main();
