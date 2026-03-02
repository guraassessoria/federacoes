import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Carregar estrutura DRE
const estruturaDRE = JSON.parse(fs.readFileSync('public/data/estrutura_dre.json', 'utf-8'));

// Mapeamento de contas analíticas (simplificado para teste)
const MAPEAMENTO_DRE: Record<string, { codigoPadrao: string; descricao: string }> = {
  // Receitas
  '3.1.11.200.001': { codigoPadrao: '2', descricao: 'Receitas de Competições' },
  '3.1.11.200.002': { codigoPadrao: '17', descricao: 'Outras Receitas' },
  '3.1.11.200.008': { codigoPadrao: '17', descricao: 'Outras Receitas' },
  '3.1.11.400.003': { codigoPadrao: '195', descricao: 'Receitas Financeiras' },
  // Custos/Despesas - simplificado
};

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
  const todosCodigos = [...new Set(dados.map(c => c.accountNumber))];
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
    orderBy: { accountNumber: 'asc' }
  });
  
  const contasDRE = dados2024.filter(d => 
    d.accountNumber.startsWith('3') || d.accountNumber.startsWith('4')
  );
  
  const folhas = filtrarContasFolhas(contasDRE);
  
  // Calcular totais como no serviço de mapeamento
  let totalReceitas = 0;
  let totalCustos = 0;
  let totalDespesas = 0;
  let totalReceitasFinanceiras = 0;
  let totalDespesasFinanceiras = 0;
  
  for (const conta of folhas) {
    const valor = Number(conta.closingBalance) || 0;
    const codigo = conta.accountNumber;
    
    if (codigo.startsWith('3')) {
      // Receitas - valor negativo no balancete, converter para positivo
      totalReceitas += Math.abs(valor);
      
      // Verificar se é receita financeira
      if (codigo.startsWith('3.1.11.400')) {
        totalReceitasFinanceiras += Math.abs(valor);
      }
    } else if (codigo.startsWith('4')) {
      // Custos/Despesas - valor positivo no balancete
      if (codigo.startsWith('4.2.11.600')) {
        // Despesas financeiras
        totalDespesasFinanceiras += valor;
      } else if (codigo.startsWith('4.2.11.1') || codigo.startsWith('4.2.11.2') || 
                 codigo.startsWith('4.2.11.5') || codigo.startsWith('4.2.11.8') || 
                 codigo.startsWith('4.2.11.9')) {
        // Custos operacionais
        totalCustos += valor;
      } else {
        // Outras despesas
        totalDespesas += valor;
      }
    }
  }
  
  // Resultado Financeiro = Receitas Financeiras - Despesas Financeiras
  const resultadoFinanceiro = totalReceitasFinanceiras - totalDespesasFinanceiras;
  
  console.log(`\n=== ANÁLISE DRE 2024 ===`);
  console.log(`Total Receitas: R$ ${totalReceitas.toFixed(2)}`);
  console.log(`Total Custos: R$ ${totalCustos.toFixed(2)}`);
  console.log(`Total Despesas: R$ ${totalDespesas.toFixed(2)}`);
  console.log(`Receitas Financeiras: R$ ${totalReceitasFinanceiras.toFixed(2)}`);
  console.log(`Despesas Financeiras: R$ ${totalDespesasFinanceiras.toFixed(2)}`);
  console.log(`Resultado Financeiro: R$ ${resultadoFinanceiro.toFixed(2)}`);
  
  // Cálculo do Resultado Líquido
  // Fórmula: Receitas - Custos - Despesas + Resultado Financeiro
  const resultadoLiquido = totalReceitas - totalCustos - totalDespesas + resultadoFinanceiro;
  
  console.log(`\n=== RESULTADO DO EXERCÍCIO 2024 ===`);
  console.log(`Receitas: ${totalReceitas.toFixed(2)}`);
  console.log(`(-) Custos: ${totalCustos.toFixed(2)}`);
  console.log(`(-) Despesas: ${totalDespesas.toFixed(2)}`);
  console.log(`(+/-) Resultado Financeiro: ${resultadoFinanceiro.toFixed(2)}`);
  console.log(`= RESULTADO: R$ ${resultadoLiquido.toFixed(2)}`);
  console.log(resultadoLiquido >= 0 ? '=> SUPERÁVIT' : '=> DÉFICIT');
  
  // Verificar valores do balancete raiz
  const raizReceitas = dados2024.find(d => d.accountNumber === '3');
  const raizCustos = dados2024.find(d => d.accountNumber === '4');
  
  console.log(`\n=== VERIFICAÇÃO COM CONTAS RAIZ ===`);
  console.log(`Conta 3 (Receitas): R$ ${raizReceitas?.closingBalance}`);
  console.log(`Conta 4 (Custos): R$ ${raizCustos?.closingBalance}`);
  
  const resultadoRaiz = Math.abs(Number(raizReceitas?.closingBalance || 0)) - Number(raizCustos?.closingBalance || 0);
  console.log(`Resultado (|3| - 4): R$ ${resultadoRaiz.toFixed(2)}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
