import { Transform, TransformCallback } from 'stream';

const MAGIC_NUMBERS: Record<string, Buffer[]> = {
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])], // %PDF
  'image/png': [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/jpg': [Buffer.from([0xFF, 0xD8, 0xFF])]
};

export class StreamingFileValidator extends Transform {
  private expectedMimeType: string;
  private maxSize: number;
  private buffer: Buffer;
  private headerValidated: boolean;
  private requiredHeaderLength: number;
  public totalBytesProcessed: number;

  constructor(mimeType: string, maxSize: number) {
    super();
    this.expectedMimeType = mimeType;
    this.maxSize = maxSize;
    this.buffer = Buffer.alloc(0);
    this.headerValidated = false;
    this.totalBytesProcessed = 0;

    const signatures = MAGIC_NUMBERS[mimeType] || [];
    this.requiredHeaderLength = signatures.reduce((max, sig) => Math.max(max, sig.length), 0);
  }

  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    this.totalBytesProcessed += chunkBuffer.length;

    if (this.totalBytesProcessed > this.maxSize) {
      const err = new Error(`File size limit exceeded. Maximum allowed is ${this.maxSize} bytes.`);
      (err as any).code = 'FILE_TOO_LARGE';
      return callback(err);
    }

    if (!this.headerValidated) {
      this.buffer = Buffer.concat([this.buffer, chunkBuffer]);

      if (this.buffer.length >= this.requiredHeaderLength || chunkBuffer.length === 0) {
        if (!this.validateMagicNumber(this.buffer)) {
          const err = new Error(`Invalid file content for mime type ${this.expectedMimeType}. File signature mismatch.`);
          (err as any).code = 'INVALID_FILE_CONTENT';
          return callback(err);
        }
        
        this.headerValidated = true;
        this.push(this.buffer);
        this.buffer = Buffer.alloc(0); // clear buffer
        return callback();
      } else {
        // We haven't received enough bytes to check magic numbers yet
        return callback();
      }
    }

    // Already validated, just pass through
    this.push(chunkBuffer);
    callback();
  }

  _flush(callback: TransformCallback): void {
    // If stream ended before we got enough bytes to validate
    if (!this.headerValidated && this.buffer.length > 0) {
      if (!this.validateMagicNumber(this.buffer)) {
        const err = new Error(`Invalid file content for mime type ${this.expectedMimeType}. File signature mismatch.`);
        (err as any).code = 'INVALID_FILE_CONTENT';
        return callback(err);
      }
      this.push(this.buffer);
    } else if (!this.headerValidated && this.totalBytesProcessed === 0) {
      const err = new Error(`Empty file stream.`);
      (err as any).code = 'EMPTY_FILE';
      return callback(err);
    }
    callback();
  }

  private validateMagicNumber(buf: Buffer): boolean {
    const signatures = MAGIC_NUMBERS[this.expectedMimeType];
    if (!signatures || signatures.length === 0) {
      // If we don't have signatures for this MIME type, we allow it
      return true; 
    }

    for (const sig of signatures) {
      // strict prefix check
      if (buf.length >= sig.length && buf.subarray(0, sig.length).equals(sig)) {
        return true;
      }
    }
    
    return false;
  }
}
