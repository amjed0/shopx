'use server';
/**
 * @fileOverview A Genkit flow for generating product descriptions and suggesting categories using AI.
 *
 * - productDescriptionAndCategoryAI - A function that handles the AI generation of product description and category.
 * - ProductDescriptionAndCategoryInput - The input type for the productDescriptionAndCategoryAI function.
 * - ProductDescriptionAndCategoryOutput - The return type for the productDescriptionAndCategoryAI function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProductDescriptionAndCategoryInputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  attributes: z
    .string()
    .describe(
      'Key attributes of the product, e.g., "color: red, size: M, material: cotton".'
    ),
});
export type ProductDescriptionAndCategoryInput = z.infer<
  typeof ProductDescriptionAndCategoryInputSchema
>;

const ProductDescriptionAndCategoryOutputSchema = z.object({
  suggestedCategory: z
    .string()
    .describe(
      'A concise and appropriate category for the product, e.g., "Electronics", "Apparel", "Home Goods".'
    ),
  productDescription: z
    .string()
    .describe('A concise and appealing marketing description for the product.'),
});
export type ProductDescriptionAndCategoryOutput = z.infer<
  typeof ProductDescriptionAndCategoryOutputSchema
>;

export async function productDescriptionAndCategoryAI(
  input: ProductDescriptionAndCategoryInput
): Promise<ProductDescriptionAndCategoryOutput> {
  return productDescriptionAndCategoryFlow(input);
}

const productDescriptionAndCategoryPrompt = ai.definePrompt({
  name: 'productDescriptionAndCategoryPrompt',
  input: {schema: ProductDescriptionAndCategoryInputSchema},
  output: {schema: ProductDescriptionAndCategoryOutputSchema},
  prompt: `You are an expert in e-commerce product management, specializing in categorization and writing compelling product descriptions.
Given the product name and its key attributes, your task is to:
1. Suggest a single, appropriate product category.
2. Generate a concise and appealing product description suitable for an online retail store.

Product Name: {{{productName}}}
Attributes: {{{attributes}}}

Based on the above information, provide your suggestions in the specified JSON format.`,
});

const productDescriptionAndCategoryFlow = ai.defineFlow(
  {
    name: 'productDescriptionAndCategoryFlow',
    inputSchema: ProductDescriptionAndCategoryInputSchema,
    outputSchema: ProductDescriptionAndCategoryOutputSchema,
  },
  async (input) => {
    const {output} = await productDescriptionAndCategoryPrompt(input);
    return output!;
  }
);
