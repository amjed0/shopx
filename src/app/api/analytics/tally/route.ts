import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../../lib/auth';
import Sale from '../../../../../models/Sale';
import Expense from '../../../../../models/Expense';
import Income from '../../../../../models/Income';
import Customer from '../../../../../models/Customer';
import { requirePermission } from '../../../../../lib/rbac';

export async function GET(request: NextRequest) {
  try {
    const authErr = await requirePermission(request, 'dashboard');
    if (authErr) return authErr;

    await dbConnect();

    const session = await getServerSession(authOptions);
    const headerUserId = request.headers.get('x-user-id');
    const userId = session?.user?.id || headerUserId;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Fetch all records for user in parallel
    const [sales, expenses, incomes, customers] = await Promise.all([
      Sale.find({ userId }).lean(),
      Expense.find({ userId }).lean(),
      Income.find({ userId }).lean(),
      Customer.find({ userId }).lean(),
    ]);

    const isTargetDate = (dateVal?: string | Date) => {
      if (!dateVal) return false;
      const str = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
      return str.split('T')[0] === dateParam;
    };

    const isBeforeTargetDate = (dateVal?: string | Date) => {
      if (!dateVal) return false;
      const str = typeof dateVal === 'string' ? dateVal : dateVal.toISOString();
      return str.split('T')[0] < dateParam;
    };

    // ── 1. AUTOMATIC OPENING BALANCE CALCULATION FROM PAST HISTORY ──
    // Prior to dateParam:
    // Past Cash Inflows: Cash Sales + Other Cash Income
    // Past Cash Outflows: Cash Expenses (including any past Cash deposited to Bank)
    let pastCashSales = 0;
    let pastDigitalSales = 0;

    sales.forEach((s: any) => {
      if (s.status === 'returned' || !isBeforeTargetDate(s.date || s.createdAt)) return;
      const amount = Number(s.total) || 0;
      const method = (s.paymentMethod || '').toLowerCase();
      if (method === 'cash') {
        pastCashSales += amount;
      } else if (method === 'upi' || method === 'card') {
        pastDigitalSales += amount;
      }
    });

    let pastCashIncomes = 0;
    let pastDigitalIncomes = 0;
    incomes.forEach((i: any) => {
      if (!isBeforeTargetDate(i.createdAt || i.date)) return;
      const cat = (i.category || '').toLowerCase();
      const note = (i.note || '').toLowerCase();
      if (cat === 'sales revenue' || note.startsWith('bill #')) return;

      const amount = Number(i.amount) || 0;
      const mode = (i.paymentMode || '').toLowerCase();
      if (mode === 'cash') {
        pastCashIncomes += amount;
      } else {
        pastDigitalIncomes += amount;
      }
    });

    let pastCashExpenses = 0;
    let pastDigitalExpenses = 0;
    expenses.forEach((e: any) => {
      if (!isBeforeTargetDate(e.createdAt || e.date)) return;
      const amount = Number(e.amount) || 0;
      const mode = (e.paymentMode || '').toLowerCase();
      if (mode === 'cash') {
        pastCashExpenses += amount;
      } else {
        pastDigitalExpenses += amount;
      }
    });

    const autoOpeningCash = Math.max(0, pastCashSales + pastCashIncomes - pastCashExpenses);
    const autoOpeningUpi = Math.max(0, pastDigitalSales + pastDigitalIncomes - pastDigitalExpenses);

    // ── 2. TODAY'S SALES BREAKDOWN ──
    const todaySales = sales.filter((s: any) => s.status !== 'returned' && isTargetDate(s.date || s.createdAt));
    
    let todayCashSales = 0;
    let todayUpiSales = 0;
    let todayCardSales = 0;
    let todayCreditSales = 0;

    todaySales.forEach((s: any) => {
      const amount = Number(s.total) || 0;
      const method = (s.paymentMethod || '').toLowerCase();
      if (method === 'cash') {
        todayCashSales += amount;
      } else if (method === 'upi') {
        todayUpiSales += amount;
      } else if (method === 'card') {
        todayCardSales += amount;
      } else if (method === 'credit') {
        todayCreditSales += amount;
      } else {
        todayCashSales += amount;
      }
    });

    const todayDigitalSales = todayUpiSales + todayCardSales;
    const todayTotalSales = todayCashSales + todayDigitalSales + todayCreditSales;

    // ── 3. TODAY'S CASH TO BANK DEPOSITS (TRANSFERS) ──
    const isDepositOutflow = (e: any) => {
      const cat = (e.category || '').toLowerCase();
      const desc = (e.description || '').toLowerCase();
      return cat === 'deposit to bank' || desc.includes('cash deposited');
    };

    const isDepositInflow = (i: any) => {
      const cat = (i.category || '').toLowerCase();
      const desc = (i.description || '').toLowerCase();
      return cat === 'deposit from cash' || desc.includes('cash deposit received');
    };

    const todayBankDepositsList = expenses.filter(
      (e: any) => isTargetDate(e.createdAt || e.date) && isDepositOutflow(e)
    );

    const todayBankDepositedAmount = todayBankDepositsList.reduce(
      (sum: number, e: any) => sum + (Number(e.amount) || 0),
      0
    );

    // ── 4. TODAY'S OTHER INCOMES (EXCLUDES SALES AND BANK DEPOSIT INFLOWS) ──
    const todayOtherIncomesList = incomes.filter((i: any) => {
      if (!isTargetDate(i.createdAt || i.date)) return false;
      const cat = (i.category || '').toLowerCase();
      const note = (i.note || '').toLowerCase();
      if (cat === 'sales revenue' || note.startsWith('bill #')) return false;
      if (isDepositInflow(i)) return false;
      return true;
    });

    let todayOtherIncomeCash = 0;
    let todayOtherIncomeDigital = 0;

    todayOtherIncomesList.forEach((i: any) => {
      const amount = Number(i.amount) || 0;
      const mode = (i.paymentMode || '').toLowerCase();
      if (mode === 'cash') {
        todayOtherIncomeCash += amount;
      } else {
        todayOtherIncomeDigital += amount;
      }
    });

    const todayTotalOtherIncome = todayOtherIncomeCash + todayOtherIncomeDigital;

    // ── 5. TODAY'S DIRECT SHOP EXPENSES (EXCLUDES PURCHASES AND BANK DEPOSITS) ──
    const todayShopExpensesList = expenses.filter(
      (e: any) => isTargetDate(e.createdAt || e.date) && !isDepositOutflow(e)
    );

    let todayCashExpenses = 0;
    let todayDigitalExpenses = 0;

    todayShopExpensesList.forEach((e: any) => {
      const amount = Number(e.amount) || 0;
      const mode = (e.paymentMode || '').toLowerCase();
      if (mode === 'cash') {
        todayCashExpenses += amount;
      } else {
        todayDigitalExpenses += amount;
      }
    });

    const todayTotalExpenses = todayCashExpenses + todayDigitalExpenses;

    // ── 6. ALL-TIME (ALL ACCOUNTS) TALLY STATS ──
    const validAllSales = sales.filter((s: any) => s.status !== 'returned');
    let allCashSales = 0;
    let allUpiSales = 0;
    let allCardSales = 0;
    let allCreditSales = 0;

    validAllSales.forEach((s: any) => {
      const amount = Number(s.total) || 0;
      const method = (s.paymentMethod || '').toLowerCase();
      if (method === 'cash') allCashSales += amount;
      else if (method === 'upi') allUpiSales += amount;
      else if (method === 'card') allCardSales += amount;
      else if (method === 'credit') allCreditSales += amount;
      else allCashSales += amount;
    });

    const allDigitalSales = allUpiSales + allCardSales;
    const allTotalSales = allCashSales + allDigitalSales + allCreditSales;

    // All-time other incomes (excluding sales duplicates and internal transfers)
    const allOtherIncomesList = incomes.filter((i: any) => {
      const cat = (i.category || '').toLowerCase();
      const note = (i.note || '').toLowerCase();
      if (cat === 'sales revenue' || note.startsWith('bill #')) return false;
      if (isDepositInflow(i)) return false;
      return true;
    });

    let allOtherIncomeCash = 0;
    let allOtherIncomeDigital = 0;
    allOtherIncomesList.forEach((i: any) => {
      const amount = Number(i.amount) || 0;
      const mode = (i.paymentMode || '').toLowerCase();
      if (mode === 'cash') allOtherIncomeCash += amount;
      else allOtherIncomeDigital += amount;
    });

    // All-time direct expenses (excluding internal bank transfers)
    const allShopExpensesList = expenses.filter((e: any) => !isDepositOutflow(e));
    let allCashExpenses = 0;
    let allDigitalExpenses = 0;
    allShopExpensesList.forEach((e: any) => {
      const amount = Number(e.amount) || 0;
      const mode = (e.paymentMode || '').toLowerCase();
      if (mode === 'cash') allCashExpenses += amount;
      else allDigitalExpenses += amount;
    });

    // All-time total bank deposits
    const allBankDepositsTotal = expenses
      .filter((e: any) => isDepositOutflow(e))
      .reduce((sum: number, e: any) => sum + (Number(e.amount) || 0), 0);

    const totalCustomerOutstanding = customers.reduce(
      (sum: number, c: any) => sum + (Number(c.outstandingBalance) || 0),
      0
    );

    return NextResponse.json({
      date: dateParam,
      openingBalance: {
        autoCash: autoOpeningCash,
        autoUpi: autoOpeningUpi,
      },
      today: {
        sales: {
          total: todayTotalSales,
          cash: todayCashSales,
          upi: todayUpiSales,
          card: todayCardSales,
          digital: todayDigitalSales,
          credit: todayCreditSales,
          count: todaySales.length,
        },
        otherIncome: {
          total: todayTotalOtherIncome,
          cash: todayOtherIncomeCash,
          digital: todayOtherIncomeDigital,
          items: todayOtherIncomesList.map((i: any) => ({
            id: i._id?.toString(),
            category: i.category,
            description: i.description,
            amount: Number(i.amount) || 0,
            paymentMode: i.paymentMode || 'Cash',
          })),
        },
        expenses: {
          total: todayTotalExpenses,
          cash: todayCashExpenses,
          digital: todayDigitalExpenses,
          items: todayShopExpensesList.map((e: any) => ({
            id: e._id?.toString(),
            category: e.category,
            description: e.description,
            amount: Number(e.amount) || 0,
            paymentMode: e.paymentMode || 'Cash',
          })),
        },
        bankDeposits: {
          total: todayBankDepositedAmount,
          items: todayBankDepositsList.map((e: any) => ({
            id: e._id?.toString(),
            description: e.description,
            amount: Number(e.amount) || 0,
            note: e.note || '',
          })),
        },
      },
      allTime: {
        sales: {
          total: allTotalSales,
          cash: allCashSales,
          upi: allUpiSales,
          card: allCardSales,
          digital: allDigitalSales,
          credit: allCreditSales,
          count: validAllSales.length,
        },
        otherIncome: {
          total: allOtherIncomeCash + allOtherIncomeDigital,
          cash: allOtherIncomeCash,
          digital: allOtherIncomeDigital,
        },
        expenses: {
          total: allCashExpenses + allDigitalExpenses,
          cash: allCashExpenses,
          digital: allDigitalExpenses,
        },
        bankDepositsTotal: allBankDepositsTotal,
        customerOutstanding: totalCustomerOutstanding,
        netCashInflow: allCashSales + allOtherIncomeCash - allCashExpenses - allBankDepositsTotal,
        netDigitalInflow: allDigitalSales + allOtherIncomeDigital + allBankDepositsTotal - allDigitalExpenses,
      },
    });
  } catch (error: any) {
    console.error('[Analytics Tally Error]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
