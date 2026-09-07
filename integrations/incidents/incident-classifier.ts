import type {
  IncidentClassification,
  IncidentClassificationInput,
  ProbableCause,
  TechnicalClassification,
} from './incident.types';
import { debugIncident, sourceFile } from './incident-debug';

export function classifyIncident(input: IncidentClassificationInput): IncidentClassification {
  const text = normalize(
    [
      input.frameworkClassification,
      input.phase,
      input.message,
      input.expected,
      input.received,
      input.observedResult,
      input.errorText,
      input.stack,
      input.contextText,
      input.caseTitle,
      input.technicalOrigin,
      input.view,
    ].join('\n'),
  );

  if (hasValue(input.expectedProject) && hasValue(input.usedProject) && input.expectedProject !== input.usedProject) {
    return result('CONFIG_FAILURE', 'WRONG_PROJECT', 'HIGH', 'El proyecto Playwright usado no coincide con el esperado.');
  }

  if (hasValue(input.expectedRole) && hasValue(input.usedRole) && input.expectedRole !== input.usedRole) {
    return result('CONFIG_FAILURE', 'WRONG_ROLE', 'HIGH', 'El rol usado no coincide con el rol esperado.');
  }

  if (/401|login failed|invalid credentials|authentication failed|login\.microsoftonline|signin|i0116|i0118/i.test(text)) {
    return result('AUTH_FAILURE', 'AUTHENTICATION_FAILED', 'HIGH', 'El fallo corresponde al flujo de autenticacion.');
  }

  if (/session expired|sesion expirada|no hay registros disponibles/i.test(text)) {
    return result('AUTH_FAILURE', 'SESSION_EXPIRED', 'HIGH', 'La sesion o estado base del entorno no esta disponible.');
  }

  if (/enoent|no such file|fixture .*no existe|fixture .*not found|missing fixture|archivo no existe|dato previo faltante|registro previo no existe|missing test data/i.test(text)) {
    return result('DATA_FAILURE', 'MISSING_TEST_DATA', 'HIGH', 'Faltan datos, archivos o prerequisitos para ejecutar el caso.');
  }

  if (/econnreset|etimedout|err_connection_refused|econnrefused|dns|network/i.test(text)) {
    return result('ENV_FAILURE', 'NETWORK_FAILURE', 'HIGH', 'El fallo corresponde a conectividad o red.');
  }

  if (/\b500\b|\b503\b|service unavailable|environment unavailable|aplicaci[oÃ³]n no disponible/i.test(text)) {
    return result('ENV_FAILURE', 'ENVIRONMENT_UNAVAILABLE', 'HIGH', 'El ambiente o servicio no esta disponible.');
  }

  if (/strict mode violation|resolved to multiple elements|locator resolved to multiple/i.test(text)) {
    return result('AUTOMATION_FAILURE', 'LOCATOR_AMBIGUOUS', 'HIGH', 'El locator resolvio multiples elementos.');
  }

  if (isUnequivocalAutomationError(text)) {
    return result('AUTOMATION_FAILURE', 'ELEMENT_NOT_INTERACTABLE', 'HIGH', 'El fallo corresponde a un problema tecnico de automatizacion.');
  }

  if (/element\(s\) not found/i.test(text)) {
    return classifyNotFound(text, input);
  }

  if (/element is not enabled|element is not editable|outside viewport|element is detached|not stable|not enabled|disabled/i.test(text)) {
    return result(
      probablePermissionContext(text) ? 'PERMISSION_FAILURE' : 'AUTOMATION_FAILURE',
      probablePermissionContext(text) ? 'PERMISSION_DENIED' : 'ELEMENT_NOT_INTERACTABLE',
      'MEDIUM',
      'El elemento existe pero no esta disponible para interaccion.',
    );
  }

  if (/401|login failed|invalid credentials|authentication failed|login\.microsoftonline|signin|i0116|i0118/i.test(text)) {
    return result('AUTH_FAILURE', 'AUTHENTICATION_FAILED', 'HIGH', 'El fallo corresponde al flujo de autenticacion.');
  }

  if (/session expired|sesion expirada|no hay registros disponibles/i.test(text)) {
    return result('AUTH_FAILURE', 'SESSION_EXPIRED', 'HIGH', 'La sesion o estado base del entorno no esta disponible.');
  }

  if (/enoent|no such file|fixture .*no existe|fixture .*not found|missing fixture|archivo no existe|dato previo faltante|registro previo no existe|missing test data/i.test(text)) {
    return result('DATA_FAILURE', 'MISSING_TEST_DATA', 'HIGH', 'Faltan datos, archivos o prerequisitos para ejecutar el caso.');
  }

  if (/econnreset|etimedout|err_connection_refused|econnrefused|dns|network/i.test(text)) {
    return result('ENV_FAILURE', 'NETWORK_FAILURE', 'HIGH', 'El fallo corresponde a conectividad o red.');
  }

  if (/\b500\b|\b503\b|service unavailable|environment unavailable|aplicaci[oó]n no disponible/i.test(text)) {
    return result('ENV_FAILURE', 'ENVIRONMENT_UNAVAILABLE', 'HIGH', 'El ambiente o servicio no esta disponible.');
  }

  if (/timeout\s+\d+ms exceeded|processing|procesando archivo|expect\.poll|proceso/i.test(text)) {
    return result('PROCESSING_TIMEOUT', 'PROCESS_TIMEOUT', 'MEDIUM', 'El proceso no alcanzo el estado esperado dentro del tiempo maximo.');
  }

  if (hasExpectedReceivedMismatch(input)) {
    return result('ASSERTION_FAILURE', 'EXPECTED_VALUE_MISMATCH', 'HIGH', 'El valor recibido difiere del valor esperado.');
  }

  if (/forbidden|unauthorized|permission|permiso|403/i.test(text)) {
    return result('PERMISSION_FAILURE', 'PERMISSION_DENIED', 'MEDIUM', 'La accion o vista fue denegada por permisos.');
  }

  if (/validaci[oó]n|regla de negocio|business|hecho|error por reglas/i.test(text)) {
    return result('BUSINESS_RULE_FAILURE', 'BUSINESS_VALIDATION_FAILED', 'MEDIUM', 'La respuesta funcional no coincide con el comportamiento esperado.');
  }

  return result(mapFrameworkClassification(input.frameworkClassification), 'UNKNOWN', 'LOW', 'No hay contexto suficiente para una decision automatica.');
}

