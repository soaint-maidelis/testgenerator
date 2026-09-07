export interface AzureConfig {
  readonly organization: string;
  readonly project: string;
  readonly pat: string;
  readonly workItemType: string;
}

const VARIABLES = [
  'AZURE_DEVOPS_ORG',
  'AZURE_DEVOPS_PROJECT',
  'AZURE_DEVOPS_PAT',
] as const;

export function loadAzureConfig(environment: NodeJS.ProcessEnv = process.env): AzureConfig {
  const missing = VARIABLES.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing Azure DevOps environment variables: ${missing.join(', ')}`);
  }

  return {
    organization: environment.AZURE_DEVOPS_ORG!.trim(),
    project: environment.AZURE_DEVOPS_PROJECT!.trim(),
    pat: environment.AZURE_DEVOPS_PAT!.trim(),
    workItemType: environment.AZURE_DEVOPS_WORK_ITEM_TYPE?.trim() || 'Bug',
  };
}
