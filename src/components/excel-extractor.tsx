"use client";

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UploadCloud, File as FileIcon, Loader2, Download, VenetianMask, AlertCircle, CheckCircle, Clock } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';


const formSchema = z.object({
  sheetName: z.string().min(1, 'Sheet name is required.'),
  days: z.string().min(1, 'Days are required (e.g., 22, 23, 24).').regex(/^(\d+,\s*)*\d+$/, 'Must be a comma-separated list of numbers.'),
  year: z.coerce.number().min(1900, "Year must be after 1900.").max(new Date().getFullYear() + 1, "Year cannot be in the future."),
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
      days: '',
      year: new Date().getFullYear(),
      month: new Date().toLocaleString('en-US', { month: 'short' }),
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
        days: '',
        year: new Date().getFullYear(),
        month: new Date().toLocaleString('en-US', { month: 'short' }),
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

  const getStatusBadge = (value: any) => {
    if (typeof value !== 'string') return null;
    if (value === 'NO HAY REGISTRO') {
      return <Badge variant="destructive" className="flex items-center gap-1.5"><AlertCircle className="h-3 w-3" /> {value}</Badge>;
    }
    if (value === 'REGISTRO INCOMPLETO') {
      return <Badge variant="secondary" className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 flex items-center gap-1.5"><Clock className="h-3 w-3" /> {value}</Badge>;
    }
    return null;
  }

  return (
    <div className="space-y-8">
      <header className="text-center py-8">
        <h1 className="text-4xl font-bold tracking-tighter text-foreground sm:text-5xl md:text-6xl">Attendance Extractor</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Upload your Excel attendance report, configure parameters, and instantly get structured, analyzed data.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">1</span> Upload File</CardTitle>
              <CardDescription>Select or drop your .xlsx file here.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="file-upload" className="relative block w-full border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary hover:bg-muted transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UploadCloud className="h-10 w-10 text-primary" />
                  <span>{file ? 'Click to select another file' : 'Click to select or drag & drop a file'}</span>
                  <Input id="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
                </div>
              </Label>
              {file && (
                <div className="mt-4 flex items-center gap-3 bg-secondary p-3 rounded-md border border-border">
                  <FileIcon className="h-6 w-6 text-primary" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {file && (
            <Card className="shadow-lg">
              <CardHeader>
                 <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">2</span> Configure Extraction</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
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
                              <Input placeholder="e.g., Attendance Report" {...field} />
                            </FormControl>
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                     <FormField
                        control={form.control}
                        name="days"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., 22, 23, 24" {...field} />
                            </FormControl>
                            <FormDescription>Comma-separated day numbers.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     {aiSuggestions?.suggestedDateFormat && (
                      <p className="text-sm text-muted-foreground pt-2">AI suggested date format: <code className="bg-muted px-1.5 py-1 rounded-sm text-foreground">{aiSuggestions.suggestedDateFormat}</code></p>
                    )}
                    <Button type="submit" size="lg" className="w-full font-semibold" disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessing ? 'Extracting Data...' : 'Extract & Analyze Data'}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="lg:col-span-3">
          <Card className="min-h-[600px] shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                 <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">3</span> Extracted Data</CardTitle>
                <CardDescription className="pt-1">Results from the Excel file will appear here.</CardDescription>
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
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                  <p className="text-lg">Processing your file...</p>
                </div>
              )}
              {!isProcessing && extractedData && (
                <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                  <div className="max-h-[70vh] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-muted z-10">
                        <TableRow>
                          {tableHeaders.map(header => <TableHead key={header} className="font-semibold text-foreground">{header}</TableHead>)}
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
                              const isHorasNormales = typeof cellValue === 'number' && cellValue >= 7.75;

                              const badge = getStatusBadge(cellValue);
                              
                              if (badge) {
                                return (
                                  <TableCell key={`${rowIndex}-${header}`}>
                                    {badge}
                                  </TableCell>
                                )
                              }
                              
                              return (
                                <TableCell
                                  key={`${rowIndex}-${header}`}
                                  className={cn('text-foreground', {
                                    'font-semibold text-orange-400': isHorasInsuficientes,
                                    'text-green-400': isHorasNormales,
                                  })}
                                >
                                  {cellValue?.toString().split('\n').map((line: string, i: number) => (
                                    <div key={i} className={cn({'flex items-center gap-1.5': cellValue?.toString().includes('\n')})}>
                                      {cellValue?.toString().includes('\n') && <CheckCircle className={cn('h-3 w-3', i === 0 ? 'text-green-500': 'text-red-500')} />}
                                      {line}
                                    </div>
                                  ))}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              )}
              {!isProcessing && !extractedData && (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground/80">
                  <VenetianMask className="h-16 w-16 mb-4 text-primary/50" />
                  <p className="font-medium text-lg text-foreground">Your data is currently a mystery.</p>
                  <p className="text-sm">Upload a file and process it to reveal the contents.</p>
                </div>
              )}
            </CardContent>
             {extractedData && <CardFooter><p className="text-sm text-muted-foreground">Showing {extractedData.length} of {extractedData.length} records.</p></CardFooter>}
          </Card>
        </div>
      </div>
    </div>
  );
}
