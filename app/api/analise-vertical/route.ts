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

function flattenContas(contas: ContaComValor[]): ContaComValor[] {
  const resultado: ContaComValor[] = [];

  const walk = (itens: ContaComValor[]) => {
    for (const item of itens) {
      resultado.push(item);
      if (item.children?.length) walk(item.children);
    }
  };

  walk(contas);
  return resultado;
}

function escolherBase(contas: ContaComValor[], codigosPreferenciais: string[], termosDescricao: string[]): number | null {
  for (const codigo of codigosPreferenciais) {
    const conta = buscarContaPorCodigo(contas, codigo);
    if (conta && conta.valor !== 0) return conta.valor;
  }

  const flat = flattenContas(contas);
  for (const conta of flat) {
    const descricao = conta.descricao?.toLowerCase?.() || '';
    if (termosDescricao.some(termo => descricao.includes(termo)) && conta.valor !== 0) {
      return conta.valor;
    }
  }

  const primeiraComValor = flat.find(conta => conta.valor !== 0);
  return primeiraComValor?.valor ?? null;
}

// Função para calcular análise vertical
function calcularAnaliseVertical(contas: ContaComValor[], totalBase: number, maxNivel: number = 2): Record<string, number> {
  const resultado: Record<string, number> = {};

  function processar(conta: ContaComValor, nivel: number = 0): void {
    if (nivel > maxNivel) return;
    
    // Calcular percentual em relação à base
    if (totalBase !== 0 && (conta.valor !== 0 || conta.nivel <= 2)) {
      const percentual = (conta.valor / Math.abs(totalBase)) * 100;
      resultado[conta.descricao] = percentual;
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
    const analiseVertical: { DRE: Record<string, any>; BP: Record<string, any> } = {
      DRE: {},
      BP: {}
    };

    for (const ano of anos) {
      const yearShort = ano.slice(-2);
      const balancetes = await buscarBalancetesAno(companyId, yearShort);

      if (balancetes.length > 0) {
        const { dre, bp } = await processarDadosFinanceiros(balancetes, deParaRecords);

        // Para DRE: base preferencial é Receita Total
        const baseDRE = escolherBase(
          dre,
          ['1', '51', '56'],
          ['receita total', 'receita líquida', 'receita liquida', 'receita bruta', 'receitas']
        );
        if (baseDRE !== null) {
          analiseVertical.DRE[ano] = calcularAnaliseVertical(dre, baseDRE);
        }

        // Para BP: base preferencial é Ativo Total
        const baseBP = escolherBase(
          bp,
          ['1', '76'],
          ['ativo total', 'ativo', 'total do ativo']
        );
        if (baseBP !== null) {
          analiseVertical.BP[ano] = calcularAnaliseVertical(bp, baseBP);
        }
      }
    }

    return NextResponse.json(analiseVertical);

  } catch (error) {
    console.error('Erro ao calcular análise vertical:', error);
    return NextResponse.json({
      error: 'Erro ao calcular análise vertical',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
