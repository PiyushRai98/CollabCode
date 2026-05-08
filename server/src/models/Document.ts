import mongoose, { Schema, Document as MongoDoc } from 'mongoose';

export interface IDocument extends MongoDoc {
  title: string;
  language: string;
  ownerId: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[];
  yjsState: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    title: { type: String, required: true, default: 'Untitled' },
    language: { type: String, required: true, default: 'javascript' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    yjsState: { type: Buffer, default: Buffer.alloc(0) },
  },
  { timestamps: true }
);

documentSchema.index({ ownerId: 1 });
documentSchema.index({ collaborators: 1 });

export const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);
