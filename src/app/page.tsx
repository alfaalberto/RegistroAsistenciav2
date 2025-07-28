import ExcelExtractor from '@/components/excel-extractor';

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <ExcelExtractor />
      </div>
    </main>
  );
}
