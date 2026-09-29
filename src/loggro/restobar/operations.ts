import type { AllowedOperation } from '../../http/client.ts';

/**
 * Allowlist de Restobar. Cada entrada debe existir en
 * docs/loggro-api/inventory/restobar.md con clase «lectura» (o «autenticación»
 * para el login); lo verifica tests/contract/restobar-allowlist.test.ts.
 */
export const RESTOBAR_OPERATIONS = {
  login: {
    id: 'restobar.login',
    kind: 'auth',
    method: 'POST',
    path: '/login',
    docSlug: 'iniciarsesion',
  },
  listInvoices: {
    id: 'restobar.listInvoices',
    kind: 'read',
    method: 'GET',
    path: '/invoices',
    docSlug: 'consultarfacturas',
  },
  getInvoice: {
    id: 'restobar.getInvoice',
    kind: 'read',
    method: 'GET',
    path: '/invoices/{id}',
    docSlug: 'obtenerfacturaporid',
  },
  listProducts: {
    id: 'restobar.listProducts',
    kind: 'read',
    method: 'GET',
    path: '/products',
    docSlug: 'consultarproductos',
  },
  listCategories: {
    id: 'restobar.listCategories',
    kind: 'read',
    method: 'GET',
    path: '/categories',
    docSlug: 'consultarcategorias',
  },
  listOrders: {
    id: 'restobar.listOrders',
    kind: 'read',
    method: 'GET',
    path: '/orders',
    docSlug: 'consultarpedidos',
  },
  listClients: {
    id: 'restobar.listClients',
    kind: 'read',
    method: 'GET',
    path: '/clients',
    docSlug: 'consultarclientes',
  },
  listPaymentMethods: {
    id: 'restobar.listPaymentMethods',
    kind: 'read',
    method: 'GET',
    path: '/paymentMethods',
    docSlug: 'consultarmetodospago',
  },
  salesByDay: {
    id: 'restobar.salesByDay',
    kind: 'read',
    method: 'GET',
    path: '/stats/totalInvoicesByDays',
    docSlug: 'gettotalinvoicesbydays',
  },
} as const satisfies Record<string, AllowedOperation>;

export const RESTOBAR_ALLOWLIST: readonly AllowedOperation[] = Object.values(RESTOBAR_OPERATIONS);
