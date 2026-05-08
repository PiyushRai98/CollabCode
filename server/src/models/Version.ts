import mongoose, { Schema, Document } from 'mongoose';

export interface IVersion extends Document {
  documentId: mongoose.Types.ObjectId;
  version: number;
  yjsState: Buffer;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  label?: string;
  createdAt: Date;
}

const versionSchema = new Schema<IVersion>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
    version: { type: Number, required: true },
    yjsState: { type: Buffer, required: true },
    content: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String },
  },
  { timestamps: true }
);

versionSchema.index({ documentId: 1, version: -1 });

export const Version = mongoose.model<IVersion>('Version', versionSchema);
