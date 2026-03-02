# Guia de Correções - Inconsistências do Projeto

## 🎯 RESUMO EXECUTIVO

Este guia contém **exemplos de código** para corrigir as 10 inconsistências principais identificadas.

---

## 1️⃣ CORREÇÃO: Unificar Modelos de Balancete

**Antes:**
```prisma
model BalanceteData {
  accountNumber: string;
  previousBalance: Decimal;
  period: String;
}

model BalanceteRow {
  conta: string;
  saldoInicial: Decimal;
  periodo: String;
}
```

**Depois:**
```prisma
model Balancete {
  id String @id @default(cuid())
  companyId String
  period String
  accountCode String
  accountDescription String
  openingBalance Decimal @db.Decimal(18, 2)
  debit Decimal @db.Decimal(18, 2)
  credit Decimal @db.Decimal(18, 2)
  closingBalance Decimal @db.Decimal(18, 2)
  accountNature String
  createdAt DateTime @default(now())
  
  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  
  @@unique([companyId, period, accountCode])
  @@index([companyId, period])
  @@index([accountCode])
}
```

**Passos:**
1. Criar migration: `npx prisma migrate dev --name unify_balancete`
2. Migrar dados do `BalanceteRow` para `Balancete`
3. Deletar `BalanceteRow`
4. Atualizar imports em todo projeto

---

## 2️⃣ CORREÇÃO: Storage Strategy

**Criar arquivo abstraído:**

```typescript
// lib/storage/types.ts
export interface StorageProvider {
  uploadFile(key: string, data: Buffer, options?: any): Promise<{ url: string }>;
  deleteFile(key: string): Promise<void>;
  getFileUrl(key: string): Promise<string>;
}

// lib/storage/providers/vercel.ts
import { put, del } from "@vercel/blob";

export class VercelStorageProvider implements StorageProvider {
  async uploadFile(key: string, data: Buffer, options: any = {}) {
    const blob = await put(key, data, {
      access: options.isPublic ? "public" : "private",
      contentType: options.contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });
    return { url: blob.url };
  }

  async deleteFile(key: string): Promise<void> {
    // Implementar
  }

  async getFileUrl(key: string): Promise<string> {
    // Implementar
  }
}

// lib/storage/index.ts
export function getStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || "vercel";
  switch (provider) {
    case "s3":
      return new S3StorageProvider();
    case "vercel":
      return new VercelStorageProvider();
    default:
      throw new Error(`Unknown storage provider: ${provider}`);
  }
}
```

**Remover:**
- `@azure/storage-blob` de package.json (não usado)
- `lib/aws-config.ts` (se trocar para Vercel)

---

## 3️⃣ CORREÇÃO: Alinhar Versões Next.js

**Atualizar package.json:**
```diff
{
- "@next/swc-wasm-nodejs": "13.5.1",
+ "@next/swc-wasm-nodejs": "15.3.0",
- "next": "14.2.28",
+ "next": "15.3.0",
  "eslint-config-next": "15.3.0",
}
```

**Execute:**
```bash
npm install
npm run build
```

---

## 4️⃣ CORREÇÃO: Padronizar Exportações

**Antes:**
```tsx
// components/kpi-card.tsx
export default function KPICard(props) { }

// components/sidebar.tsx
export function Providers(props) { }
```

**Depois (tudo como named exports):**
```tsx
// components/kpi-card.tsx
export function KPICard(props) { }

// components/sidebar.tsx
export function Sidebar(props) { }

// components/index.ts (barrel export)
export { KPICard } from './kpi-card';
export { Sidebar } from './sidebar';
export { Providers } from './providers';
```

**Atualizar imports:**
```diff
- import KPICard from '@/components/kpi-card';
+ import { KPICard } from '@/components';

- import { Providers } from '@/components/providers';
+ import { Providers } from '@/components';
```

---

## 5️⃣ CORREÇÃO: Nomenclatura Consistente

**Criar mapping de termos:**

```typescript
// lib/terminology.ts

export const TERMINOLOGY = {
  // Financial
  income: "renda",
  expense: "despesa",
  balance: "saldo",
  account: "conta",
  debit: "débito",
  credit: "crédito",
  
  // Time periods
  opening: "abertura",
  closing: "fechamento",
  period: "período",
} as const;

// Usar em interfaces
export interface BalanceteAccount {
  code: string;           // always English in code
  description: string;
  openingBalance: number;
  debit: number;
  credit: number;
  closingBalance: number;
}
```

