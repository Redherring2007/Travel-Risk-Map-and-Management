import { store } from '@/lib/store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = store.getReport(id);
  if (!report) return new Response('Report not found', { status: 404 });
  return new Response(report.markdown, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': `attachment; filename="${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md"`
    }
  });
}