function classifyNotFound(text: string, input: IncidentClassificationInput): IncidentClassification {
  const cause = inferNotFoundCause(text);

  if (cause === 'OPTION_NOT_AVAILABLE' || cause === 'ELEMENT_NOT_FOUND') {
    const requiredElement = functionalRequiredElement(input, text);
    const context = correctFunctionalContext(input);
    debugIncident('classifier:classifyNotFound', {
      classifierFile: sourceFile(__filename),
      playwrightFailureType: input.frameworkClassification,
      technicalClassificationBeforePolicy: requiredElement && context.isCorrect ? 'BUSINESS_RULE_FAILURE' : 'AUTOMATION_FAILURE',
      probableCause: cause,
      functionalRequiredElement: Boolean(requiredElement),
      functionalAction: requiredElement ?? 'N/D',
      roleExpected: input.expectedRole,
      roleUsed: input.usedRole,
      roleMatches: !(hasValue(input.expectedRole) && hasValue(input.usedRole) && input.expectedRole !== input.usedRole),
      projectExpected: input.expectedProject,
      projectUsed: input.usedProject,
      projectMatches: !(hasValue(input.expectedProject) && hasValue(input.usedProject) && input.expectedProject !== input.usedProject),
      contextValid: context.isCorrect,
      contextReason: context.reason,
      phase: input.phase,
      message: input.message,
      expected: input.expected,
      observedResult: input.observedResult,
      view: input.view,
    });

    if (requiredElement && context.isCorrect) {
      return result(
        'BUSINESS_RULE_FAILURE',
        cause === 'ELEMENT_NOT_FOUND' ? 'ELEMENT_NOT_FOUND' : 'OPTION_NOT_AVAILABLE',
        'HIGH',
        `El caso requiere funcionalmente ${requiredElement} y la ejecucion alcanzo el contexto esperado.`,
      );
    }

    const evidence = optionEvidence(text);

    if (evidence.controlOpened && evidence.otherOptionsLoaded && evidence.expectedOptionIsFunctional) {
      return result(
        'BUSINESS_RULE_FAILURE',
        cause === 'ELEMENT_NOT_FOUND' ? 'ELEMENT_NOT_FOUND' : 'OPTION_NOT_AVAILABLE',
        'HIGH',
        'El control cargo opciones y la opcion esperada esta definida como resultado funcional esperado.',
      );
    }

    if (evidence.controlOpened && evidence.otherOptionsLoaded) {
      return result(
        'AUTOMATION_FAILURE',
        cause === 'ELEMENT_NOT_FOUND' ? 'ELEMENT_NOT_FOUND' : 'OPTION_NOT_AVAILABLE',
        'MEDIUM',
        'La opcion esperada no fue encontrada, pero no hay evidencia suficiente para afirmar que la aplicacion omitio funcionalmente esa opcion.',
      );
    }

    return result(
      'AUTOMATION_FAILURE',
      cause === 'ELEMENT_NOT_FOUND' ? 'ELEMENT_NOT_FOUND' : 'OPTION_NOT_AVAILABLE',
      'MEDIUM',
      'No existe evidencia suficiente de que el dropdown se abrio correctamente y cargo sus opciones.',
    );
  }

  return result('AUTOMATION_FAILURE', cause, 'MEDIUM', 'El elemento esperado no fue encontrado en la UI.');
}

