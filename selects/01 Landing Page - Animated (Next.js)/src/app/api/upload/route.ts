import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll("files");

  if (!files.length) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  // For now, just acknowledge the upload
  // TODO: Store in Supabase Storage and parse content
  const fileInfo = await Promise.all(
    files.map(async (file) => {
      if (file instanceof File) {
        return {
          name: file.name,
          size: file.size,
          type: file.type,
        };
      }
      return null;
    })
  );

  console.log("[Upload] Files received:", fileInfo.filter(Boolean));

  return Response.json({
    success: true,
    files: fileInfo.filter(Boolean),
    message: "Files received. Processing will begin when you join the waitlist.",
  });
}
