import "server-only";

import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { ValidationError } from "@/server/domain/errors";
import { STAFF_PHOTO_MAX_BYTES, STAFF_PHOTO_TYPES } from "@/server/validators/staff";

// Turns an uploaded photo into what we actually store: a small JPEG.
// Compression happens here, on the server only -- the browser uploads the
// original. Kept apart from staff.service so that file reads as business
// logic, and this one as "image handling".

/**
 * An uploaded file as plain data. Deliberately not the browser's `File`
 * object: a Server Action converts it to this, and a NestJS controller would
 * convert Multer's upload to the same shape -- this code never knows which.
 */
export interface PhotoUpload {
    bytes: Buffer;
    /** The type the browser claimed, e.g. "image/png". A label, not proof. */
    type: string;
}

/** Longest side of the stored photo, in pixels. Plenty for a details page. */
const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 80;

export async function processStaffPhoto(upload: PhotoUpload): Promise<Buffer> {
    if (!(STAFF_PHOTO_TYPES as readonly string[]).includes(upload.type)) {
        throw new ValidationError("Photo must be a JPEG, PNG or WebP image");
    }
    if (upload.bytes.length > STAFF_PHOTO_MAX_BYTES) {
        throw new ValidationError(`Photo must be under ${STAFF_PHOTO_MAX_BYTES / (1024 * 1024)} MB`);
    }

    try {
        return await sharp(upload.bytes)
            // Phones save sideways shots with a "rotate me" note (EXIF) rather
            // than rotating the pixels. Apply it, or portraits display on their side.
            .rotate()
            // Lever 1, the big one: fit inside 1024x1024, keeping the shape --
            // no cropping -- and never enlarging a photo that's already small.
            .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
            // Lever 2: lossy JPEG at quality 80. A 4 MB phone photo ends up
            // roughly 100-300 KB. Lever 3 is automatic: sharp leaves metadata
            // out of the output unless asked to keep it -- including the GPS
            // location many phones embed.
            .jpeg({ quality: JPEG_QUALITY })
            .toBuffer();
    } catch {
        // The browser's type label can be faked; decoding is the real test.
        // A renamed PDF, a corrupt file, or an iPhone HEIC ends up here.
        throw new ValidationError("This file couldn't be read as an image");
    }
}

/**
 * A new, unguessable storage key. Random rather than the staff member's name:
 * names change and collide, and would put personal data into URLs and logs.
 * Not tied to the staff id either, so the photo can be saved before the staff
 * row exists (see createStaff).
 */
export function newStaffPhotoKey(): string {
    return `staff/${randomUUID()}.jpg`;
}