function inferNotFoundCause(text: string): ProbableCause {
  if (/option|getbyrole\('option'|opcion|accion|menu de acciones|bot[oó]n|button|guardar|confirmar|editar|eliminar|agregar|nuevo|crear|descargar|cargar archivo|procesar/i.test(text)) {
    return 'OPTION_NOT_AVAILABLE';
  }
  if (/modal|dialog/i.test(text)) return 'MODAL_NOT_OPENED';
  if (/navigation|tohaveurl|page not loaded|pagina/i.test(text)) return 'PAGE_NOT_LOADED';
  return 'ELEMENT_NOT_FOUND';
}

function functionalRequiredElement(input: IncidentClassificationInput, text: string): string | undefined {
  const assertionMessage = extractAssertionMessage(input.message) ?? extractAssertionMessage(input.errorText);
  const combined = normalize([assertionMessage, input.message, input.phase, input.caseTitle, input.observedResult, input.expected].join('\n'));

  if (!/(debe existir|debe mostrarse|debe estar visible|debe estar disponible|debe habilitarse|resultado esperado|requiere|validar|accion|opcion|campo obligatorio|pesta[nÃ±]a requerida)/i.test(combined)) {
    return undefined;
  }

  const element =
    extractFunctionalElement(assertionMessage ?? '') ??
    extractFunctionalElement(input.message) ??
    extractFunctionalElement(input.phase) ??
    extractFunctionalElement(input.observedResult) ??
    extractFunctionalElement(text) ??
    extractElementFromCaseIntent(combined);

  if (!element || isTechnicalElement(element)) {
    return undefined;
  }

  return element;
}

function correctFunctionalContext(input: IncidentClassificationInput): { isCorrect: boolean; reason: string } {
  if (hasValue(input.expectedProject) && hasValue(input.usedProject) && input.expectedProject !== input.usedProject) {
    return { isCorrect: false, reason: 'Proyecto incorrecto.' };
  }

  if (hasValue(input.expectedRole) && hasValue(input.usedRole) && input.expectedRole !== input.usedRole) {
    return { isCorrect: false, reason: 'Rol incorrecto.' };
  }

  const text = normalize([input.frameworkClassification, input.errorText, input.contextText, input.stack].join('\n'));
  if (/auth_failure|data_failure|env_failure|config_failure|authentication_failed|missing_test_data|environment_unavailable/i.test(text)) {
    return { isCorrect: false, reason: 'Existe una exclusion previa de autenticacion, datos, ambiente o configuracion.' };
  }

  return { isCorrect: true, reason: 'Rol, proyecto y contexto disponibles son consistentes.' };
}

function extractAssertionMessage(value: string): string | undefined {
  const match = value.match(/(?:Error:\s*)?(Debe\s+(?:existir|mostrarse|estar visible|estar disponible|habilitarse)[^\n.]*\.?)/i);
  return match?.[1]?.trim();
}

function extractFunctionalElement(value: string): string | undefined {
  const patterns = [
    /opcion\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /accion\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /bot[oó]n\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /campo\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /pesta[nñ]a\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) {
      return cleanElementName(match[1]);
    }
  }

  return undefined;
}

