import { handleApi } from "@/presentation/api/route-handler";
import { requireTenantContext } from "@/presentation/auth/session";
import Anthropic from "@anthropic-ai/sdk";

// Naikkan timeout Next.js untuk route ini — vision bisa butuh 30-60 detik
export const maxDuration = 60;

// Buat client tanpa bergantung pada env ANTHROPIC_AUTH_TOKEN yang bisa kosong
function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY belum dikonfigurasi.");
  return new Anthropic({ apiKey, authToken: undefined });
}

const EXTRACTION_PROMPT = `Kamu adalah sistem OCR untuk form laporan keuangan harian waterpark "Water Byur".
Ekstrak SEMUA data yang tertulis (termasuk tulisan tangan) dari gambar form ini.

Kembalikan HANYA JSON valid dengan format berikut (tanpa teks lain):
{
  "hari": "nama hari atau kosong jika tidak terbaca",
  "tanggal": "DD-MM-YYYY atau kosong jika tidak terbaca",
  "pemasukan": [
    { "nama": "nama item", "jumlah": angka_tanpa_titik_koma }
  ],
  "pengeluaran": [
    { "nama": "nama item", "jumlah": angka_tanpa_titik_koma }
  ]
}

Aturan:
- Hanya masukkan item yang ada angkanya (tidak kosong/titik-titik saja)
- "jumlah" adalah angka integer, tanpa Rp, tanpa titik/koma (contoh: 2630000)
- Kalau tulisan tidak jelas, tetap coba baca semaksimal mungkin
- Abaikan baris kosong / hanya titik-titik`;

export async function POST(request: Request) {
  return handleApi(async () => {
    await requireTenantContext(request);

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) throw new Error("File gambar tidak ditemukan.");

    // Client mengompres ke ~1.4MB JPEG sebelum upload; tolak jika masih terlalu besar.
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > 4_500_000) {
      throw new Error("Gambar terlalu besar. Coba foto ulang dengan pencahayaan lebih terang.");
    }
    const base64 = Buffer.from(bytes).toString("base64");
    const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    const client = getClient();
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const firstContent = message.content[0];
    const raw = firstContent?.type === "text" ? firstContent.text : "";

    // Parse JSON dari response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Tidak dapat mengekstrak data dari gambar. Pastikan foto jelas dan form terlihat.");

    return JSON.parse(jsonMatch[0]);
  });
}
