import { classifyIncident } from './incident-classifier';
import { debugIncident, sourceFile } from './incident-debug';
import type {
  AzureDevOpsEligibility,
  Confidence,
  IncidentClassificationInput,
  IncidentDecision,
  IncidentDecisionResult,
  ProbableCause,
} from './incident.types';

export function decideIncident(input: IncidentClassificationInput): IncidentDecisionResult {
  const classification = classifyIncident(input);
  const decision = decisionFor(classification, input);
  const reason = reasonFor(classification.probableCause, classification.confidence, classification.classification, input);
  const recommendation = recommendationFor(classification.probableCause, decision, input);
  const azureDevOpsEligibility = eligibilityFor(decision, classification.confidence);
  debugIncident('policy:decideIncident', {
    policyFile: sourceFile(__filename),
    classifierInputFailureType: input.frameworkClassification,
    technicalClassificationBeforePolicy: classification.classification,
    probableCause: classification.probableCause,
    decisionBeforePolicy: 'N/D',
    confidenceBeforePolicy: classification.confidence,
    decisionAfterPolicy: decision,
    confidenceAfterPolicy: classification.confidence,
    reason,
    azureDevOpsEligibility,
  });

  return {
    ...classification,
    decision,
    reason,
    recommendation,
    azureDevOpsEligibility,
  };
}

function decisionFor(
  classification: Pick<IncidentDecisionResult, 'probableCause' | 'confidence' | 'classification'>,
  _input: IncidentClassificationInput,
): IncidentDecision {
  const { probableCause, confidence } = classification;

  if (confidence === 'LOW') {
    return 'BUG_REVIEW';
  }

  switch (probableCause) {
    case 'EXPECTED_VALUE_MISMATCH':
    case 'BUSINESS_VALIDATION_FAILED':
      return 'BUG_AUTO';
    case 'PERMISSION_DENIED':
      return confidence === 'HIGH' ? 'BUG_AUTO' : 'BUG_REVIEW';
    case 'OPTION_NOT_AVAILABLE':
    case 'ELEMENT_NOT_FOUND':
      return classification.classification === 'BUSINESS_RULE_FAILURE' && confidence === 'HIGH'
        ? 'BUG_AUTO'
        : confidence === 'HIGH'
          ? 'BUG_REVIEW'
          : 'AUTOMATION_ISSUE';
    case 'MODAL_NOT_OPENED':
    case 'PAGE_NOT_LOADED':
    case 'ELEMENT_NOT_INTERACTABLE':
      return confidence === 'HIGH' ? 'BUG_REVIEW' : 'AUTOMATION_ISSUE';
    case 'PROCESS_TIMEOUT':
      return 'BUG_REVIEW';
    case 'LOCATOR_AMBIGUOUS':
      return 'AUTOMATION_ISSUE';
    case 'WRONG_PROJECT':
    case 'WRONG_ROLE':
    case 'AUTHENTICATION_FAILED':
    case 'SESSION_EXPIRED':
    case 'MISSING_TEST_DATA':
    case 'ENVIRONMENT_UNAVAILABLE':
    case 'NETWORK_FAILURE':
      return 'IGNORE';
    default:
      return 'BUG_REVIEW';
  }
}

function reasonFor(
  probableCause: ProbableCause,
  confidence: Confidence,
  classification: IncidentDecisionResult['classification'],
  input: IncidentClassificationInput,
): string {
  const element = functionalElementLabel(input);
  const unavailableTerm = element.includes('accion') ? 'dicha accion' : element.includes('opcion') ? 'dicha opcion' : 'dicho elemento';
  const reasons: Record<ProbableCause, string> = {
    EXPECTED_VALUE_MISMATCH: 'El valor recibido difiere del valor esperado.',
    ELEMENT_NOT_FOUND:
      classification === 'BUSINESS_RULE_FAILURE' && confidence === 'HIGH'
        ? `El caso requiere funcionalmente ${element} y la ejecucion se realizo con el rol, proyecto y vista esperados, pero el elemento no se encuentra disponible.`
        : 'El elemento esperado no fue encontrado; requiere revisar selector, datos, navegacion o UI.',
    LOCATOR_AMBIGUOUS: 'El locator resolvio multiples elementos y requiere ajuste de automatizacion.',
    ELEMENT_NOT_INTERACTABLE: 'El elemento existe pero no esta disponible para interaccion.',
    PAGE_NOT_LOADED: 'La pagina o vista esperada no cargo antes de la validacion.',
    MODAL_NOT_OPENED: 'El modal esperado no se abrio antes de la validacion.',
    OPTION_NOT_AVAILABLE:
      classification === 'BUSINESS_RULE_FAILURE' && confidence === 'HIGH'
        ? `El caso requiere funcionalmente ${element} y la ejecucion se realizo con el rol, proyecto y vista esperados, pero ${unavailableTerm} no se encuentra disponible.`
        : 'La opcion esperada no fue encontrada, pero no existe evidencia suficiente para determinar que la aplicacion omitio funcionalmente dicha opcion.',
    AUTHENTICATION_FAILED: 'El fallo corresponde a autenticacion y no debe crear Bug funcional automaticamente.',
    SESSION_EXPIRED: 'La sesion expiro o el estado base no esta disponible.',
    WRONG_ROLE: 'El rol usado no coincide con el rol esperado.',
    WRONG_PROJECT: 'El proyecto Playwright usado no coincide con el esperado.',
    MISSING_TEST_DATA: 'Faltan datos, archivos o prerequisitos del caso.',
    ENVIRONMENT_UNAVAILABLE: 'El ambiente o servicio no esta disponible.',
    NETWORK_FAILURE: 'El fallo corresponde a conectividad o red.',
    BUSINESS_VALIDATION_FAILED: 'La aplicacion respondio funcionalmente pero incumplio el comportamiento esperado.',
    PERMISSION_DENIED: 'La accion o vista fue denegada por permisos.',
    PROCESS_TIMEOUT: 'El proceso no alcanzo el estado esperado dentro del tiempo maximo.',
    UNKNOWN: 'No hay contexto suficiente para una decision automatica.',
  };

  return reasons[probableCause];
}

