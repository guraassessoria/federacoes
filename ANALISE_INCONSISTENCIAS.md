# Análise de Inconsistências - Dashboard Federações

**Data:** 02/03/2026  
**Status:** Análise Completa

---

## 📋 SUMÁRIO EXECUTIVO

O projeto é um **Dashboard Financeiro Next.js** com TypeScript, Prisma, Tailwind e autenticação NextAuth. Foi identificado **um nível MODERADO de inconsistências**, principalmente relacionado a:

1. **Duplicação de modelos no banco de dados**
2. **Padrões de exportação inconsistentes em componentes**
3. **Múltiplos provedores de storage sem padrão definido**
4. **Nomenclatura mista (camelCase/snake_case)**
5. **Versões desalinhadas de dependências**

---

## 🔴 INCONSISTÊNCIAS CRÍTICAS

### 1. **Duplicação de Modelos: BalanceteData vs BalanceteRow**

**Localização:** [prisma/schema.prisma](prisma/schema.prisma)

**Problema:**
```prisma
model BalanceteData {
  id String @id @default(cuid())
  companyId String
  period String
  accountNumber String
  accountDescription String
  previousBalance Decimal @db.Decimal(18, 2)
  debit Decimal @db.Decimal(18, 2)
  credit Decimal @db.Decimal(18, 2)
  finalBalance Decimal @db.Decimal(18, 2)
  @@unique([companyId, period, accountNumber])
}

model BalanceteRow {
  id String @id @default(cuid())
  companyId String
  periodo String
  conta String
  descricao String?
  saldoInicial Decimal? @db.Decimal(18,2)
  debito Decimal? @db.Decimal(18,2)
  credito Decimal? @db.Decimal(18,2)
  saldoFinal Decimal? @db.Decimal(18,2)
}
```

**Impacto:**
- Dois modelos praticamente idênticos mas com nomenclatura diferente
- `BalanceteData` usa `camelCase` + inglês, `BalanceteRow` usa `camelCase` + português
- `period` vs `periodo`, `accountNumber` vs `conta`, `previousBalance` vs `saldoInicial`
- Causa confusão sobre qual usar e duplica migrations

**Recomendação:**
✅ **Unificar em um único modelo** com nomenclatura consistente:
```prisma
model Balancete {
  id String @id @default(cuid())
  companyId String
  period String
  accountCode String      // "conta"
  accountDescription String
  openingBalance Decimal @db.Decimal(18, 2)
  debit Decimal @db.Decimal(18, 2)
  credit Decimal @db.Decimal(18, 2)
  closingBalance Decimal @db.Decimal(18, 2)
  @@unique([companyId, period, accountCode])
  @@index([companyId, period])
}
```

---

### 2. **Múltiplos Provedores de Storage sem Estratégia Clara**

**Localização:**
- AWS S3: [lib/s3.ts](lib/s3.ts), [lib/aws-config.ts](lib/aws-config.ts)
- Azure Blob: `@azure/storage-blob` (instalado mas não usado)
- Vercel Blob: [app/api/upload/presigned/route.ts](app/api/upload/presigned/route.ts)

**Problema:**
```json
{
  "@aws-sdk/client-s3": "^3.0.0",
  "@aws-sdk/s3-request-presigner": "^3.0.0",
  "@azure/storage-blob": "^12.0.0",
  "@vercel/blob": "^2.3.0"
}
```

- Três bibliotecas diferentes de storage instaladas
- `@azure/storage-blob` importado mas nunca usado
- Lógica mista entre S3 e Vercel Blob em diferentes endpoints
- Não está claro qual é o provedor principal

**Impacto:**
- Dependências desnecessárias aumentam bundle size
- Confusão para novos desenvolvedores
- Difícil migração futura

**Recomendação:**
✅ **Escolher um provedor primário** e remover os outros:
- Se usar **Vercel Blob**: remover `@aws-sdk/*` e `@azure/storage-blob`
- Se usar **AWS S3**: remover `@vercel/blob` e `@azure/storage-blob`
- Consolidar toda lógica de storage em um único módulo abstrato

---

### 3. **Versões Desalinhadas de Dependências Next.js**

**Localização:** [package.json](package.json)

