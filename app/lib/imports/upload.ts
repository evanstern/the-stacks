export const allowedUploadExtensions = [".json", ".md", ".txt", ".epub", ".mobi", ".pdf", ".docx"] as const;
export const maxUploadBytes = 25 * 1024 * 1024;
export const uploadAdapterVersion = "upload-foundation-v1";

export type AllowedUploadExtension = (typeof allowedUploadExtensions)[number];
