import { NextResponse } from "next/server";
import { extractFromFile, ExtractError } from "@/lib/extract";

export const runtime = "nodejs";
export const maxDuration = 30;

/** POST multipart/form-data { file } -> { text, kind, pages?, words, chars, fileName } */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }

  try {
    const result = await extractFromFile(file);
    return NextResponse.json({ ...result, fileName: file.name });
  } catch (err) {
    if (err instanceof ExtractError) {
      return NextResponse.json({ error: err.userMessage }, { status: err.status });
    }
    console.error("[parse] unexpected error", err);
    return NextResponse.json(
      { error: "Something went wrong reading that file. Try again, or paste the text instead." },
      { status: 500 },
    );
  }
}