**Problema:**
```json
{
  "eslint-config-next": "15.3.0",      // ← Versão 15.3.0
  "@next/swc-wasm-nodejs": "13.5.1",   // ← Versão 13.5.1 (DESALINHADA!)
  "next": "14.2.28"                    // ← Versão 14.2.28 (DESALINHADA!)
}
```

**Impacto:**
- Potencial incompatibilidade entre ESLint e compilador Next.js
- SWC em v13 mas Next em v14
- Erros imprevisíveis na build

**Recomendação:**
✅ **Alinhar todas as versões Next.js:**
```json
{
  "next": "15.3.0",
  "@next/swc-wasm-nodejs": "15.3.0",
  "eslint-config-next": "15.3.0"
}
```

---

## 🟡 INCONSISTÊNCIAS MODERADAS

### 4. **Padrões de Exportação Inconsistentes em Componentes**

**Localização:** `components/`

**Problema:**

Componentes usam **padrões mistos** de export:

```tsx
// ❌ Inconsistente 1: export default function
export default function KPICard(props) { }           // [components/kpi-card.tsx]
export default function Sidebar() { }               // [components/sidebar.tsx]
export default function IndicatorCard(props) { }    // [components/indicator-card.tsx]
export default function AlertCard(props) { }        // [components/alert-card.tsx]

// ❌ Inconsistente 2: export function (named)
export function Providers(props) { }                // [components/providers.tsx]
export function ThemeProvider(props) { }            // [components/theme-provider.tsx]
export function Toaster() { }                       // [components/ui/toaster.tsx]
```

**Impacto:**
- Inconsistência na forma de importar componentes
- Dificulta refatoração
- Reduz padrão visual no codebase

**Recomendação:**
✅ **Padronizar para named exports:**
```tsx
// Todos os componentes
export function KPICard(props) { }
export function Sidebar(props) { }
export function Providers(props) { }

// E importar como:
import { KPICard, Sidebar, Providers } from '@/components'
```

---

### 5. **Nomenclatura Mista: English/Portuguese e camelCase/snake_case**

**Localização:** Várias

**Exemplos:**

```typescript
// ❌ Mistura português e inglês
interface KPIs {
  receita_total: number;          // snake_case + português
  resultado_liquido: number;
  roe: number;                    // inglês
  liquidez_corrente: number;      // snake_case + português
}

// ❌ Schema Prisma misturado
model BalanceteData {
  accountNumber: string;          // camelCase + English
  previousBalance: Decimal;
}

model BalanceteRow {
  conta: string;                  // português direto
  saldoInicial: Decimal;          // camelCase + português
}
```

**Impacto:**
- Código menos legível
- Difícil de navegar para novos desenvolvedores
- Erros de digitação

**Recomendação:**
✅ **Estabelecer guia de estilo:**
- **Código TypeScript/JavaScript:** `camelCase` + English
- **Banco de dados:** `snake_case` + English (ou `camelCase`)
- **UI/Labels:** Português
- **Enums:** `UPPER_SNAKE_CASE`

---

### 6. **Falta de Validação de Tipos em APIs**

**Localização:** [app/api/](app/api/)

**Problema:**
```typescript
// ❌ Sem validação de tipo
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");  // string | null, não validado
  const viewMode = searchParams.get("viewMode") || "anual";
  const year = searchParams.get("year") || "2025";
}

export async function POST(request: NextRequest) {
  const body = await request.json();  // ❌ Sem validação de schema
  // usar body diretamente pode causar erros
}
```

**Impacto:**
- Vulnerabilidade a dados malformados
- Erros em runtime
- Falta de documentação clara sobre schema esperado

**Recomendação:**
✅ **Usar Zod ou similar:**
```typescript
import { z } from 'zod';

const querySchema = z.object({
  companyId: z.string().nonempty(),
  viewMode: z.enum(['anual', 'mensal']).default('anual'),
  year: z.string().regex(/^\d{4}$/),
});

export async function GET(request: NextRequest) {
  const params = querySchema.parse(Object.fromEntries(
    new URL(request.url).searchParams
  ));
}
```

---

### 7. **Tratamento de Erros Inconsistente**

**Localização:** APIs e Serviços

