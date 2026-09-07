import { test, expect } from '@playwright/test';
import { decideIncident } from './incident-policy';
import type { IncidentClassificationInput } from './incident.types';

const baseInput: IncidentClassificationInput = {
  frameworkClassification: 'ASSERTION_FAILURE',
  expectedRole: 'tester',
  usedRole: 'tester',
  expectedProject: 'chromium',
  usedProject: 'chromium',
  phase: 'Validar resultado',
  message: 'Validacion fallida.',
  expected: 'N/D',
  received: 'N/D',
  observedResult: 'N/D',
  errorText: '',
  stack: '',
  contextText: '',
  caseTitle: 'caso de prueba',
  technicalOrigin: 'N/D',
  view: 'N/D',
};

function classify(overrides: Partial<IncidentClassificationInput>) {
  return decideIncident({ ...baseInput, ...overrides });
}

test.describe('incident classifier', () => {
  test('marks expected vs received mismatch as BUG_AUTO', () => {
    const result = classify({ expected: 'Activo', received: 'Inactivo' });

    expect(result.classification).toBe('ASSERTION_FAILURE');
    expect(result.probableCause).toBe('EXPECTED_VALUE_MISMATCH');
    expect(result.decision).toBe('BUG_AUTO');
    expect(result.confidence).toBe('HIGH');
    expect(result.azureDevOpsEligibility).toBe('ELEGIBLE PARA CREACION AUTOMATICA');
    expect(result.recommendation).toContain('Registrar la incidencia funcional');
  });

  test('marks element not found as automation issue', () => {
    const result = classify({ errorText: 'expect(locator).toBeVisible() failed\nLocator: internal container\nError: element(s) not found' });

    expect(result.classification).toBe('AUTOMATION_FAILURE');
    expect(result.probableCause).toBe('ELEMENT_NOT_FOUND');
    expect(result.decision).toBe('AUTOMATION_ISSUE');
    expect(result.confidence).toBe('MEDIUM');
    expect(result.azureDevOpsEligibility).toBe('NO ELEGIBLE');
  });

  test('keeps missing internal technical element as automation issue', () => {
    const result = classify({
      message: 'Debe existir el container tecnico interno.',
      errorText: 'Error: Debe existir el container tecnico interno.\nexpect(locator).toBeVisible() failed\nLocator: page.locator(".radix-popper-content-wrapper")\nError: element(s) not found',
    });

    expect(result.classification).toBe('AUTOMATION_FAILURE');
    expect(result.probableCause).toBe('ELEMENT_NOT_FOUND');
    expect(result.decision).toBe('AUTOMATION_ISSUE');
    expect(result.azureDevOpsEligibility).toBe('NO ELEGIBLE');
  });

  test('marks required functional option missing with correct context as BUG_AUTO', () => {
    const result = classify({
      frameworkClassification: 'NAV_FAILURE',
      phase: 'Ejecutar accion Eliminar desde la tabla',
      message: 'Debe existir la opcion Eliminar en el menu de acciones.',
      errorText: 'Error: Debe existir la opcion Eliminar en el menu de acciones.\nexpect(locator).toBeVisible() failed\nError: element(s) not found',
      caseTitle: 'elimina registro y valida resultado success',
      view: 'Cuentas Contables',
    });

    expect(result.classification).toBe('BUSINESS_RULE_FAILURE');
    expect(result.probableCause).toBe('OPTION_NOT_AVAILABLE');
    expect(result.decision).toBe('BUG_AUTO');
    expect(result.confidence).toBe('HIGH');
    expect(result.azureDevOpsEligibility).toBe('ELEGIBLE PARA CREACION AUTOMATICA');
    expect(result.reason).toBe(
      'El caso requiere funcionalmente la accion Eliminar y la ejecucion se realizo con el rol, proyecto y vista esperados, pero dicha accion no se encuentra disponible.',
    );
    expect(result.recommendation).toContain('Eliminar');
    expect(result.recommendation).toContain('Cuentas Contables');
    expect(result.recommendation).toContain('tester');
  });

  test('marks explicit required option missing with correct context as BUG_AUTO', () => {
    const result = classify({
      errorText: 'Debe existir la opcion SI.\nexpect(locator).toBeVisible() failed\nError: element(s) not found',
      contextText: '- listbox:\n  - option "ATRIBUIBLE"\n  - option "NO ATRIBUIBLE"',
    });

    expect(result.classification).toBe('BUSINESS_RULE_FAILURE');
    expect(result.probableCause).toBe('OPTION_NOT_AVAILABLE');
    expect(result.decision).toBe('BUG_AUTO');
    expect(result.confidence).toBe('HIGH');
    expect(result.azureDevOpsEligibility).toBe('ELEGIBLE PARA CREACION AUTOMATICA');
  });

  test('marks strict mode violation as locator ambiguity', () => {
    const result = classify({ errorText: 'strict mode violation: locator resolved to multiple elements' });

    expect(result.classification).toBe('AUTOMATION_FAILURE');
    expect(result.probableCause).toBe('LOCATOR_AMBIGUOUS');
    expect(result.decision).toBe('AUTOMATION_ISSUE');
    expect(result.confidence).toBe('HIGH');
  });

  test('marks processing timeout as review', () => {
    const result = classify({
      frameworkClassification: 'PROCESSING_TIMEOUT',
      errorText: 'Timeout 30000ms exceeded while esperando respuesta de procesamiento',
    });

    expect(result.classification).toBe('PROCESSING_TIMEOUT');
    expect(result.probableCause).toBe('PROCESS_TIMEOUT');
    expect(result.decision).toBe('BUG_REVIEW');
    expect(result.confidence).toBe('MEDIUM');
  });

  test('marks wrong project as ignored config failure', () => {
    const result = classify({ expectedProject: 'chromium', usedProject: 'firefox' });

    expect(result.classification).toBe('CONFIG_FAILURE');
    expect(result.probableCause).toBe('WRONG_PROJECT');
    expect(result.decision).toBe('IGNORE');
    expect(result.confidence).toBe('HIGH');
  });

  test('marks wrong role as ignored config failure', () => {
    const result = classify({ expectedRole: 'tester', usedRole: 'reviewer' });

    expect(result.classification).toBe('CONFIG_FAILURE');
    expect(result.probableCause).toBe('WRONG_ROLE');
    expect(result.decision).toBe('IGNORE');
    expect(result.confidence).toBe('HIGH');
  });

  test('marks environment unavailable as ignored env failure', () => {
    const result = classify({ frameworkClassification: 'ENV_FAILURE', errorText: '503 service unavailable' });

    expect(result.classification).toBe('ENV_FAILURE');
    expect(result.probableCause).toBe('ENVIRONMENT_UNAVAILABLE');
    expect(result.decision).toBe('IGNORE');
    expect(result.confidence).toBe('HIGH');
  });

  test('marks authentication failure as ignored auth failure', () => {
    const result = classify({ frameworkClassification: 'AUTH_FAILURE', errorText: '401 login failed invalid credentials' });

    expect(result.classification).toBe('AUTH_FAILURE');
    expect(result.probableCause).toBe('AUTHENTICATION_FAILED');
    expect(result.decision).toBe('IGNORE');
    expect(result.confidence).toBe('HIGH');
  });

  test('marks missing test data as ignored data failure', () => {
    const result = classify({ frameworkClassification: 'DATA_FAILURE', errorText: 'ENOENT fixture archivo no existe' });

    expect(result.classification).toBe('DATA_FAILURE');
    expect(result.probableCause).toBe('MISSING_TEST_DATA');
    expect(result.decision).toBe('IGNORE');
    expect(result.confidence).toBe('HIGH');
  });
});
