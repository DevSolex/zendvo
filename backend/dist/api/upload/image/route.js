"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const api_utils_1 = require("@/lib/api-utils");
const storage_1 = require("@/lib/storage");
// Multer is handled at the Express middleware level
// The adapter passes the Express request with the file already processed
async function POST(request) {
    try {
        // The Express adapter should have already processed the file with multer
        // and attached it to the request. We need to extract it from the request body.
        // Since we're using Next.js-style routes with Express adapter, we'll need to
        // handle this differently - the file will be in the request as a buffer
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) {
            return (0, api_utils_1.createProblemDetails)("about:blank", "Bad Request", 400, "No file provided. Please upload a file with the 'file' field name.");
        }
        // Validate file type
        const contentType = file.type;
        if (!(0, storage_1.isAllowedFileType)(contentType)) {
            return (0, api_utils_1.createProblemDetails)("about:blank", "Bad Request", 400, "Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
        }
        // Validate file size (10MB limit)
        const fileSize = file.size;
        if (!(0, storage_1.isFileSizeValid)(fileSize)) {
            return (0, api_utils_1.createProblemDetails)("about:blank", "Bad Request", 400, "File size exceeds the 10MB limit.");
        }
        // Convert File to Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        // Upload to S3
        const publicUrl = await (0, storage_1.uploadToS3)(buffer, file.name, contentType);
        return server_1.NextResponse.json({
            url: publicUrl,
            message: "File uploaded successfully",
        }, { status: 200 });
    }
    catch (error) {
        console.error("[IMAGE_UPLOAD_ERROR]", error);
        return (0, api_utils_1.createProblemDetails)("about:blank", "Internal Server Error", 500, "Failed to upload image. Please try again later.");
    }
}
