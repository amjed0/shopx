'use server';
/**
 * @fileOverview A Genkit flow for generating a daily executive summary of a shop's performance.
 *
 * - dailyBusinessSummaryAI - A function that handles the generation of the daily business summary.
 * - DailyBusinessSummaryInput - The input type for the dailyBusinessSummaryAI function.
 * - DailyBusinessSummaryOutput - The return type for the dailyBusinessSummaryAI function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DailyBusinessSummaryInputSchema = z.object({
  todaySales: z.number().describe("Today's total sales amount."),
  monthlySales: z.number().describe("This month's total sales amount."),
  totalProfit: z.number().describe('Overall total profit earned.'),
  stockValue: z.number().describe('The total current value of all inventory in stock.'),
  pendingPayments: z.number().describe('The total amount of payments due from customers.'),
  topSellingProducts: z.array(z.string()).describe('A list of top selling product names for the day/week.'),
  lowStockAlerts: z.array(z.string()).describe('A list of product names that are currently low in stock.'),
  expiredProducts: z.array(z.string()).describe('A list of product names that have expired or are nearing expiry.'),
  customerCreditOutstanding: z.number().describe('The total outstanding credit owed by customers.'),
  supplierPaymentsDue: z.number().describe('The total amount of payments due to suppliers.'),
});
export type DailyBusinessSummaryInput = z.infer<typeof DailyBusinessSummaryInputSchema>;

const DailyBusinessSummaryOutputSchema = z.object({
  summary: z.string().describe('An executive summary of the shop performance, highlighting sales, profit, and inventory.'),
});
export type DailyBusinessSummaryOutput = z.infer<typeof DailyBusinessSummaryOutputSchema>;

export async function dailyBusinessSummaryAI(input: DailyBusinessSummaryInput): Promise<DailyBusinessSummaryOutput> {
  return dailyBusinessSummaryFlow(input);
}

const dailySummaryPrompt = ai.definePrompt({
  name: 'dailyBusinessSummaryPrompt',
  input: { schema: DailyBusinessSummaryInputSchema },
  output: { schema: DailyBusinessSummaryOutputSchema },
  prompt: `You are a highly skilled business analyst specializing in retail and shop management. Your task is to provide a concise executive summary of the shop's daily performance, highlighting key metrics, potential issues, and areas requiring immediate attention.

Here is the latest business data:

Daily Sales: {{{todaySales}}}
Monthly Sales: {{{monthlySales}}}
Total Profit: {{{totalProfit}}}
Stock Value: {{{stockValue}}}
Pending Customer Payments: {{{pendingPayments}}}
Customer Credit Outstanding: {{{customerCreditOutstanding}}}
Supplier Payments Due: {{{supplierPaymentsDue}}}

{{#if topSellingProducts}}
Top Selling Products:
{{#each topSellingProducts}}- {{{this}}}
{{/each}}{{else}}No specific top selling products identified today.
{{/if}}

{{#if lowStockAlerts}}
Low Stock Alerts:
{{#each lowStockAlerts}}- {{{this}}}
{{/each}}{{else}}No low stock alerts today.
{{/if}}

{{#if expiredProducts}}
Expired or Nearing Expiry Products:
{{#each expiredProducts}}- {{{this}}}
{{/each}}{{else}}No expired products to report.
{{/if}}

Based on this information, generate an executive summary focusing on:
- Overall financial health (sales, profit trends).
- Inventory status (low stock, expired items, stock value).
- Cash flow concerns (pending payments, outstanding credit, supplier dues).
- Any critical areas that require the shop owner's immediate attention.

The summary should be professional, clear, and actionable. Keep it to a maximum of 250 words.`,
});

const dailyBusinessSummaryFlow = ai.defineFlow(
  {
    name: 'dailyBusinessSummaryFlow',
    inputSchema: DailyBusinessSummaryInputSchema,
    outputSchema: DailyBusinessSummaryOutputSchema,
  },
  async (input) => {
    const { output } = await dailySummaryPrompt(input);
    return output!;
  }
);
