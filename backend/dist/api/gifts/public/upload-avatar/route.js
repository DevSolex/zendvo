"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAvatarHandler = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
// Ensure the directory exists
const uploadDir = path_1.default.join(__dirname, "../../../../../public/avatars");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configure multer storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const filename = `${crypto_1.default.randomUUID()}${ext}`;
        cb(null, filename);
    },
});
// Configure multer upload limits and validation
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error("Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed."));
        }
    },
});
// The Express handler
const uploadAvatarHandler = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image provided or invalid file type." });
    }
    // Generate URL for the uploaded avatar
    const url = `/avatars/${req.file.filename}`;
    res.status(200).json({
        message: "Avatar uploaded successfully",
        url,
    });
};
exports.uploadAvatarHandler = uploadAvatarHandler;
