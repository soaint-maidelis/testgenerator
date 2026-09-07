import { expect, test } from '@playwright/test';
import { createIncidentProvider } from './incident-provider.factory';
import { AzureProvider } from './azure/azure.provider';
import { JiraProvider } from './jira/jira.provider';
import { NoneProvider } from './none/none.provider';
import { TrelloProvider } from './trello/trello.provider';
import { makeProviderTestConfig } from './provider-test-helpers';

test.describe('incident provider factory', () => {
  test('azure returns AzureProvider', () => {
    expect(createIncidentProvider(makeProviderTestConfig('azure'))).toBeInstanceOf(AzureProvider);
  });

  test('jira returns JiraProvider', () => {
    expect(createIncidentProvider(makeProviderTestConfig('jira'))).toBeInstanceOf(JiraProvider);
  });

  test('trello returns TrelloProvider', () => {
    expect(createIncidentProvider(makeProviderTestConfig('trello'))).toBeInstanceOf(TrelloProvider);
  });

  test('none returns NoneProvider', () => {
    expect(createIncidentProvider(makeProviderTestConfig('none'))).toBeInstanceOf(NoneProvider);
  });

  test('unknown provider fails closed', () => {
    expect(() => createIncidentProvider({ ...makeProviderTestConfig('none'), provider: 'unknown' as never })).toThrow(/INCIDENT_PROVIDER no soportado/);
  });
});
