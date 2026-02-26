import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// Carregar estrutura e mapeamento
const estruturaDRE = JSON.parse(fs.readFileSync('public/data/estrutura_dre.json', 'utf-8'));

// Copiar mapeamento do arquivo original
const MAPEAMENTO_DRE_ANALITICAS: Record<string, {codigoPadrao: string}> = {
  '3.1.11.200.001': { codigoPadrao: '40' },
  '3.1.11.200.002': { codigoPadrao: '40' },
  '3.1.11.200.008': { codigoPadrao: '40' },
  '3.1.11.400.003': { codigoPadrao: '195' }, // Receitas financeiras
  '4.2.11.100.001': { codigoPadrao: '106' },
  '4.2.11.100.003': { codigoPadrao: '106' },
  '4.2.11.100.004': { codigoPadrao: '106' },
  '4.2.11.100.005': { codigoPadrao: '111' },
  '4.2.11.100.006': { codigoPadrao: '111' },
  '4.2.11.100.011': { codigoPadrao: '111' },
  '4.2.11.100.012': { codigoPadrao: '115' },
  '4.2.11.100.014': { codigoPadrao: '111' },
  '4.2.11.200.003': { codigoPadrao: '145' },
  '4.2.11.200.007': { codigoPadrao: '126' },
  '4.2.11.200.008': { codigoPadrao: '126' },
  '4.2.11.200.009': { codigoPadrao: '126' },
  '4.2.11.200.010': { codigoPadrao: '126' },
  '4.2.11.300.001': { codigoPadrao: '131' },
  '4.2.11.300.002': { codigoPadrao: '131' },
  '4.2.11.300.003': { codigoPadrao: '131' },
  '4.2.11.300.007': { codigoPadrao: '155' },
  '4.2.11.300.008': { codigoPadrao: '131' },
  '4.2.11.500.001': { codigoPadrao: '158' },
  '4.2.11.500.002': { codigoPadrao: '136' },
  '4.2.11.500.003': { codigoPadrao: '69' },
  '4.2.11.500.004': { codigoPadrao: '136' },
  '4.2.11.500.005': { codigoPadrao: '136' },
  '4.2.11.500.006': { codigoPadrao: '164' },
  '4.2.11.500.012': { codigoPadrao: '187' },
  '4.2.11.500.013': { codigoPadrao: '67' },
  '4.2.11.500.014': { codigoPadrao: '139' },
  '4.2.11.500.015': { codigoPadrao: '139' },
  '4.2.11.500.016': { codigoPadrao: '187' },
  '4.2.11.500.019': { codigoPadrao: '115' },
  '4.2.11.500.020': { codigoPadrao: '106' },
  '4.2.11.500.022': { codigoPadrao: '54' },
  '4.2.11.500.026': { codigoPadrao: '61' },
  '4.2.11.500.027': { codigoPadrao: '139' },
  '4.2.11.500.028': { codigoPadrao: '54' },
  '4.2.11.600.001': { codigoPadrao: '200' },
  '4.2.11.600.004': { codigoPadrao: '200' },
  '4.2.11.700.001': { codigoPadrao: '180' },
  '4.2.11.700.007': { codigoPadrao: '180' },
  '4.2.11.700.008': { codigoPadrao: '180' },
  '4.2.11.700.009': { codigoPadrao: '180' },
  '4.2.11.700.011': { codigoPadrao: '180' },
  '4.2.11.800.001': { codigoPadrao: '66' },
  '4.2.11.800.002': { codigoPadrao: '66' },
  '4.2.11.800.003': { codigoPadrao: '66' },
  '4.2.11.800.004': { codigoPadrao: '66' },
  '4.2.11.800.005': { codigoPadrao: '66' },
  '4.2.11.800.006': { codigoPadrao: '66' },
  '4.2.11.800.008': { codigoPadrao: '66' },
  '4.2.11.800.009': { codigoPadrao: '66' },
  '4.2.11.800.011': { codigoPadrao: '66' },
  '4.2.11.800.013': { codigoPadrao: '66' },
  '4.2.11.800.016': { codigoPadrao: '66' },
  '4.2.11.800.021': { codigoPadrao: '66' },
  '4.2.11.800.025': { codigoPadrao: '66' },
  '4.2.11.800.029': { codigoPadrao: '66' },
  '4.2.11.800.030': { codigoPadrao: '66' },
  '4.2.11.800.035': { codigoPadrao: '66' },
  '4.2.11.800.036': { codigoPadrao: '66' },
  '4.2.11.800.037': { codigoPadrao: '66' },
  '4.2.11.800.038': { codigoPadrao: '66' },
  '4.2.11.800.039': { codigoPadrao: '66' },
  '4.2.11.800.040': { codigoPadrao: '66' },
  '4.2.11.800.041': { codigoPadrao: '66' },
  '4.2.11.800.042': { codigoPadrao: '66' },
  '4.2.11.800.043': { codigoPadrao: '66' },
  '4.2.11.800.044': { codigoPadrao: '66' },
  '4.2.11.900.001': { codigoPadrao: '61' },
  '4.2.11.900.004': { codigoPadrao: '139' },
  '4.2.11.900.006': { codigoPadrao: '139' },
};

