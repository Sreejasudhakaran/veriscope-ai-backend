import mongoose, { Document, Schema } from 'mongoose'

export interface IReport extends Document {
  productId: mongoose.Types.ObjectId
  userId?: mongoose.Types.ObjectId
  summary: string
  transparencyScore: number
  analysis: {
    strengths: string[]
    improvements: string[]
    recommendations: string[]
  }
  answers: Record<string, any>
  pdfUrl?: string
  status: 'draft' | 'pending' | 'completed'
  createdAt: Date
  updatedAt: Date
}

const ReportSchema = new Schema<IReport>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product ID is required']
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  summary: {
    type: String,
    required: [true, 'Report summary is required'],
    trim: true,
    maxlength: [2000, 'Summary cannot exceed 2000 characters']
  },
  transparencyScore: {
    type: Number,
    required: [true, 'Transparency score is required'],
    min: [0, 'Score cannot be negative'],
    max: [100, 'Score cannot exceed 100']
  },
  analysis: {
    strengths: [{
      type: String,
      trim: true
    }],
    improvements: [{
      type: String,
      trim: true
    }],
    recommendations: [{
      type: String,
      trim: true
    }]
  },
  answers: {
    type: Schema.Types.Mixed,
    default: {}
  },
  pdfUrl: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Report status is required'],
    enum: ['draft', 'pending', 'completed'],
    default: 'draft'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes
ReportSchema.index({ productId: 1 })
ReportSchema.index({ status: 1 })
ReportSchema.index({ transparencyScore: -1 })
ReportSchema.index({ createdAt: -1 })

// Virtual for score category
ReportSchema.virtual('scoreCategory').get(function() {
  if (this.transparencyScore >= 80) return 'Excellent'
  if (this.transparencyScore >= 60) return 'Good'
  if (this.transparencyScore >= 40) return 'Fair'
  return 'Needs Improvement'
})

// Virtual for completion percentage
ReportSchema.virtual('completionPercentage').get(function() {
  const totalFields = Object.keys(this.answers).length
  const completedFields = Object.values(this.answers).filter(value => 
    value !== null && value !== undefined && value !== ''
  ).length
  return totalFields > 0 ? Math.round((completedFields / totalFields) * 100) : 0
})

// Pre-save middleware to validate analysis
ReportSchema.pre('save', function(next) {
  if (this.status === 'completed' && this.transparencyScore < 0) {
    return next(new Error('Completed reports must have a valid transparency score'))
  }
  next()
})

export const Report = mongoose.model<IReport>('Report', ReportSchema)
