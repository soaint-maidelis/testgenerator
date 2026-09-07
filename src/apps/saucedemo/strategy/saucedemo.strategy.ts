import type { TestStrategy } from '../../../core/strategy/test-strategy.types';

export const sauceDemoStrategy: TestStrategy = Object.freeze({
  applicationId: 'saucedemo',
  suites: ['smoke', 'regression', 'critical'],
  features: ['authentication', 'inventory', 'cart', 'checkout'],
  cases: {
    'SD-AUTH-001': { feature: 'authentication', suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' },
    'SD-AUTH-002': { feature: 'authentication', suites: ['regression'], risk: 'high', role: 'locked_out_user' },
    'SD-CART-001': { feature: 'cart', suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' },
    'SD-CHECKOUT-001': { feature: 'checkout', suites: ['smoke', 'regression', 'critical'], risk: 'high', role: 'standard_user' },
    'SD-INCIDENT-001': { feature: 'cart', suites: ['regression'], risk: 'controlled', role: 'standard_user' },
    'XL-SD-AUTH-001': { feature: 'authentication', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'XL-SD-CART-001': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'XL-SD-CHECKOUT-001': { feature: 'checkout', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'XL-SD-INCIDENT-001': { feature: 'cart', suites: ["regression"], risk: 'controlled', role: 'standard_user' },
    'US-SD-CART-001-AC-1': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'US-SD-CART-001-AC-2': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'US-SD-CART-001-AC-3': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'US-SD-CART-REMOVE-001-AC-1': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'US-SD-CART-REMOVE-001-AC-2': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
    'US-SD-CART-REMOVE-001-AC-3': { feature: 'cart', suites: ["smoke","regression","critical"], risk: 'high', role: 'standard_user' },
  },
});
