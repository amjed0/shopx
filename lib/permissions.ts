export type PermissionKey =
  | 'billing'
  | 'salesEntry'
  | 'purchaseEntry'
  | 'productView'
  | 'inventoryManagement'
  | 'dashboard'
  | 'balanceSheet'
  | 'accounting'
  | 'management';

export type EmployeePermissions = Record<PermissionKey, boolean>;

export const DEFAULT_EMPLOYEE_PERMISSIONS: EmployeePermissions = {
  billing: true,
  salesEntry: true,
  purchaseEntry: true,
  productView: true,
  inventoryManagement: false,
  dashboard: false,
  balanceSheet: false,
  accounting: false,
  management: false,
};

export const OWNER_PERMISSIONS: EmployeePermissions = {
  billing: true,
  salesEntry: true,
  purchaseEntry: true,
  productView: true,
  inventoryManagement: true,
  dashboard: true,
  balanceSheet: true,
  accounting: true,
  management: true,
};

export interface PermissionMeta {
  key: PermissionKey;
  label: string;
  shortLabel: string;
  description: string;
  tier: 'basic' | 'advanced';
}

export const PERMISSION_META: PermissionMeta[] = [
  {
    key: 'billing',
    label: 'Billing / POS',
    shortLabel: 'Billing',
    description: 'Create new bills and checkout orders',
    tier: 'basic',
  },
  {
    key: 'salesEntry',
    label: 'Sales Entries & Returns',
    shortLabel: 'Sales',
    description: 'View sales history and process returns',
    tier: 'basic',
  },
  {
    key: 'purchaseEntry',
    label: 'Purchase Entries',
    shortLabel: 'Purchases',
    description: 'Record new purchases and view purchase history',
    tier: 'basic',
  },
  {
    key: 'productView',
    label: 'Product Views',
    shortLabel: 'Products',
    description: 'View product catalog and current stock levels',
    tier: 'basic',
  },
  {
    key: 'inventoryManagement',
    label: 'Inventory & Stock Alerts',
    shortLabel: 'Inventory',
    description: 'Stock alerts, stock history, and inventory badges',
    tier: 'advanced',
  },
  {
    key: 'dashboard',
    label: 'Dashboard & Analytics',
    shortLabel: 'Dashboard',
    description: 'Main dashboard overview, daily tally, and analytics',
    tier: 'advanced',
  },
  {
    key: 'balanceSheet',
    label: 'Balance Sheet',
    shortLabel: 'Balance Sheet',
    description: 'View consolidated balance sheet reports',
    tier: 'advanced',
  },
  {
    key: 'accounting',
    label: 'Accounting (Cash Book, P&L, GST)',
    shortLabel: 'Accounting',
    description: 'Cash Book, Capital Account, P&L Statement, and GST reports',
    tier: 'advanced',
  },
  {
    key: 'management',
    label: 'Shop Management',
    shortLabel: 'Management',
    description: 'Customers, Credit Tracking, and Suppliers',
    tier: 'advanced',
  },
];

export function normalizePermissions(raw?: Partial<Record<string, unknown>> | null): EmployeePermissions {
  const result: EmployeePermissions = { ...DEFAULT_EMPLOYEE_PERMISSIONS };
  if (!raw || typeof raw !== 'object') return result;
  (Object.keys(DEFAULT_EMPLOYEE_PERMISSIONS) as PermissionKey[]).forEach((key) => {
    if (typeof raw[key] === 'boolean') {
      result[key] = raw[key] as boolean;
    }
  });
  return result;
}

/** Check if a given frontend pathname is allowed for the role + permissions */
export function canAccessPath(
  role: 'OWNER' | 'EMPLOYEE' | null,
  permissions: EmployeePermissions | null | undefined,
  pathname: string
): boolean {
  if (!role) return false;
  if (role === 'OWNER') return true;

  const perms = normalizePermissions(permissions);

  // Employee management & shop settings are strictly Owner-only
  if (pathname === '/managment/employees' || pathname.startsWith('/managment/employees/')) {
    return false;
  }
  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return false;
  }

  // Always allow profile & utility routes
  if (
    pathname === '/profile' ||
    pathname === '/shop-login' ||
    pathname === '/unauthorized'
  ) {
    return true;
  }

  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/analytics' || pathname.startsWith('/analytics/')) {
    return perms.dashboard;
  }

  if (pathname === '/accounting/balance-sheet' || pathname.startsWith('/accounting/balance-sheet/')) {
    return perms.balanceSheet;
  }

  if (pathname === '/accounting' || pathname.startsWith('/accounting/')) {
    return perms.accounting;
  }

  if (pathname === '/managment' || pathname.startsWith('/managment/') || pathname === '/customers' || pathname.startsWith('/customers/')) {
    return perms.management;
  }

  if (pathname === '/purchases/suppliers' || pathname.startsWith('/purchases/suppliers/')) {
    return perms.management;
  }

  if (pathname === '/purchases' || pathname.startsWith('/purchases/')) {
    return perms.purchaseEntry;
  }

  if (pathname === '/sales/new' || pathname.startsWith('/sales/new/')) {
    return perms.billing;
  }

  if (pathname === '/sales' || pathname.startsWith('/sales/')) {
    return perms.salesEntry;
  }

  if (pathname === '/inventory/stock-alert' || pathname.startsWith('/inventory/stock-alert/') || pathname === '/inventory/stock-history' || pathname.startsWith('/inventory/stock-history/')) {
    return perms.inventoryManagement;
  }

  if (pathname === '/inventory' || pathname.startsWith('/inventory/')) {
    return perms.productView || perms.inventoryManagement;
  }

  if (pathname === '/reports' || pathname.startsWith('/reports/')) {
    return perms.accounting || perms.dashboard;
  }

  return true;
}

/** Determine the required permission for a protected API route (returns null if open to any role) */
export function requiredPermissionForApi(
  pathname: string,
  method: string
): PermissionKey | 'OWNER_ONLY' | null {
  if (pathname.startsWith('/api/employees')) return 'OWNER_ONLY';
  if (pathname.startsWith('/api/shop_profiles') && method !== 'GET') return 'OWNER_ONLY';
  if (pathname.startsWith('/api/balance-sheet')) return 'balanceSheet';
  if (pathname.startsWith('/api/analytics')) return 'dashboard';
  if (
    pathname.startsWith('/api/pl-statement') ||
    pathname.startsWith('/api/capital') ||
    pathname.startsWith('/api/cashbook') ||
    pathname.startsWith('/api/expenses')
  ) {
    return 'accounting';
  }
  if (pathname.startsWith('/api/supplier-payments')) return 'management';
  return null;
}

/** First allowed landing page for an employee after Stage-2 login */
export function getDefaultEmployeeRoute(permissions?: EmployeePermissions | null): string {
  const perms = normalizePermissions(permissions);
  if (perms.billing) return '/sales/new';
  if (perms.salesEntry) return '/sales/sales-history';
  if (perms.purchaseEntry) return '/purchases/purchase-entry';
  if (perms.productView || perms.inventoryManagement) return '/inventory';
  if (perms.dashboard) return '/dashboard';
  if (perms.balanceSheet) return '/accounting/balance-sheet';
  if (perms.accounting) return '/accounting/cashbook';
  if (perms.management) return '/managment/customers';
  return '/profile';
}
