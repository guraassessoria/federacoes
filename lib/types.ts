// Tipos para os dados financeiros

export interface KPIs {
  receita_total: number;
  resultado_liquido: number;
  ebitda: number;
  ativo_total: number;
  patrimonio_liquido: number;
  capital_giro: number;
  margem_liquida: number;
  roe: number;
  liquidez_corrente: number;
  endividamento_geral: number;
}

export interface ResumoExecutivo {
  metadata: {
    nome_entidade: string;
    periodo: string;
    data_geracao: string;
    moeda: string;
  };
  kpis_principais: Record<string, KPIs>;
  evolucao_trienal: Record<string, Record<string, number>>;
  destaques: Record<string, { descricao: string; valor: string; status: string }>;
  alertas: Array<{
    tipo: string;
    categoria: string;
    descricao: string;
    valor: number;
    recomendacao: string;
  }>;
  composicao_receita_2025: Record<string, { valor: number; percentual: number }>;
  distribuicao_custos_despesas_2025: Record<string, { valor: number; percentual: number }>;
}

export interface IndicesFinanceiros {
  [ano: string]: {
    Liquidez: Record<string, number>;
    Rentabilidade: Record<string, number>;
    Endividamento: Record<string, number>;
    Atividade: Record<string, number>;
    Outros: Record<string, number>;
  };
}

export interface AnaliseHorizontal {
  DRE: Record<string, Record<string, number>>;
  BP: Record<string, Record<string, number>>;
}

export interface AnaliseVertical {
  DRE: Record<string, Record<string, number>>;
  BP: Record<string, Record<string, number>>;
}

export interface DemonstracaoFinanceira {
  DRE: Record<string, number>;
  BP: Record<string, number>;
}

export interface DemonstracoesFinanceiras {
  [ano: string]: DemonstracaoFinanceira;
}
