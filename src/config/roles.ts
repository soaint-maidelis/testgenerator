import fs from 'fs';
import path from 'path';
import rolesJson from './roles.json';

export type RoleConfig = {
  id: string;
  envPrefix: string;
  projectName: string;
  testMatch: string[];
  testIgnore: string[];
  displayName?: string;
  diagnosticPatterns?: { source: string }[];
};

export type DiagnosticRoleConfig = RoleConfig & {
  project: string;
  displayName: string;
  diagnosticPatterns: { source: string }[];
};

function assertString(value: unknown, field: string, roleId: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid roles.json: role "${roleId}" must define "${field}" as a non-empty string.`);
  }
}

function assertStringArray(value: unknown, field: string, roleId: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new Error(`Invalid roles.json: role "${roleId}" must define "${field}" as a non-empty string array.`);
  }
}

function normalizeRoles(config: unknown): RoleConfig[] {
  if (!Array.isArray(config) || config.length === 0) {
    throw new Error('Invalid roles.json: expected a non-empty array of roles.');
  }

  const projectNames = new Set<string>();
  const roleIds = new Set<string>();

  return config.map((role) => {
    const rawRole = role as Partial<RoleConfig>;
    const roleId = typeof rawRole.id === 'string' && rawRole.id.trim() !== '' ? rawRole.id : '<unknown>';

    assertString(rawRole.id, 'id', roleId);
    assertString(rawRole.envPrefix, 'envPrefix', roleId);
    assertString(rawRole.projectName, 'projectName', roleId);
    assertStringArray(rawRole.testMatch, 'testMatch', roleId);
    assertStringArray(rawRole.testIgnore, 'testIgnore', roleId);

    if (roleIds.has(rawRole.id)) {
      throw new Error(`Invalid roles.json: duplicated role id "${rawRole.id}".`);
    }

    if (projectNames.has(rawRole.projectName)) {
      throw new Error(`Invalid roles.json: duplicated projectName "${rawRole.projectName}".`);
    }

    roleIds.add(rawRole.id);
    projectNames.add(rawRole.projectName);

    return {
      id: rawRole.id,
      envPrefix: rawRole.envPrefix,
      projectName: rawRole.projectName,
      testMatch: rawRole.testMatch,
      testIgnore: rawRole.testIgnore,
      displayName: rawRole.displayName,
      diagnosticPatterns: rawRole.diagnosticPatterns,
    };
  });
}

function buildDiagnosticPatterns(role: RoleConfig): { source: string }[] {
  const testMatchPatterns = role.testMatch.map((pattern) => {
    const folderMatch = pattern.match(/\*\*\/([^/]+)\/\*\*/);
    return folderMatch ? `${escapeRegExp(folderMatch[1])}[\\\\/]` : escapeRegExp(pattern);
  });

  return (
    role.diagnosticPatterns ?? [
      { source: escapeRegExp(role.id) },
      { source: escapeRegExp(role.projectName) },
      ...testMatchPatterns.map((source) => ({ source })),
    ]
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const roles = normalizeRoles(rolesJson);

export const ROLES: DiagnosticRoleConfig[] = roles.map((role) => ({
  ...role,
  project: role.projectName,
  displayName: role.displayName ?? role.id,
  diagnosticPatterns: buildDiagnosticPatterns(role),
}));

export function getRoleByProject(projectName: string): DiagnosticRoleConfig | undefined {
  return ROLES.find((role) => role.project === projectName);
}

export function resolveRoleAuthFile(role: RoleConfig, rootDir: string, options: { validate?: boolean } = {}): string | undefined {
  const authFile = path.join(rootDir, '.auth', `${role.id}.json`);

  if (process.env.PW_NO_STORAGE === 'true') {
    return undefined;
  }

  if (options.validate === false) {
    return authFile;
  }

  if (!fs.existsSync(authFile)) {
    console.warn(
      `[auth:fallback] No existe storageState para rol "${role.id}" en ${authFile}. ` +
        'El test iniciara sin sesion guardada y la fixture intentara login por credenciales.',
    );
    return undefined;
  }

  let raw: { cookies?: unknown[]; origins?: unknown[] };

  try {
    raw = JSON.parse(fs.readFileSync(authFile, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[auth:fallback] Auth state invalido para rol "${role.id}" en ${authFile}. ` +
        `El test iniciara sin sesion guardada y la fixture intentara login por credenciales. ${message}`,
    );
    return undefined;
  }

  if ((raw.cookies?.length ?? 0) === 0 && (raw.origins?.length ?? 0) === 0) {
    console.warn(
      `[auth:fallback] Auth state vacio para rol "${role.id}" en ${authFile}. ` +
        'El test iniciara sin sesion guardada y la fixture intentara login por credenciales.',
    );
    return undefined;
  }

  return authFile;
}
