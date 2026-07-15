import { supabase } from "@/integrations/supabase/client";

export const COMPANY_DOCUMENTS_BUCKET = "company-documents";
export const GENERATED_DOCUMENTS_BUCKET = "generated-documents";

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

export const isGeneratedDocumentReference = (filePath?: string | null, notes?: string | null) => {
  if (notes?.startsWith("promissory-note:") || notes?.startsWith("written-consent:")) return true;
  if (!filePath) return false;
  return (
    filePath.startsWith(`${GENERATED_DOCUMENTS_BUCKET}/`) ||
    filePath.includes(`/storage/v1/object/public/${GENERATED_DOCUMENTS_BUCKET}/`) ||
    filePath.includes(`/storage/v1/object/sign/${GENERATED_DOCUMENTS_BUCKET}/`)
  );
};

export const extractStoragePath = (filePath: string | null | undefined, bucket: string) => {
  if (!filePath) return null;

  if (filePath.startsWith(`${bucket}/`)) {
    return filePath.slice(bucket.length + 1);
  }

  if (!isHttpUrl(filePath)) {
    return filePath;
  }

  try {
    const url = new URL(filePath);
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
    ];
    const marker = markers.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    return decodeURIComponent(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
};

export const createGeneratedDocumentSignedUrl = async (filePath: string, expiresInSeconds = 600) => {
  const storagePath = extractStoragePath(filePath, GENERATED_DOCUMENTS_BUCKET);
  if (!storagePath) throw new Error("Unable to locate the saved document in storage.");

  const { data, error } = await supabase.storage
    .from(GENERATED_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Unable to create a secure document link.");
  return data.signedUrl;
};

export const downloadGeneratedDocumentBlob = async (filePath: string) => {
  const storagePath = extractStoragePath(filePath, GENERATED_DOCUMENTS_BUCKET);
  if (!storagePath) throw new Error("Unable to locate the saved document in storage.");

  const { data, error } = await supabase.storage
    .from(GENERATED_DOCUMENTS_BUCKET)
    .download(storagePath);
  if (error) throw error;
  return data;
};

export const saveBlobAsFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};