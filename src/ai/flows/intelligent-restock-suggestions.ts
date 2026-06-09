'use server';
/**
 * @fileOverview Provides AI-driven intelligent suggestions for restocking products based on sales trends and inventory levels.
 *
 * - intelligentRestockSuggestions - A function that provides restock suggestions.
 * - IntelligentRestockSuggestionsInput - The input type for the intelligentRestockSuggestions function.
 * - IntelligentRestockSuggestionsOutput - The return type for the intelligentRestockSuggestions function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const IntelligentRestockSuggestionsInputSchema = z.object({
  products: z.array(
    z.object({
      productId: z.string().describe('Unique identifier for the product.'),
      productName: z.string().describe('Name of the product.'),
      currentStock: z.number().describe('Current quantity of the product in stock.'),
      minStockLevel: z.number().optional().describe('Minimum desired stock level for this product. If not provided, it will be inferred.'),
      maxStockLevel: z.number().optional().describe('Maximum desired stock level for this product. If not provided, it will be inferred.'),
    })
  ).describe('List of all products with their current stock and predefined min/max levels.'),
  salesHistory: z.array(
    z.object({
      productId: z.string().describe('Unique identifier for the product sold.'),
      quantitySold: z.number().describe('Quantity of the product sold.'),
      saleDate: z.string().datetime().describe('Date and time of the sale in ISO 8601 format.'),
    })
  ).describe('List of recent sales records for trend analysis.'),
  timeframeDays: z.number().optional().describe('Number of days to consider for sales trend analysis. Defaults to 30 days if not provided.'),
});
export type IntelligentRestockSuggestionsInput = z.infer<typeof IntelligentRestockSuggestionsInputSchema>;

const IntelligentRestockSuggestionsOutputSchema = z.object({
  suggestions: z.array(
    z.object({
      productId: z.string().describe('The ID of the product to restock or manage.'),
      productName: z.string().describe('The name of the product.'),
      suggestedQuantity: z.number().describe('The recommended quantity to order or reduce from stock. A negative value implies reducing stock.'),
      reasoning: z.string().describe('A detailed explanation for the restock suggestion, considering sales trends and stock levels.'),
    })
  ).describe('A list of intelligent restock suggestions based on the provided data.'),
});
export type IntelligentRestockSuggestionsOutput = z.infer<typeof IntelligentRestockSuggestionsOutputSchema>;

// Helper function to format sales history for the prompt
function formatSalesHistory(salesHistory: IntelligentRestockSuggestionsInput['salesHistory'], timeframeDays: number): string {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - timeframeDays);

  const filteredSales = salesHistory.filter(sale => new Date(sale.saleDate) >= cutoffDate);

  if (filteredSales.length === 0) {
    return 'No sales recorded within the specified timeframe.';
  }

  const salesByProduct: { [productId: string]: { totalSold: number; recentSalesDates: Date[] } } = {};

  for (const sale of filteredSales) {
    if (!salesByProduct[sale.productId]) {
      salesByProduct[sale.productId] = { totalSold: 0, recentSalesDates: [] };
    }
    salesByProduct[sale.productId].totalSold += sale.quantitySold;
    salesByProduct[sale.productId].recentSalesDates.push(new Date(sale.saleDate));
  }

  let formatted = `Recent Sales History (within the last ${timeframeDays} days):\n`;
  for (const productId in salesByProduct) {
    const productSales = salesByProduct[productId];
    const avgDailySales = productSales.totalSold / timeframeDays;
    formatted += `  Product ID: ${productId}, Total Sold: ${productSales.totalSold}, Average Daily Sales: ${avgDailySales.toFixed(2)}\n`;
  }
  return formatted;
}

// Define the input schema for the prompt, which includes pre-processed data
const IntelligentRestockPromptInputSchema = IntelligentRestockSuggestionsInputSchema.extend({
  summarizedSalesHistory: z.string().describe('A summarized and formatted string of recent sales history.'),
  currentDate: z.string().describe('The current date in YYYY-MM-DD format.'),
});
type IntelligentRestockPromptInput = z.infer<typeof IntelligentRestockPromptInputSchema>;


const intelligentRestockSuggestionsPrompt = ai.definePrompt({
  name: 'intelligentRestockSuggestionsPrompt',
  input: {
    schema: IntelligentRestockPromptInputSchema,
  },
  output: { schema: IntelligentRestockSuggestionsOutputSchema },
  prompt: `You are an expert inventory manager for a small business. Your goal is to analyze product stock levels and sales history to provide intelligent restock suggestions on {{currentDate}}.\n\nHere is the current product inventory:\n{{#each products}}\n- Product ID: {{{productId}}}, Name: {{{productName}}}, Current Stock: {{{currentStock}}}, Min Stock Level: {{{minStockLevel depth=1}}}, Max Stock Level: {{{maxStockLevel depth=1}}}\n{{/each}}\n\nHere is the recent sales history summary for the last {{timeframeDays depth=1}} days:\n{{{summarizedSalesHistory}}}\n\nAnalyze the data above and provide specific restock or stock reduction suggestions.\nConsider the following:\n1.  **Low Stock**: If 'currentStock' is below 'minStockLevel', suggest restocking to reach at least 'maxStockLevel' or a calculated optimal level.\n2.  **High Demand**: If recent sales trends show high demand, suggest increasing stock levels proactively, even if current stock is not critically low.\n3.  **Low Demand / Excess Stock**: If 'currentStock' is significantly above 'maxStockLevel' and sales are low, suggest reducing stock or not reordering.\n4.  **No min/max levels**: If min/max stock levels are not provided, infer optimal levels based on sales history and average daily sales.\n5.  **Reasoning**: For each suggestion, provide a clear, concise reasoning based on the data.\n\nProvide your suggestions in a structured JSON array format. Only include products for which an action (restock or reduction) is explicitly suggested.\n\nExample of expected output structure:\n{\n  "suggestions": [\n    {\n      "productId": "PROD001",\n      "productName": "Example Product",\n      "suggestedQuantity": 50,\n      "reasoning": "Current stock (10) is below minimum (20). Sales history indicates an average daily sale of 2 units over the last 30 days. Suggesting to restock to 50 units (25 days supply)."\n    }\n  ]\n}\n`,
});

const intelligentRestockSuggestionsFlow = ai.defineFlow(
  {
    name: 'intelligentRestockSuggestionsFlow',
    inputSchema: IntelligentRestockSuggestionsInputSchema,
    outputSchema: IntelligentRestockSuggestionsOutputSchema,
  },
  async (input) => {
    const defaultTimeframe = input.timeframeDays ?? 30;
    const summarizedSalesHistory = formatSalesHistory(input.salesHistory, defaultTimeframe);
    const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const { output } = await intelligentRestockSuggestionsPrompt({
      ...input,
      summarizedSalesHistory,
      timeframeDays: defaultTimeframe,
      currentDate,
    });
    return output!;
  }
);

export async function intelligentRestockSuggestions(input: IntelligentRestockSuggestionsInput): Promise<IntelligentRestockSuggestionsOutput> {
  return intelligentRestockSuggestionsFlow(input);
}