**Regra:**
- **TypeScript/code:** `camelCase` + English
- **Database:** `snake_case` + English
- **UI labels:** Português (via i18n)

---

## 6️⃣ CORREÇÃO: Validação com Zod

**Criar validators:**

```typescript
// lib/validators/index.ts
import { z } from 'zod';

export const FinancialDataQuerySchema = z.object({
  companyId: z.string().uuid("Invalid company ID"),
  viewMode: z.enum(['anual', 'mensal']).default('anual'),
  year: z.string().regex(/^\d{4}$/, "Year must be YYYY format"),
  month: z.string().regex(/^\d{2}$/, "Month must be MM format").optional(),
});

export type FinancialDataQuery = z.infer<typeof FinancialDataQuerySchema>;

// Usar em API
export async function GET(request: NextRequest) {
  try {
    const params = FinancialDataQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams)
    );
    // params é type-safe
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
  }
}
```

---

## 7️⃣ CORREÇÃO: Error Handling Centralizado

**Criar handler:**

```typescript
// lib/errorHandler.ts
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: 'Validation error',
        details: error.errors,
      },
    };
  }

  return {
    status: 500,
    body: {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };
}

// Usar em API
export async function GET(request: NextRequest) {
  try {
    // lógica
  } catch (error) {
    const { status, body } = handleApiError(error);
    return NextResponse.json(body, { status });
  }
}
```

---

## 8️⃣ CORREÇÃO: Cache Centralizado

```typescript
// lib/cache/index.ts
type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttl: number = 3600000) {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  invalidate(pattern?: string) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const cacheManager = new CacheManager();
```

---

## 9️⃣ CORREÇÃO: Organizar Imports

**Configurar ESLint:**

```json
// .eslintrc.json
{
  "rules": {
    "import/order": [
      "error",
      {
        "groups": [
          "builtin",
          "external",
          "internal",
          "parent",
          "sibling",
          "index"
        ],
        "alphabeticalOrder": true
      }
    ]
  }
}
```

**Aplicar automaticamente:**
```bash
npx eslint . --fix
```

---

## 🔟 CORREÇÃO: Constantes Centralizadas

```typescript
// lib/constants.ts

export const API_ENDPOINTS = {
  // Auth
  LOGIN: "/api/auth/signin",
  LOGOUT: "/api/auth/signout",
  
  // Users
  USERS: "/api/users",
  USER: (id: string) => `/api/users/${id}`,
  USER_COMPANIES: "/api/user/companies",
  
  // Companies
  COMPANIES: "/api/companies",
  COMPANY: (id: string) => `/api/companies/${id}`,
  
  // Financial
  FINANCIAL_DATA: "/api/financial-data",
  
  // Upload
  UPLOAD_PRESIGNED: "/api/upload/presigned",
} as const;

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  ADMIN: "/admin",
  UPLOAD: "/upload",
} as const;

export const UI = {
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
} as const;

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

// Usar em código
import { API_ENDPOINTS, ROUTES } from '@/lib/constants';

// Antes
fetch('/api/financial-data?companyId=123')
// Depois
fetch(`${API_ENDPOINTS.FINANCIAL_DATA}?companyId=123`)
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### ✅ Semana 1 (Críticas)
- [ ] Unificar BalanceteData/BalanceteRow
- [ ] Definir storage provider primário
- [ ] Atualizar Next.js para v15.3.0
- [ ] Testar build completo

### ✅ Semana 2-3 (Moderadas)
- [ ] Padronizar exportações de componentes
- [ ] Implementar Zod em todas APIs
- [ ] Centralizar error handling
- [ ] Criar constantes

### ✅ Semana 4 (Menores)
- [ ] Organizar imports
- [ ] Consolidar cache
- [ ] Adicionar documentação
- [ ] Rodar testes

---

## 🧪 TESTES RECOMENDADOS

```bash
# Verificar tipos
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Testes (se houver)
npm test
```

---

**Total de correções:** 10  
**Tempo estimado:** 3-4 semanas  
**Prioridade:** 🔴 Crítica depois 🟡 Moderada depois 🔵 Menor
