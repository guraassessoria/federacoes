import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processarDadosFinanceiros, ContaComValor, DeParaRecord } from '@/lib/services/estruturaMapping';

export const dynamic = 'force-dynamic';

// Função para buscar conta por código em uma hierarquia
function buscarContaPorCodigo(contas: ContaComValor[], codigo: string): ContaComValor | null {
  for (const conta of contas) {
    if (conta.codigo === codigo) return conta;
    if (conta.children?.length) {
      const encontrada = buscarContaPorCodigo(conta.children, codigo);
      if (encontrada) return encontrada;
    }
  }
  return null;
}

// Função para calcular análise horizontal entre dois períodos
function calcularVariacao(valorAnterior: number, valorAtual: number): number {
  if (valorAnterior === 0) return 0;
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

// Função para extrair contas principais de uma demonstração
function extrairContasPrincipais(contas: ContaComValor[], maxNivel: number = 2): Record<string, number> {
  const resultado: Record<string, number> = {};

  function processar(conta: ContaComValor, nivel: number = 0): void {
    if (nivel > maxNivel) return;
    
    // Adicionar conta se tiver valor ou for totalizador importante
    if (conta.valor !== 0 || conta.nivel <= 2) {
      resultado[conta.descricao] = conta.valor;
    }
    
    // Processar filhos
    if (conta.children?.length) {
      conta.children.forEach(child => processar(child, nivel + 1));
    }
  }

  contas.forEach(conta => processar(conta, 0));
  return resultado;
}

async function buscarBalancetesAno(companyId: string, yearShort: string) {
  const model = (prisma as any).balancete ?? (prisma as any).balanceteRow;
  if (!model) return [];

  try {
    return await model.findMany({
      where: {
        companyId,
        period: { contains: `/${yearShort}` }
      },
      orderBy: { accountCode: 'asc' }
    });
  } catch {
    return await model.findMany({
      where: {
        companyId,
        period: { contains: `/${yearShort}` }
      },
      orderBy: { accountNumber: 'asc' }
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    const anos = searchParams.get('anos')?.split(',') || ['2023', '2024', '2025'];

    if (!companyId) {
      return NextResponse.json({ error: 'ID da empresa é obrigatório' }, { status: 400 });
    }

    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { id: companyId }
    });

    if (!company) {
      return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
    }

    // Buscar de-para
    const deParaRows = await prisma.deParaMapping.findMany({
      where: { companyId },
      select: { contaFederacao: true, padraoBP: true, padraoDRE: true, padraoDFC: true, padraoDMPL: true },
    });
    const deParaRecords: DeParaRecord[] = deParaRows.map(r => ({
      contaFederacao: r.contaFederacao,
      padraoBP: r.padraoBP,
      padraoDRE: r.padraoDRE,
      padraoDFC: r.padraoDFC,
      padraoDMPL: r.padraoDMPL,
    }));

    // Processar dados para cada ano
    const dadosPorAno: Record<string, { dre: ContaComValor[]; bp: ContaComValor[] }> = {};

    for (const ano of anos) {
      const yearShort = ano.slice(-2);
      const balancetes = await buscarBalancetesAno(companyId, yearShort);

      if (balancetes.length > 0) {
        const { dre, bp } = await processarDadosFinanceiros(balancetes, deParaRecords);
        dadosPorAno[ano] = { dre, bp };
      }
    }

    // Calcular análise horizontal
    const analiseHorizontal: { DRE: Record<string, any>; BP: Record<string, any> } = {
      DRE: {},
      BP: {}
    };

    // Extrair contas principais de cada ano
    const dreContasPorAno: Record<string, Record<string, number>> = {};
    const bpContasPorAno: Record<string, Record<string, number>> = {};

    for (const ano of anos) {
      if (dadosPorAno[ano]) {
        dreContasPorAno[ano] = extrairContasPrincipais(dadosPorAno[ano].dre);
        bpContasPorAno[ano] = extrairContasPrincipais(dadosPorAno[ano].bp);
      }
    }

    // Obter todas as contas únicas
    const dreContasUnicas = new Set<string>();
    const bpContasUnicas = new Set<string>();

    Object.values(dreContasPorAno).forEach(contas => {
      Object.keys(contas).forEach(conta => dreContasUnicas.add(conta));
    });

    Object.values(bpContasPorAno).forEach(contas => {
      Object.keys(contas).forEach(conta => bpContasUnicas.add(conta));
    });

    // Calcular variações para DRE
    dreContasUnicas.forEach(conta => {
      const valores: Record<string, number> = {};
      const variacoes: Record<string, number> = {};

      anos.forEach(ano => {
        valores[ano] = dreContasPorAno[ano]?.[conta] || 0;
      });

      // Calcular variações entre anos consecutivos
      if (anos.length >= 2) {
        for (let i = 1; i < anos.length; i++) {
          const anoAnterior = anos[i - 1];
          const anoAtual = anos[i];
          const variacaoKey = `Variacao ${anoAnterior}-${anoAtual} (%)`;
          variacoes[variacaoKey] = calcularVariacao(valores[anoAnterior], valores[anoAtual]);
        }

        // Variação acumulada
        if (anos.length >= 2) {
          const primeiroAno = anos[0];
          const ultimoAno = anos[anos.length - 1];
          variacoes[`Variacao ${primeiroAno}-${ultimoAno} (%)`] = calcularVariacao(
            valores[primeiroAno],
            valores[ultimoAno]
          );
        }
      }

      analiseHorizontal.DRE[conta] = { ...valores, ...variacoes };
    });

    // Calcular variações para BP
    bpContasUnicas.forEach(conta => {
      const valores: Record<string, number> = {}; 
      const variacoes: Record<string, number> = {};

      anos.forEach(ano => {
        valores[ano] = bpContasPorAno[ano]?.[conta] || 0;
      });

      // Calcular variações entre anos consecutivos
      if (anos.length >= 2) {
        for (let i = 1; i < anos.length; i++) {
          const anoAnterior = anos[i - 1];
          const anoAtual = anos[i];
          const variacaoKey = `Variacao ${anoAnterior}-${anoAtual} (%)`;
          variacoes[variacaoKey] = calcularVariacao(valores[anoAnterior], valores[anoAtual]);
        }

        // Variação acumulada
        if (anos.length >= 2) {
          const primeiroAno = anos[0];
          const ultimoAno = anos[anos.length - 1];
          variacoes[`Variacao ${primeiroAno}-${ultimoAno} (%)`] = calcularVariacao(
            valores[primeiroAno],
            valores[ultimoAno]
          );
        }
      }

      analiseHorizontal.BP[conta] = { ...valores, ...variacoes };
    });

    return NextResponse.json(analiseHorizontal);

  } catch (error) {
    console.error('Erro ao calcular análise horizontal:', error);
    return NextResponse.json({
      error: 'Erro ao calcular análise horizontal',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
