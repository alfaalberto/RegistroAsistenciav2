"use client";

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UploadCloud, File as FileIcon, Loader2, Download, VenetianMask, AlertCircle, CheckCircle, Clock, Expand, FileCode } from 'lucide-react';
import { suggestMetadata, SuggestMetadataOutput } from '@/ai/flows/suggest-metadata';
import { processExcel, ProcessConfig } from '@/lib/excel-processor';
import { exportToCsv } from '@/lib/csv-utils';
import { exportToHtml } from '@/lib/html-utils';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';


const formSchema = z.object({
  sheetName: z.string().min(1, 'El nombre de la hoja es obligatorio.'),
  days: z.string().min(1, 'Los días son obligatorios (ej. 22, 23, 24).').regex(/^(\d+,\s*)*\d+$/, 'Debe ser una lista de números separados por comas.'),
  year: z.coerce.number().min(1900, "El año debe ser posterior a 1900.").max(new Date().getFullYear() + 1, "El año no puede ser en el futuro."),
  month: z.string().min(3, 'La abreviatura del mes es obligatoria (ej. Jul).').max(4, "El mes debe ser una abreviatura de 3 o 4 letras."),
});

type ExtractedData = Record<string, any>[];

const DataTableView = ({ extractedData, tableHeaders, getStatusBadge }: { extractedData: ExtractedData, tableHeaders: string[], getStatusBadge: (value: any) => React.ReactNode }) => {
  return (
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
              const badge = getStatusBadge(cellValue);

              if (badge) {
                return (
                  <TableCell key={`${rowIndex}-${header}`}>
                    {badge}
                  </TableCell>
                )
              }

              const isHorasInsuficientes = typeof cellValue === 'number' && cellValue < 7.75;
              const isHorasNormales = typeof cellValue === 'number' && cellValue >= 7.75;

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
  );
};


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
      month: new Date().toLocaleString('es-ES', { month: 'short' }),
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && !selectedFile.name.endsWith('.xlsx')) {
        toast({
          variant: 'destructive',
          title: 'Tipo de Archivo No Válido',
          description: 'Por favor, sube un archivo Excel .xlsx válido.',
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
        month: new Date().toLocaleString('es-ES', { month: 'short' }),
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
          console.error('La sugerencia de la IA falló:', error);
          toast({
            variant: 'destructive',
            title: 'Fallo en la Sugerencia de la IA',
            description: 'No se pudieron obtener sugerencias para este archivo.',
          });
        }
      });
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (!file) {
      toast({
        variant: 'destructive',
        title: 'No hay Archivo',
        description: 'Por favor, sube un archivo primero.',
      });
      return;
    }

    startProcessing(async () => {
      try {
        const data = await processExcel(file, values as ProcessConfig);
        if (data.length === 0) {
          toast({
            variant: 'destructive',
            title: 'No se Extrajeron Datos',
            description: 'No se encontraron registros coincidentes. Revisa tu configuración.',
          });
          setExtractedData(null);
        } else {
          setExtractedData(data);
          toast({
            title: 'Extracción Exitosa',
            description: `Se extrajeron ${data.length} registros.`,
          });
        }
      } catch (error: any) {
        console.error('El procesamiento falló:', error);
        toast({
          variant: 'destructive',
          title: 'Falló la Extracción',
          description: error.message || 'Ocurrió un error desconocido.',
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
  
  const handleExportHtml = () => {
    if (extractedData) {
      exportToHtml(extractedData, 'RegistroAsistenciaDepurado.html');
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
        <h1 className="text-4xl font-bold tracking-tighter text-foreground sm:text-5xl md:text-6xl">Extractor de Asistencia</h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Sube tu reporte de asistencia en Excel, configura los parámetros y obtén datos estructurados y analizados al instante.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        <div className="lg:col-span-2 space-y-8">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">1</span> Subir Archivo</CardTitle>
              <CardDescription>Selecciona o arrastra tu archivo .xlsx aquí.</CardDescription>
            </CardHeader>
            <CardContent>
              <Label htmlFor="file-upload" className="relative block w-full border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary hover:bg-muted transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <UploadCloud className="h-10 w-10 text-primary" />
                  <span>{file ? 'Haz clic para seleccionar otro archivo' : 'Haz clic para seleccionar o arrastra y suelta un archivo'}</span>
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
                 <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">2</span> Configurar Extracción</CardTitle>
                <CardDescription className="flex items-center gap-2 pt-1">
                  {isSuggesting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSuggesting ? "La IA está analizando tu archivo..." : (aiSuggestions ? "Hemos sugerido algunos valores basados en tu archivo." : "Completa los detalles para la extracción de datos.")}
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
                          <FormLabel>Nombre de la Hoja</FormLabel>
                          {isSuggesting ? (
                            <div className="flex items-center space-x-2 h-10"><Loader2 className="h-4 w-4 animate-spin mr-2" /><span>Cargando sugerencias...</span></div>
                          ) : (
                          aiSuggestions && aiSuggestions.suggestedSheetNames.length > 0 ? (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona una hoja" />
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
                              <Input placeholder="ej. Reporte de Asistencia" {...field} />
                            </FormControl>
                          ))}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <FormField
                        control={form.control}
                        name="month"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Mes</FormLabel>
                            <FormControl>
                              <Input placeholder="ej. Jul" {...field} />
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
                            <FormLabel>Año</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="ej. 2025" {...field} />
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
                            <FormLabel>Días</FormLabel>
                            <FormControl>
                              <Input placeholder="ej. 22, 23, 24" {...field} />
                            </FormControl>
                            <FormDescription>Números de los días separados por comas.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     {aiSuggestions?.suggestedDateFormat && (
                      <p className="text-sm text-muted-foreground pt-2">Formato de fecha sugerido por la IA: <code className="bg-muted px-1.5 py-1 rounded-sm text-foreground">{aiSuggestions.suggestedDateFormat}</code></p>
                    )}
                    <Button type="submit" size="lg" className="w-full font-semibold" disabled={isProcessing}>
                      {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isProcessing ? 'Extrayendo Datos...' : 'Extraer y Analizar Datos'}
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
                 <CardTitle className="flex items-center gap-2"><span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-bold text-lg">3</span> Datos Extraídos</CardTitle>
                <CardDescription className="pt-1">Los resultados del archivo Excel aparecerán aquí.</CardDescription>
              </div>
              {extractedData && (
                <div className="flex items-center gap-2">
                   <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Expand className="mr-2 h-4 w-4" />
                        Ampliar Vista
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                      <DialogHeader>
                        <DialogTitle>Vista de Datos Ampliada</DialogTitle>
                        <DialogDescription>
                          Una vista más grande de los datos extraídos. Puedes desplazarte horizontal y verticalmente.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="flex-grow overflow-hidden">
                        <ScrollArea className="w-full h-full whitespace-nowrap rounded-md border">
                            <DataTableView extractedData={extractedData} tableHeaders={tableHeaders} getStatusBadge={getStatusBadge} />
                          <ScrollBar orientation="horizontal" />
                          <ScrollBar orientation="vertical" />
                        </ScrollArea>
                      </div>
                       <DialogFooter>
                         <DialogClose asChild>
                           <Button variant="outline">Cerrar</Button>
                         </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button onClick={handleExportCsv} size="sm" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    CSV
                  </Button>
                  <Button onClick={handleExportHtml} size="sm" variant="outline">
                    <FileCode className="mr-2 h-4 w-4" />
                    HTML
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {isProcessing && (
                <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                  <p className="text-lg">Procesando tu archivo...</p>
                </div>
              )}
              {!isProcessing && extractedData && (
                <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                  <div className="max-h-[60vh] overflow-auto">
                    <DataTableView extractedData={extractedData} tableHeaders={tableHeaders} getStatusBadge={getStatusBadge} />
                  </div>
                  <ScrollBar orientation="horizontal" />
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              )}
              {!isProcessing && !extractedData && (
                <div className="flex flex-col items-center justify-center h-96 text-center text-muted-foreground/80">
                  <VenetianMask className="h-16 w-16 mb-4 text-primary/50" />
                  <p className="font-medium text-lg text-foreground">Tus datos son actualmente un misterio.</p>
                  <p className="text-sm">Sube un archivo y procésalo para revelar el contenido.</p>
                </div>
              )}
            </CardContent>
             {extractedData && <CardFooter><p className="text-sm text-muted-foreground">Mostrando {extractedData.length} de {extractedData.length} registros.</p></CardFooter>}
          </Card>
        </div>
      </div>
    </div>
  );
}
