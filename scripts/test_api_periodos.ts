import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parsePeriod(period: string): { year: number; month: number } | null {
  const match = period.match(/([A-Z]{3})\/(\d{2})/);
  if (!match) return null;
  
  const monthMap: Record<string, number> = {
    JAN: 1, FEV: 2, MAR: 3, ABR: 4, MAI: 5, JUN: 6,
    JUL: 7, AGO: 8, SET: 9, OUT: 10, NOV: 11, DEZ: 12,
  };
  
  const month = monthMap[match[1]];
  const year = 2000 + parseInt(match[2]);
  
  return month ? { year, month } : null;
}

async function main() {
  // Obter todos os períodos
  const periods = await prisma.balanceteData.findMany({
    select: { period: true },
    distinct: ['period']
  });
  
  const uniquePeriods = [...new Set(periods.map(p => p.period))];
  console.log('Todos os períodos:', uniquePeriods);
  
  // Filtrar para 2024
  const year = '2024';
  const filteredPeriods = uniquePeriods.filter(period => {
    const parsed = parsePeriod(period);
    return parsed && parsed.year.toString() === year;
  });
  
  console.log(`\nPeríodos filtrados para ${year}:`, filteredPeriods);
  
  // Contar registros
  for (const period of filteredPeriods) {
    const count = await prisma.balanceteData.count({ where: { period } });
    console.log(`  ${period}: ${count} registros`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