function recommendationFor(probableCause: ProbableCause, decision: IncidentDecision, input: IncidentClassificationInput): string {
  if (decision === 'BUG_AUTO') {
    if (probableCause !== 'OPTION_NOT_AVAILABLE' && probableCause !== 'ELEMENT_NOT_FOUND') {
      return 'Registrar la incidencia funcional utilizando las evidencias capturadas.';
    }

    const element = functionalElementLabel(input);
    const view = input.view !== 'N/D' ? ` en la vista ${input.view}` : '';
    const role = input.usedRole !== 'N/D' ? ` para el rol ${input.usedRole}` : '';
    return `Registrar incidencia funcional por ausencia de ${element}${view}${role}.`;
  }

  switch (probableCause) {
    case 'OPTION_NOT_AVAILABLE':
      return decision === 'BUG_REVIEW'
        ? 'Validar manualmente en la aplicacion si la opcion esperada deberia mostrarse para el rol y datos utilizados.'
        : 'Revisar el Trace y confirmar que el dropdown se abrio correctamente, que cargo sus opciones y que el locator corresponde al componente visible.';
    case 'LOCATOR_AMBIGUOUS':
    case 'ELEMENT_NOT_FOUND':
    case 'ELEMENT_NOT_INTERACTABLE':
    case 'MODAL_NOT_OPENED':
    case 'PAGE_NOT_LOADED':
      return 'Revisar selectores, trace y estado previo de la UI antes de levantar una incidencia funcional.';
    case 'WRONG_PROJECT':
    case 'WRONG_ROLE':
      return 'Corregir la configuracion del proyecto o rol antes de repetir la ejecucion.';
    case 'MISSING_TEST_DATA':
      return 'Preparar o corregir los datos requeridos por el caso antes de volver a ejecutar.';
    case 'ENVIRONMENT_UNAVAILABLE':
    case 'NETWORK_FAILURE':
      return 'Validar disponibilidad del ambiente o servicios dependientes antes de repetir la prueba.';
    case 'AUTHENTICATION_FAILED':
    case 'SESSION_EXPIRED':
      return 'Regenerar o validar la sesion y credenciales antes de repetir la prueba.';
    case 'PROCESS_TIMEOUT':
      return 'Revisar trace, tiempos de backend y estado del proceso antes de decidir si corresponde Bug funcional.';
    default:
      return 'Revisar manualmente el diagnostico y las evidencias antes de crear una incidencia.';
  }
}

function functionalElementLabel(input: IncidentClassificationInput): string {
  const source = [input.message, input.errorText, input.phase, input.caseTitle].join('\n');
  const action = extractActionIntent(source);
  if (action) {
    return `la accion ${action}`;
  }

  const patterns = [
    /opcion\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /accion\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /bot[oó]n\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /campo\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
    /pesta[nñ]a\s+([A-ZÁÉÍÓÚÑ0-9 _-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      const value = match[1].replace(/\s+(en|del|de|dentro|visible|disponible).*/i, '').trim();
      return /^(si|no)$/i.test(value) ? `la opcion ${value}` : `la accion ${value}`;
    }
  }

  return 'un elemento requerido por el caso';
}

function extractActionIntent(source: string): string | undefined {
  const match = source.match(/\b(eliminar|editar|agregar|nuevo|crear|guardar|confirmar|descargar|cargar archivo|procesar)\b/i);
  if (!match?.[1]) {
    return undefined;
  }

  return match[1].charAt(0).toUpperCase() + match[1].slice(1);
}

function eligibilityFor(decision: IncidentDecision, confidence: Confidence): AzureDevOpsEligibility {
  if (decision === 'BUG_AUTO' && confidence === 'HIGH') {
    return 'ELEGIBLE PARA CREACION AUTOMATICA';
  }

  if (decision === 'BUG_AUTO' || decision === 'BUG_REVIEW') {
    return 'REQUIERE REVISION';
  }

  return 'NO ELEGIBLE';
}