function extractElementFromCaseIntent(value: string): string | undefined {
  const actions = ['eliminar', 'editar', 'agregar', 'nuevo', 'crear', 'guardar', 'confirmar', 'descargar', 'cargar archivo', 'procesar'];
  return actions.find((action) => value.includes(action));
}

function isTechnicalElement(value: string): boolean {
  return /container|wrapper|radix|popover interno|locator|dom|selector|spinner|skeleton/i.test(value);
}

function isUnequivocalAutomationError(text: string): boolean {
  return /element is detached|detached from dom|invalid selector|unexpected token.*selector|unknown engine|selector engine|locator resolved to/i.test(text);
}

function cleanElementName(value: string): string {
  return value.replace(/\s+(en|del|de|dentro|visible|disponible).*/i, '').trim();
}

function optionEvidence(text: string): {
  controlOpened: boolean;
  otherOptionsLoaded: boolean;
  expectedOptionIsFunctional: boolean;
} {
  return {
    controlOpened: /listbox|popover|dropdown|combobox|data-radix-popper-content-wrapper/i.test(text),
    otherOptionsLoaded: /option\s+"[^"]+"|role="option"|getbyrole\('option'/i.test(text),
    expectedOptionIsFunctional: /resultado funcional esperado|metadata expected option|expected option functional/i.test(text),
  };
}

function hasExpectedReceivedMismatch(input: IncidentClassificationInput): boolean {
  return hasValue(input.expected) && hasValue(input.received) && input.expected !== input.received;
}

function probablePermissionContext(text: string): boolean {
  return /permiso|permission|forbidden|unauthorized|403|no se le visualiza/i.test(text);
}

function result(
  classification: TechnicalClassification,
  probableCause: ProbableCause,
  confidence: IncidentClassification['confidence'],
  evidence: string,
): IncidentClassification {
  return {
    classification,
    probableCause,
    confidence,
    evidence: [evidence],
  };
}

function mapFrameworkClassification(value: string): TechnicalClassification {
  const valid: TechnicalClassification[] = [
    'ASSERTION_FAILURE',
    'PERMISSION_FAILURE',
    'PROCESSING_TIMEOUT',
    'NAV_FAILURE',
    'DATA_FAILURE',
    'AUTH_FAILURE',
    'ENV_FAILURE',
  ];

  return valid.includes(value as TechnicalClassification) ? (value as TechnicalClassification) : 'UNKNOWN_FAILURE';
}

function hasValue(value: string): boolean {
  return Boolean(value && value !== 'N/D');
}

function normalize(value: string): string {
  return value.toLowerCase();
}
