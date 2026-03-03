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
  // Admin operations
  ADMIN_STANDARD_FILES: "/api/admin/standard-files",
  
  // Financial
  FINANCIAL_DATA: "/api/financial-data",
  GENERATE_REPORT_PDF: "/api/generate-report-pdf",
  GENERATE_COMPARATIVE_PDF: "/api/generate-comparative-pdf",
  // File operations
  FILES_BALANCETE: "/api/files/balancete",
  FILES_DE_PARA: "/api/files/de-para",
  FILES_BALANCETE_UPLOAD: "/api/files/balancete/upload",
  FILES_DE_PARA_UPLOAD: "/api/files/de-para/upload",
  
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
