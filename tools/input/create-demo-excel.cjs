const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const output = path.resolve('inputs/excel/saucedemo-cases.xlsx');
const headers = ['Scenario', 'Case ID', 'Title', 'Description', 'Preconditions', 'InputData', 'Steps', 'Expected Results', 'Priority', 'Type', 'Tags', 'Automation Status'];
const rows = [
  [
    'Authentication',
    'XL-SD-AUTH-001',
    'Valid standard user login',
    'A valid standard user signs in and reaches the inventory page.',
    'SauceDemo is available',
    '{"user":"standard_user"}',
    '[{"order":1,"action":"Submit standard user credentials","expectedResult":"Inventory is displayed"}]',
    'Authentication succeeds;Inventory page is visible',
    'critical',
    'functional',
    'smoke;auth;excel',
    'candidate',
  ],
  [
    'Shopping cart',
    'XL-SD-CART-001',
    'Add product to cart',
    'A selected SauceDemo product updates badge and cart content.',
    'The standard user is authenticated',
    '{"product":"Sauce Labs Backpack"}',
    '[{"order":1,"action":"Add Sauce Labs Backpack and open cart","expectedResult":"Badge and cart show the selected product"}]',
    'Cart badge is updated;Selected product is visible in cart',
    'high',
    'functional',
    'cart;excel',
    'candidate',
  ],
  [
    'Checkout',
    'XL-SD-CHECKOUT-001',
    'Complete checkout',
    'A standard user completes a purchase for one product.',
    'The standard user is authenticated;One product is in the cart',
    '{"product":"Sauce Labs Backpack","firstName":"Demo","lastName":"QA","postalCode":"15001"}',
    '[{"order":1,"action":"Open checkout and enter customer data","expectedResult":"Checkout overview is displayed"},{"order":2,"action":"Finish the order","expectedResult":"Order confirmation is displayed"}]',
    'Checkout completes successfully;Order confirmation is displayed',
    'high',
    'functional',
    'checkout;excel',
    'candidate',
  ],
  [
    'Controlled incident',
    'XL-SD-INCIDENT-001',
    'Controlled missing button failure',
    'A simulated cart condition validates incident evidence when an expected control is absent.',
    'The standard user is authenticated with an empty cart',
    '{"failure":"Expected remove button is intentionally absent"}',
    '[{"order":1,"action":"Evaluate the artificial cart condition","expectedResult":"Preview evidence is generated"}]',
    'SIMULATED_DEMO_FAILURE is recorded locally;Incident evidence is available',
    'high',
    'synthetic-failure',
    'incident;simulated;excel',
    'candidate',
  ],
];
const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
sheet['!cols'] = headers.map((header) => ({ wch: Math.min(42, Math.max(14, header.length + 4)) }));
sheet['!autofilter'] = { ref: `A1:L${rows.length + 1}` };
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, sheet, 'Test Cases');
fs.mkdirSync(path.dirname(output), { recursive: true });
XLSX.writeFile(workbook, output);
console.log(`Created ${path.relative(process.cwd(), output)}`);
