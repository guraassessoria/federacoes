import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processarDadosFinanceiros, ContaComValor, DeParaRecord } from '@/lib/services/estruturaMapping';

export const dynamic = 'force-dynamic';

interface ContaVertical {
  codigo: string;
  descricao: string;
  nivel: number;
  valor: number;
  percentual: number;
  analitica: boolean;
}

interface VerticalAno {
  base: {
    codigo: string;
    descricao: string;
    valor: number;
  };
  contas: ContaVertical[];
}

interface VerticalResponse {
  meta: {
    companyId: string;
    anosSolicitados: string[];
    anosDisponiveis: string[];
    parametros: {
      maxNivel: number;
      incluirZeros: boolean;
    };
  };
  DRE: Record<string, VerticalAno>;
  BP: Record<string, VerticalAno>;
}

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

function encontrarBasePorCodigo(contas: ContaComValor[], codigosPreferenciais: string[]): ContaComValor | null {
  for (const codigo of codigosPreferenciais) {
    const conta = buscarContaPorCodigo(contas, codigo);
    if (conta && conta.valor !== 0) {
      return conta;
    }
  }

  for (const codigo of codigosPreferenciais) {
    const conta = buscarContaPorCodigo(contas, codigo);
    if (conta) {
      return conta;
    }
  }

  return null;
}

function extrairContasVerticais(
  contas: ContaComValor[],
  baseValor: number,
  maxNivel: number,
  incluirZeros: boolean,
  demonstracao: 'DRE' | 'BP'
): ContaVertical[] {
  const resultado: ContaVertical[] = [];
  const baseAbs = Math.abs(baseValor);
  const visitados = new Set<string>();

  function processar(lista: ContaComValor[], nivelFallback: number = 1): void {
    for (const conta of lista) {
      const nivelConta = conta.nivelVisualizacao ?? conta.nivel ?? nivelFallback;
      const analitica = demonstracao === 'DRE' ? nivelConta >= 4 : nivelConta >= 3;
      if (nivelConta <= maxNivel) {
        const key = `${conta.codigo}|${conta.descricao}`;
        if (!visitados.has(key)) {
          const deveIncluir = incluirZeros || conta.valor !== 0 || nivelConta === 1;
          if (deveIncluir) {
            resultado.push({
              codigo: conta.codigo,
              descricao: conta.descricao,
              nivel: nivelConta,
              valor: conta.valor,
              percentual: analitica && baseAbs !== 0 ? (conta.valor / baseAbs) * 100 : 0,
              analitica,
            });
          }
          visitados.add(key);
        }
      }

      if (conta.children?.length) {
        processar(conta.children, nivelConta + 1);
      }
    }
  }

  processar(contas);
  return resultado;
}

function parseAnos(rawAnos: string | null): string[] {
  if (!rawAnos) return ['2023', '2024', '2025'];
  return rawAnos
    .split(',')
    .map(item => item.trim())
    .filter(item => /^\d{4}$/.test(item));
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
    const anos = parseAnos(searchParams.get('anos'));
    const maxNivel = Math.max(1, Math.min(6, Number(searchParams.get('maxNivel') || 3)));
    const incluirZeros = searchParams.get('incluirZeros') === 'true';

    if (!companyId) {
      return NextResponse.json({ error: 'ID da empresa é obrigatório' }, { status: 400 });
    }

    if (anos.length === 0) {
      return NextResponse.json({ error: 'Parâmetro anos inválido. Use formato YYYY,YYYY.' }, { status: 400 });
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

    const analiseVertical: VerticalResponse = {
      meta: {
        companyId,
        anosSolicitados: anos,
        anosDisponiveis: [],
        parametros: {
          maxNivel,
          incluirZeros,
        },
      },
      DRE: {},
      BP: {}
    };

    for (const ano of anos) {
      const yearShort = ano.slice(-2);
      const balancetes = await buscarBalancetesAno(companyId, yearShort);

      if (balancetes.length > 0) {
        const { dre, bp } = await processarDadosFinanceiros(balancetes, deParaRecords);
        analiseVertical.meta.anosDisponiveis.push(ano);

        // DRE: base contábil principal = Receita Líquida (56), fallback Receita Bruta (51)
        const baseDRE = encontrarBasePorCodigo(dre, ['56', '51']);
        if (baseDRE) {
          analiseVertical.DRE[ano] = {
            base: {
              codigo: baseDRE.codigo,
              descricao: baseDRE.descricao,
              valor: baseDRE.valor,
            },
            contas: extrairContasVerticais(dre, baseDRE.valor, maxNivel, incluirZeros, 'DRE'),
          };
        }

        // BP: base contábil principal = Ativo Total (1), fallback Total Passivo+PL (76)
        const baseBP = encontrarBasePorCodigo(bp, ['1', '76']);
        if (baseBP) {
          analiseVertical.BP[ano] = {
            base: {
              codigo: baseBP.codigo,
              descricao: baseBP.descricao,
              valor: baseBP.valor,
            },
            contas: extrairContasVerticais(bp, baseBP.valor, maxNivel, incluirZeros, 'BP'),
          };
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
