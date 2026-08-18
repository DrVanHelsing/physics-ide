export const CLASS_ROLES = ["student", "ta", "teacher"] as const;
export type ClassRole = (typeof CLASS_ROLES)[number];

export const ACCOUNT_ROLES = ["user", "admin"] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];
