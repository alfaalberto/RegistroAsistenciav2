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

export async function suggestMetadata(input: SuggestMetadataInput): Promise<SuggestMetadataOutput> {
  return suggestMetadataFlow(input);
}

const suggestMetadataPrompt = ai.definePrompt({
  name: 'suggestMetadataPrompt',
  input: {schema: SuggestMetadataInputSchema},
  output: {schema: SuggestMetadataOutputSchema},
  prompt: `You are an AI assistant designed to analyze Excel files and suggest suitable sheet names and date formats.

  Analyze the provided Excel file data and identify potential sheet names that contain relevant data.
  Also, identify a common date format used within the Excel file.

  Excel File Data (data URI): {{media url=excelDataUri}}
  
  Return the suggested sheet names as an array of strings and the suggested date format as a string. Focus on providing accurate and helpful suggestions to facilitate data extraction.
  `,
});

const suggestMetadataFlow = ai.defineFlow(
  {
    name: 'suggestMetadataFlow',
    inputSchema: SuggestMetadataInputSchema,
    outputSchema: SuggestMetadataOutputSchema,
  },
  async input => {
    const {output} = await suggestMetadataPrompt(input);
    return output!;
  }
);

