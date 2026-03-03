import { z } from 'zod';

export const FinancialDataQuerySchema = z.object({
  companyId: z.string().nonempty("companyId is required"),
  viewMode: z.enum(['anual', 'mensal']).default('anual'),
  year: z.string().regex(/^\d{4}$/, "Year must be YYYY format"),
  month: z.string().regex(/^\d{2}$/, "Month must be MM format").optional(),
});

export type FinancialDataQuery = z.infer<typeof FinancialDataQuerySchema>;

// other schemas can be added here as needed
export const ClearDataBodySchema = z.object({
  companyId: z.string().nonempty("companyId é obrigatório"),
  startPeriod: z.string().optional(),
  endPeriod: z.string().optional(),
  dataTypes: z.array(z.enum(['balancetes', 'dePara'])).optional(),
});

export type ClearDataBody = z.infer<typeof ClearDataBodySchema>;