**Problema:**
```typescript
// ❌ Inconsistente 1: Sem erro details
catch (error) {
  console.error("Error:", error);
  return NextResponse.json({ error: "Erro" }, { status: 500 });
}

// ❌ Inconsistente 2: Logs demais
catch (error: any) {
  console.error("Blob upload error:", err);
  return NextResponse.json({ error: "Failed to upload" }, { status: 500 });
}

// ❌ Inconsistente 3: Sem stack trace
try { ... } catch (e) { }
```

**Recomendação:**
✅ **Criar middleware de erro centralizado:**
```typescript
// lib/errorHandler.ts
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
  }
}

// Usar em APIs
try {
  // ...
} catch (error) {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  logger.error(error);
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
```

---

## 🔵 INCONSISTÊNCIAS MENORES

### 8. **Padrões de Cache Inconsistentes**

**Localização:** [lib/services/estruturaMapping.ts](lib/services/estruturaMapping.ts)

```typescript
// ❌ Cache manual com variáveis globais
let estruturaDRECache: ContaEstrutura[] | null = null;
let estruturaBPCache: ContaEstrutura[] | null = null;

// Melhor seria usar estratégia consistente
```

**Recomendação:**
✅ Usar `@tanstack/react-query` (já instalado) ou criar abstração centralizada

---

### 9. **Imports Inconsistentes**

**Localização:** Múltiplos arquivos

```typescript
// ❌ Sem padrão de organização
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Melhor seria agrupar por categoria
```

**Recomendação:**
✅ Usar eslint com rule `import/order`

---

### 10. **Falta de Constantes Centralizadas**

**Localização:** Projeto inteiro

```typescript
// ❌ Strings hardcoded espalhadas
"/api/user/companies"
"/admin"
"/upload"
"force-dynamic"
```

**Recomendação:**
✅ Criar `lib/constants.ts`:
```typescript
export const API_ENDPOINTS = {
  USER_COMPANIES: "/api/user/companies",
  FINANCIAL_DATA: "/api/financial-data",
} as const;

export const ROUTES = {
  ADMIN: "/admin",
  UPLOAD: "/upload",
} as const;
```

---

## 📊 MATRIZ DE INCONSISTÊNCIAS

| # | Categoria | Severidade | Componentes Afetados | Tipo |
|---|-----------|-----------|----------------------|------|
| 1 | Schema DB | CRÍTICA | Prisma | Duplicação |
| 2 | Storage | CRÍTICA | AWS, Azure, Vercel | Múltipla Estratégia |
| 3 | Next.js | CRÍTICA | package.json | Versionamento |
| 4 | Componentes | MODERADA | components/ | Exportação |
| 5 | Nomenclatura | MODERADA | Todo projeto | Estilo de Código |
| 6 | Validação | MODERADA | app/api/ | Type Safety |
| 7 | Erros | MODERADA | APIs | Exception Handling |
| 8 | Cache | MENOR | lib/services | Padrão |
| 9 | Imports | MENOR | Todo projeto | Organização |
| 10 | Constantes | MENOR | Todo projeto | Magic Strings |

---

## ✅ PLANO DE AÇÃO RECOMENDADO

### Fase 1: CRÍTICAS (1-2 semanas)

1. **Remover modelo BalanceteRow** - manter apenas BalanceteData com nomenclatura corrigida
2. **Definir provedor primário de storage** - remover dependências não usadas
3. **Alinhar versões Next.js** - atualizar para v15.3.0

### Fase 2: MODERADAS (2-3 semanas)

4. **Padronizar exportações de componentes** - tudo para named exports
5. **Implementar Zod** para validação em todas as APIs
6. **Criar estratégia centralizada** de tratamento de erros

### Fase 3: MENORES (1 semana)

7. Consolidar padrão de cache
8. Organizar imports com ESLint
9. Criar `lib/constants.ts`

---

## 📝 ARQUIVOS RECOMENDADOS PARA CRIAÇÃO

```
lib/
├── constants.ts          (novo)
├── errorHandler.ts       (novo)
├── validators.ts         (novo)
├── storage/              (novo)
│   └── index.ts
└── cache/                (novo)
    └── index.ts
```

---

## 🔗 REFERÊNCIAS

- [Next.js Best Practices](https://nextjs.org/docs)
- [Prisma Schema](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Zod Validation](https://zod.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Preparado por:** Code Analysis Agent  
**Data da Análise:** 02/03/2026
