export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchasePrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  expiryDate?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  outstandingBalance: number;
}

export interface Sale {
  id: string;
  date: string;
  customerId: string;
  total: number;
  status: 'paid' | 'pending' | 'returned';
  paymentMethod: 'cash' | 'upi' | 'card' | 'credit';
}

export const mockProducts: Product[] = [
  { id: '1', name: 'Ultra HD Monitor 27"', sku: 'MON-001', category: 'Electronics', purchasePrice: 15000, sellingPrice: 22000, stock: 12, minStock: 5 },
  { id: '2', name: 'Wireless Mechanical Keyboard', sku: 'KB-882', category: 'Electronics', purchasePrice: 2500, sellingPrice: 4500, stock: 45, minStock: 10 },
  { id: '3', name: 'Ergonomic Desk Chair', sku: 'CH-X12', category: 'Furniture', purchasePrice: 8000, sellingPrice: 13500, stock: 3, minStock: 5 },
  { id: '4', name: 'LED Desk Lamp', sku: 'LMP-04', category: 'Accessories', purchasePrice: 600, sellingPrice: 1200, stock: 80, minStock: 15 },
  { id: '5', name: 'Thunderbolt 4 Dock', sku: 'DK-T4', category: 'Electronics', purchasePrice: 12000, sellingPrice: 18000, stock: 1, minStock: 3 },
];

export const mockCustomers: Customer[] = [
  { id: 'c1', name: 'John Doe', phone: '9876543210', email: 'john@example.com', outstandingBalance: 4500 },
  { id: 'c2', name: 'Jane Smith', phone: '9988776655', email: 'jane@example.com', outstandingBalance: 0 },
  { id: 'c3', name: 'Arjun Kumar', phone: '9001122334', email: 'arjun@example.com', outstandingBalance: 12000 },
];

export const mockSales: Sale[] = [
  { id: 'S1001', date: '2023-11-20T10:30:00Z', customerId: 'c1', total: 22000, status: 'paid', paymentMethod: 'upi' },
  { id: 'S1002', date: '2023-11-20T14:15:00Z', customerId: 'c3', total: 8500, status: 'pending', paymentMethod: 'credit' },
  { id: 'S1003', date: '2023-11-21T09:45:00Z', customerId: 'c2', total: 1200, status: 'paid', paymentMethod: 'cash' },
];