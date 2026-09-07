const publicPassword = ['secret', 'sauce'].join('_');

export const standardUser = Object.freeze({ username: 'standard_user', password: publicPassword });
export const lockedOutUser = Object.freeze({ username: 'locked_out_user', password: publicPassword });
export const selectedProduct = 'Sauce Labs Backpack';

export function checkoutCustomer() {
  const suffix = Date.now().toString(36);
  return { firstName: 'Demo', lastName: `Customer-${suffix}`, postalCode: '10001' };
}
