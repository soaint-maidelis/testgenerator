export interface JiraConfig {
  readonly baseUrl: string;
  readonly email: string;
  readonly apiToken: string;
  readonly projectKey: string;
  readonly issueType: string;
}

const VARIABLES = [
  'JIRA_BASE_URL',
  'JIRA_EMAIL',
  'JIRA_API_TOKEN',
  'JIRA_PROJECT_KEY',
] as const;

export function loadJiraConfig(environment: NodeJS.ProcessEnv = process.env): JiraConfig {
  const missing = VARIABLES.filter((name) => !environment[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing Jira environment variables: ${missing.join(', ')}`);
  }

  return {
    baseUrl: environment.JIRA_BASE_URL!.trim(),
    email: environment.JIRA_EMAIL!.trim(),
    apiToken: environment.JIRA_API_TOKEN!.trim(),
    projectKey: environment.JIRA_PROJECT_KEY!.trim(),
    issueType: environment.JIRA_ISSUE_TYPE?.trim() || 'Bug',
  };
}
