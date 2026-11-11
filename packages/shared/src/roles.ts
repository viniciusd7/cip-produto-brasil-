export const ROLES = {
  ADMIN: "admin",
  PREFEITO: "prefeito",
  GESTOR: "gestor",
  ANALISTA: "analista",
  LEITURA: "leitura",
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleCode, string> = {
  admin: "Administrador",
  prefeito: "Gabinete do Prefeito",
  gestor: "Secretário",
  analista: "Consultor",
  leitura: "Somente leitura",
};

export const PERMISSIONS = {
  MUNICIPIO_MANAGE: "municipio:manage",
  USERS_MANAGE: "users:manage",
  INICIATIVA_READ: "iniciativa:read",
  INICIATIVA_WRITE: "iniciativa:write",
  MARCO_WRITE: "marco:write",
  EVIDENCIA_SUBMIT: "evidencia:submit",
  EVIDENCIA_VALIDATE: "evidencia:validate",
  SECRETARIA_MANAGE: "secretaria:manage",
  IMPORT_RUN: "import:run",
  REPORT_EXPORT: "report:export",
  AUDIT_READ: "audit:read",
  /** Secretário pede conclusão/registra reprogramação da própria pauta. */
  TAREFA_SOLICITAR: "tarefa:solicitar",
  /** Consultor valida conclusões pedidas pela secretaria. */
  TAREFA_VALIDAR: "tarefa:validar",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleCode, PermissionCode[]> = {
  admin: Object.values(PERMISSIONS),
  prefeito: [
    PERMISSIONS.INICIATIVA_READ,
    PERMISSIONS.SECRETARIA_MANAGE,
    PERMISSIONS.REPORT_EXPORT,
    PERMISSIONS.AUDIT_READ,
  ],
  gestor: [
    PERMISSIONS.INICIATIVA_READ,
    PERMISSIONS.EVIDENCIA_SUBMIT,
    PERMISSIONS.TAREFA_SOLICITAR,
    PERMISSIONS.REPORT_EXPORT,
  ],
  analista: [
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.INICIATIVA_READ,
    PERMISSIONS.INICIATIVA_WRITE,
    PERMISSIONS.MARCO_WRITE,
    PERMISSIONS.EVIDENCIA_SUBMIT,
    PERMISSIONS.EVIDENCIA_VALIDATE,
    PERMISSIONS.TAREFA_VALIDAR,
    PERMISSIONS.REPORT_EXPORT,
  ],
  leitura: [PERMISSIONS.INICIATIVA_READ, PERMISSIONS.REPORT_EXPORT],
};
