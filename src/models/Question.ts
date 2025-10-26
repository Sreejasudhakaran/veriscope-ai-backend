import mongoose, { Document, Schema } from 'mongoose'

export interface IQuestion extends Document {
  productId: mongoose.Types.ObjectId
  questionText: string
  answer?: string
  questionType: 'text' | 'select' | 'multiselect'
  options?: string[]
  isRequired: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

const QuestionSchema = new Schema<IQuestion>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  questionText: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true,
    maxlength: [500, 'Question text cannot exceed 500 characters']
  },
  answer: {
    type: String,
    trim: true,
    maxlength: [1000, 'Answer cannot exceed 1000 characters']
  },
  questionType: {
    type: String,
    required: [true, 'Question type is required'],
    enum: ['text', 'select', 'multiselect'],
    default: 'text'
  },
  options: [{
    type: String,
    trim: true
  }],
  isRequired: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: [true, 'Question order is required'],
    min: [0, 'Order must be non-negative']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
QuestionSchema.index({ productId: 1, order: 1 })
QuestionSchema.index({ productId: 1 })

// Virtual for formatted question
QuestionSchema.virtual('formattedQuestion').get(function() {
  return `${this.order + 1}. ${this.questionText}`
})

export const Question = mongoose.model<IQuestion>('Question', QuestionSchema)
