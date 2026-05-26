import path from "node:path";
import {
  expandHomePrefix,
  resolveDefaultBackupDir as resolveSharedDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir as resolveSharedDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir as resolveSharedDefaultLogsDir,
  resolveDefaultSecretsKeyFilePath as resolveSharedDefaultSecretsKeyFilePath,
  resolveDefaultStorageDir as resolveSharedDefaultStorageDir,
  resolveHomeAwarePath,
  resolveDealDeskConfigPathForInstance,
  resolveDealDeskHomeDir,
  resolveDealDeskInstanceId,
  resolveDealDeskInstanceRoot as resolveSharedDealDeskInstanceRoot,
} from "@dealdesk/shared/home-paths";

export {
  expandHomePrefix,
  resolveHomeAwarePath,
  resolveDealDeskHomeDir,
  resolveDealDeskInstanceId,
};

export function resolveDealDeskInstanceRoot(instanceId?: string): string {
  return resolveSharedDealDeskInstanceRoot({ instanceId });
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return resolveDealDeskConfigPathForInstance({ instanceId });
}

export function resolveDefaultContextPath(): string {
  return path.resolve(resolveDealDeskHomeDir(), "context.json");
}

export function resolveDefaultCliAuthPath(): string {
  return path.resolve(resolveDealDeskHomeDir(), "auth.json");
}

export function resolveDefaultEmbeddedPostgresDir(instanceId?: string): string {
  return resolveSharedDefaultEmbeddedPostgresDir({ instanceId });
}

export function resolveDefaultLogsDir(instanceId?: string): string {
  return resolveSharedDefaultLogsDir({ instanceId });
}

export function resolveDefaultSecretsKeyFilePath(instanceId?: string): string {
  return resolveSharedDefaultSecretsKeyFilePath({ instanceId });
}

export function resolveDefaultStorageDir(instanceId?: string): string {
  return resolveSharedDefaultStorageDir({ instanceId });
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return resolveSharedDefaultBackupDir({ instanceId });
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolveDealDeskInstanceId(instanceId);
  const instanceRoot = resolveDealDeskInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolveDealDeskHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    logDir: resolveDefaultLogsDir(resolvedInstanceId),
    secretsKeyFilePath: resolveDefaultSecretsKeyFilePath(resolvedInstanceId),
    storageDir: resolveDefaultStorageDir(resolvedInstanceId),
  };
}
