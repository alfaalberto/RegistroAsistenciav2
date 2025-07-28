"use client";

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UploadCloud, File as FileIcon, Loader2, Download, VenetianMask } from 'lucide-react';
import { suggestMetadata, SuggestMetadataOutput } from '@/ai/flows/suggest-metadata';
import { processExcel, ProcessConfig } from '@/lib/excel-processor';
import { exportToCsv } from '@/lib/csv-utils';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  sheetName: z.string().min(1, 'Sheet name is required.'),
  days: z.string().min(1, 'Days are required (e.g., 22, 23, 24).').regex(/^(\d+,\s*)*\d+$/, 'Must be a comma-separated list of numbers.'),
  year: z.coerce.number().min(1900, "Year must be after 1900.").max(2100, "Year must be before 2100."),
  month: z.string().min(3, 'Month abbreviation is required (e.g., Jul).').max(3, "Month must be a 3-letter abbreviation."),
});

type ExtractedData = Record<string, any>[];

export default function ExcelExtractor() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isProcessing, startProcessing] = useTransition();
  const [isSuggesting, startSuggesting] = useTransition();
  const [aiSuggestions, setAiSuggestions] = useState<SuggestMetadataOutput | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sheetName: '',
      days: '22, 23, 24',
      year: new Date().getFullYear(),
      month: 'Jul',
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !selectedFile.name.endsWith('.xlsx')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a valid .xlsx Excel file.',
        });
        return;
      }

      setFile(selectedFile);
      setExtractedData(null);
      setAiSuggestions(null);
      form.reset({
        sheetName: '',
        days: '22, 23, 24',
        year: new Date().getFullYear(),
        month: 'Jul',
      });

      startSuggesting(async () => {
        try {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const dataUri = e.target?.result as string;
            const suggestions = await suggestMetadata({ excelDataUri: dataUri });
            setAiSuggestions(suggestions);
            if (suggestions.suggestedSheetNames?.length > 0) {
              form.setValue('sheetName', suggestions.suggestedSheetNames[0]);
            }
          };
          reader.readAsDataURL(selectedFile);
        } catch (error) {
          console.error('AI suggestion failed:', error);
          toast({
            variant: 'destructive',
            title: 'AI Suggestion Failed',
            description: 'Could not get suggestions for this file.',
          });
        }
      });
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: 'No File',
        description: 'Please upload a file first.',
      });
      return;
    }

    startProcessing(async () => {
      try {
        const data = await processExcel(file, values as ProcessConfig);
        if (data.length === 0) {
          toast({
            variant: 'destructive',
            title: 'No Data Extracted',
            description: 'Could not find any matching records. Check your configuration.',
          });
          setExtractedData(null);
        } else {
          setExtractedData(data);
          toast({
            title: 'Extraction Successful',
            description: `Extracted ${data.length} records.`,
          });
        }
      } catch (error: any) {
        console.error('Processing failed:', error);
        toast({
          variant: 'destructive',
          title: 'Extraction Failed',
          description: error.message || 'An unknown error occurred.',
        });
        setExtractedData(null);
      }
    });
  };
  
  const handleExportCsv = () => {
    if (extractedData) {
      exportToCsv(extractedData, 'RegistroAsistenciaDepurado.csv');
    }
  };
  
  const tableHeaders = extractedData ? Object.keys(extractedData[0]) : [];

  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold font-headline text-primary sm:text-5xl">Excel Data Extractor</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">Upload your Excel attendance report, configure the parameters, and get your structured data instantly.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>1. Upload File</CardTitle>
              <CardDescription>Select or drop your .xlsx file here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="file-upload" className="relative block w-full border-2 border-dashed rounded-lg p-12 text-center hover:border-primary transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UploadCloud className="h-10 w-10" />
                  <span>{file ? 'Click to select another file' : 'Click to select or drag & drop a file'}</span>
                  <Input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                </div>
              </Label>
              {file && (
                <div className="mt-4 flex items-center gap-3 bg-secondary p-3 rounded-md">
                  <FileIcon className="h-6 w-6 text-primary" />
                  <div className="text-sm">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {file && (
            <Card>
              <CardHeader>
                <CardTitle>2. Configure Extraction</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  {isSuggesting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSuggesting ? "AI is analyzing your file..." : (aiSuggestions ? "We've suggested some values based on your file." : "Fill in the details for data extraction.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="sheetName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sheet Name</FormLabel>
                          {isSuggesting ? (
                            <div className="flex items-center space-x-2 h-10"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Loading suggestions...</span></div>
                          ) : (
                          aiSuggestions && aiSuggestions.suggestedSheetNames.length > 0 ? (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select a sheet" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {aiSuggestions.suggestedSheetNames.map(name => (
                                  <SelectItem key={name} value={name}>{name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <FormControl>
                              <Input placeholder="e.g., Registro asistencia" {...field} />
                            </FormControl>
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="days"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Days</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 22, 23, 24" {...field} />
                            </FormControl>
                            <FormDescription>Comma-separated day numbers.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="month"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Month</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Jul" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Year</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="e.g., 2025" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                     {aiSuggestions?.suggestedDateFormat && (
                      <p className="text-sm text-muted-foreground pt-2">AI suggested date format: <code className="bg-secondary px-1 py-0.5 rounded">{aiSuggestions.suggestedDateFormat}</code></p>
                    )}
                    <Button type="submit" className="w-full" disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessing ? 'Extracting Data...' : 'Extract Data'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-1">
          <Card className="min-h-[400px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>3. Extracted Data</CardTitle>
                <CardDescription>Results from the Excel file will appear here.</CardDescription>
              </div>
              {extractedData && (
                <Button onClick={handleExportCsv} size="sm" variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isProcessing && (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-4" />
                  <p>Processing your file...</p>
                </div>
              )}
              {!isProcessing && extractedData && (
                <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                  <div className="max-h-[60vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                          {tableHeaders.map(header => <TableHead key={header}>{header}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extractedData.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {tableHeaders.map((header) => {
                              const cellValue = row[header];
                              const isNoRegistro = cellValue === 'NO HAY REGISTRO';
                              const isRegistroIncompleto = cellValue === 'REGISTRO INCOMPLETO';
                              const isHorasInsuficientes = typeof cellValue === 'number' && cellValue < 7.75;

                              return (
                                <TableCell
                                  key={`${rowIndex}-${header}`}
                                  className={cn({
                                    'text-destructive font-semibold': isNoRegistro,
                                    'text-yellow-500 font-semibold': isRegistroIncompleto,
                                    'text-orange-400 font-semibold': isHorasInsuficientes,
                                  })}
                                >
                                  {String(cellValue)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
              {!isProcessing && !extractedData && (
                <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                  <VenetianMask className="h-12 w-12 mb-4 text-primary/50" />
                  <p className="font-medium">Your data is currently a mystery.</p>
                  <p className="text-sm">Upload a file and process it to reveal the contents.</p>
                </div>
              )}
            </CardContent>
             {extractedData && <CardFooter><p className="text-sm text-muted-foreground">Showing {extractedData.length} records.</p></CardFooter>}
          </Card>
        </div>
      </div>
    </div>
  );
}
