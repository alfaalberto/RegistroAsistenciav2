// src/ai/flows/suggest-metadata.ts
'use server';

/**
 * @fileOverview This file defines a Genkit flow for suggesting Excel sheet names and date formats
 * based on the content of an uploaded Excel file.
 *
 * - suggestMetadata - An async function that takes the Excel file data URI as input and returns suggested sheet names and date formats.
 * - SuggestMetadataInput - The input type for the suggestMetadata function, which is a data URI of the Excel file.
 * - SuggestMetadataOutput - The output type for the suggestMetadata function, which includes suggested sheet names and date formats.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import * as XLSX from 'xlsx';


const SuggestMetadataInputSchema = z.object({
  excelDataUri: z
    .string()
    .describe(
      'The Excel file as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' 
    ),
});
export type SuggestMetadataInput = z.infer<typeof SuggestMetadataInputSchema>;

const SuggestMetadataOutputSchema = z.object({
  suggestedSheetNames: z
    .array(z.string())
    .describe('Suggested sheet names from the Excel file.'),
  suggestedDateFormat: z
    .string()
    .describe('Suggested date format found in the Excel file.'),
});
export type SuggestMetadataOutput = z.infer<typeof SuggestMetadataOutputSchema>;


const InternalPromptInputSchema = z.object({
  sheetNames: z.array(z.string()),
});


export async function suggestMetadata(input: SuggestMetadataInput): Promise<SuggestMetadataOutput> {
  return suggestMetadataFlow(input);
}

const suggestMetadataPrompt = ai.definePrompt({
  name: 'suggestMetadataPrompt',
  input: {schema: InternalPromptInputSchema},
  output: {schema: SuggestMetadataOutputSchema},
  prompt: `You are an AI assistant designed to analyze Excel files and suggest suitable sheet names and date formats.

  From the following list of sheet names, select the one that is most likely to contain attendance data:
  {{#each sheetNames}}
  - {{{this}}}
  {{/each}}
  
  Also, suggest a common date format (e.g., DD-MMM-YYYY).
  
  Return the suggested sheet names as an array containing only the best match and the suggested date format as a string. Focus on providing accurate and helpful suggestions to facilitate data extraction.
  `,
});

const suggestMetadataFlow = ai.defineFlow(
  {
    name: 'suggestMetadataFlow',
    inputSchema: SuggestMetadataInputSchema,
    outputSchema: SuggestMetadataOutputSchema,
  },
  async (input) => {
    const base64Data = input.excelDataUri.split(',')[1];
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetNames = workbook.SheetNames;

    const { output } = await suggestMetadataPrompt({ sheetNames });
    // Ensure we always work with a valid object
    const result = output ?? { suggestedSheetNames: [], suggestedDateFormat: '' };

    let finalSuggestedSheetNames: string[];
    if (Array.isArray(result.suggestedSheetNames) && result.suggestedSheetNames.length > 0) {
      const suggestedSheet = result.suggestedSheetNames[0];
      const otherSheets = sheetNames.filter((name) => name !== suggestedSheet);
      finalSuggestedSheetNames = [suggestedSheet, ...otherSheets];
    } else {
      finalSuggestedSheetNames = sheetNames;
    }

    const finalOutput: SuggestMetadataOutput = {
      suggestedSheetNames: finalSuggestedSheetNames,
      suggestedDateFormat: result.suggestedDateFormat ?? '',
    };

    return finalOutput;
  }
);