const CONTAS_RETIFICADORAS_DRE = new Set(['199', '213', '214', '221']);

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

function ajustarSinal(valor: number, accountNumber: string): number {
  if (accountNumber.startsWith('3')) return Math.abs(valor);
  if (accountNumber.startsWith('4')) return Math.abs(valor);
  return valor;
}

async function main() {
  const dados2024 = await prisma.balanceteData.findMany({
    where: { period: 'DEZ/24' },
    orderBy: { accountNumber: 'asc' }
  });
  
  const contasDRE = dados2024.filter(d => 
    d.accountNumber.startsWith('3') || d.accountNumber.startsWith('4')
  );
  const folhas = filtrarContasFolhas(contasDRE);
  
  // Criar estrutura com valores
  const valoresPorCodigo: Record<string, number> = {};
  
  for (const conta of folhas) {
    const mapeamento = MAPEAMENTO_DRE_ANALITICAS[conta.accountNumber];
    if (mapeamento) {
      const valorOriginal = Number(conta.finalBalance) || 0;
      const valorAjustado = ajustarSinal(valorOriginal, conta.accountNumber);
      valoresPorCodigo[mapeamento.codigoPadrao] = (valoresPorCodigo[mapeamento.codigoPadrao] || 0) + valorAjustado;
    }
  }
  
  // Criar contas com valor
  type ContaComValor = { codigo: string; descricao: string; codigoSuperior: string | null; nivel: number; valor: number };
  const contasComValor: ContaComValor[] = estruturaDRE.map((conta: any) => ({
    ...conta,
    valor: valoresPorCodigo[conta.codigo] || 0
  }));
  
  // Calcular totais (bottom-up)
  const mapa = new Map<string, ContaComValor>();
  contasComValor.forEach(c => mapa.set(c.codigo, c));
  
  const contasOrdenadas = [...contasComValor].sort((a, b) => b.nivel - a.nivel);
  
  for (const conta of contasOrdenadas) {
    if (conta.codigoSuperior) {
      const pai = mapa.get(conta.codigoSuperior.replace('.0', ''));
      if (pai) {
        if (CONTAS_RETIFICADORAS_DRE.has(conta.codigo)) {
          pai.valor -= conta.valor;
        } else {
          pai.valor += conta.valor;
        }
      }
    }
  }
  
  // Mostrar valores de nível 1
  console.log('=== VALORES NÍVEL 1 (antes do cálculo do resultado) ===');
  const receitas = mapa.get('1');
  const custos = mapa.get('52');
  const despesas = mapa.get('104');
  const resultadoFinanceiro = mapa.get('190');
  
  console.log(`RECEITAS (1): R$ ${receitas?.valor?.toFixed(2)}`);
  console.log(`CUSTOS (52): R$ ${custos?.valor?.toFixed(2)}`);
  console.log(`DESPESAS (104): R$ ${despesas?.valor?.toFixed(2)}`);
  console.log(`RESULTADO FINANCEIRO (190): R$ ${resultadoFinanceiro?.valor?.toFixed(2)}`);
  
  // Calcular resultado
  const valorResultado = (receitas?.valor || 0) - Math.abs(custos?.valor || 0) - Math.abs(despesas?.valor || 0) + (resultadoFinanceiro?.valor || 0);
  
  console.log(`\n=== CÁLCULO DO RESULTADO ===`);
  console.log(`${receitas?.valor} - |${custos?.valor}| - |${despesas?.valor}| + ${resultadoFinanceiro?.valor}`);
  console.log(`= ${receitas?.valor} - ${Math.abs(custos?.valor || 0)} - ${Math.abs(despesas?.valor || 0)} + ${resultadoFinanceiro?.valor}`);
  console.log(`= R$ ${valorResultado.toFixed(2)}`);
  console.log(valorResultado >= 0 ? '=> SUPERÁVIT' : '=> DÉFICIT');
}

main().catch(console.error).finally(() => prisma.$disconnect());
