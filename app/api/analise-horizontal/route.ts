import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { processarDadosFinanceiros, ContaComValor, DeParaRecord } from '@/lib/services/estruturaMapping';

export const dynamic = 'force-dynamic';

interface ContaHorizontal {
  codigo: string;
  descricao: string;
  nivel: number;
  valores: Record<string, number>;
  variacoes: Record<string, number>;
}

interface HorizontalResponse {
  meta: {
    companyId: string;
    anosSolicitados: string[];
    anosDisponiveis: string[];
    parametros: {
      maxNivel: number;
      incluirZeros: boolean;
    };
  };
  DRE: Record<string, ContaHorizontal>;
  BP: Record<string, ContaHorizontal>;
}

// Função para calcular análise horizontal entre dois períodos
function calcularVariacao(valorAnterior: number, valorAtual: number): number {
  if (valorAnterior === 0) return 0;
  return ((valorAtual - valorAnterior) / Math.abs(valorAnterior)) * 100;
}

function extrairContasModelo(
  contas: ContaComValor[],
  maxNivel: number,
  incluirZeros: boolean
): Record<string, { codigo: string; descricao: string; nivel: number; valor: number }> {
  const resultado: Record<string, { codigo: string; descricao: string; nivel: number; valor: number }> = {};

  function processar(lista: ContaComValor[], nivelFallback: number = 1): void {
    for (const conta of lista) {
      const nivelConta = conta.nivelVisualizacao ?? conta.nivel ?? nivelFallback;
      if (nivelConta <= maxNivel) {
        const deveIncluir = incluirZeros || conta.valor !== 0 || nivelConta === 1;
        if (deveIncluir && !resultado[conta.codigo]) {
          resultado[conta.codigo] = {
            codigo: conta.codigo,
            descricao: conta.descricao,
            nivel: nivelConta,
            valor: conta.valor,
          };
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

function compareCodigoContabil(a: string, b: string): number {
  const pa = a.split('.');
  const pb = b.split('.');
  const maxLen = Math.max(pa.length, pb.length);

  for (let i = 0; i < maxLen; i++) {
    const sa = pa[i] ?? '';
    const sb = pb[i] ?? '';
    const na = Number(sa);
    const nb = Number(sb);

    const ambosNumericos = Number.isFinite(na) && Number.isFinite(nb) && sa !== '' && sb !== '';
    if (ambosNumericos) {
      if (na !== nb) return na - nb;
      continue;
    }

    const cmp = sa.localeCompare(sb, 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (cmp !== 0) return cmp;
  }

  return 0;
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

    const dadosPorAno: Record<
      string,
      {
        dre: Record<string, { codigo: string; descricao: string; nivel: number; valor: number }>;
        bp: Record<string, { codigo: string; descricao: string; nivel: number; valor: number }>;
      }
    > = {};

    for (const ano of anos) {
      const yearShort = ano.slice(-2);
      const balancetes = await buscarBalancetesAno(companyId, yearShort);

      if (balancetes.length > 0) {
        const { dre, bp } = await processarDadosFinanceiros(balancetes, deParaRecords);
        dadosPorAno[ano] = {
          dre: extrairContasModelo(dre, maxNivel, incluirZeros),
          bp: extrairContasModelo(bp, maxNivel, incluirZeros),
        };
      }
    }

    const anosDisponiveis = anos.filter(ano => !!dadosPorAno[ano]);

    const analiseHorizontal: HorizontalResponse = {
      meta: {
        companyId,
        anosSolicitados: anos,
        anosDisponiveis,
        parametros: {
          maxNivel,
          incluirZeros,
        },
      },
      DRE: {},
      BP: {}
    };

    const dreCodigos = new Set<string>();
    const bpCodigos = new Set<string>();

    for (const ano of anosDisponiveis) {
      Object.keys(dadosPorAno[ano].dre).forEach(codigo => dreCodigos.add(codigo));
      Object.keys(dadosPorAno[ano].bp).forEach(codigo => bpCodigos.add(codigo));
    }

    const construirSerie = (
      codigo: string,
      tipo: 'dre' | 'bp'
    ): ContaHorizontal => {
      const primeiraConta = anosDisponiveis
        .map(ano => dadosPorAno[ano][tipo][codigo])
        .find(Boolean);

      const valores: Record<string, number> = {};
      const variacoes: Record<string, number> = {};

      for (const ano of anosDisponiveis) {
        valores[ano] = dadosPorAno[ano][tipo][codigo]?.valor ?? 0;
      }

      for (let i = 1; i < anosDisponiveis.length; i++) {
        const anoAnterior = anosDisponiveis[i - 1];
        const anoAtual = anosDisponiveis[i];
        const key = `Variacao ${anoAnterior}-${anoAtual} (%)`;
        variacoes[key] = calcularVariacao(valores[anoAnterior], valores[anoAtual]);
      }

      if (anosDisponiveis.length >= 2) {
        const primeiroAno = anosDisponiveis[0];
        const ultimoAno = anosDisponiveis[anosDisponiveis.length - 1];
        variacoes[`Variacao ${primeiroAno}-${ultimoAno} (%)`] = calcularVariacao(
          valores[primeiroAno],
          valores[ultimoAno]
        );
      }

      return {
        codigo,
        descricao: primeiraConta?.descricao || codigo,
        nivel: primeiraConta?.nivel || 1,
        valores,
        variacoes,
      };
    };

    const dreOrdenados = Array.from(dreCodigos).sort(compareCodigoContabil);
    const bpOrdenados = Array.from(bpCodigos).sort(compareCodigoContabil);

    for (const codigo of dreOrdenados) {
      analiseHorizontal.DRE[codigo] = construirSerie(codigo, 'dre');
    }

    for (const codigo of bpOrdenados) {
      analiseHorizontal.BP[codigo] = construirSerie(codigo, 'bp');
    }

    return NextResponse.json(analiseHorizontal);

  } catch (error) {
    console.error('Erro ao calcular análise horizontal:', error);
    return NextResponse.json({
      error: 'Erro ao calcular análise horizontal',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
