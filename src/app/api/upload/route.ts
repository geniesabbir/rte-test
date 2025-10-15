import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(JSON.stringify({ error: 'Expected multipart/form-data' }), { status: 400 });
  }

  // Simple but limited multipart parser using form-data-stream is not available.
  // For demonstration, write the raw body to a file with a timestamped name.
  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filename = `upload-${Date.now()}`;
  const filepath = path.join(uploadsDir, filename);
  fs.writeFileSync(filepath, buffer);

  const url = `/uploads/${filename}`;
  return new Response(JSON.stringify({ url }), { status: 200, headers: { 'content-type': 'application/json' } });
}
