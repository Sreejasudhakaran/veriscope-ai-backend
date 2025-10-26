import mongoose, { Document, Schema } from 'mongoose'

export interface IProduct extends Document {
  name: string
  category: string
  brand: string
  ingredients: string[]
  description?: string
  certifications?: string[]
  packaging?: string
  sustainability?: string
  createdAt: Date
  updatedAt: Date
}

const ProductSchema = new Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  category: {
    type: String,
    required: [true, 'Product category is required'],
    enum: [
      'Skincare',
      'Food & Beverage',
      'Personal Care',
      'Cleaning Products',
      'Clothing',
      'Electronics',
      'Other'
    ]
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  ingredients: [{
    type: String,
    trim: true
  }],
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  certifications: [{
    type: String,
    trim: true
  }],
  packaging: {
    type: String,
    trim: true,
    maxlength: [200, 'Packaging description cannot exceed 200 characters']
  },
  sustainability: {
    type: String,
    trim: true,
    maxlength: [500, 'Sustainability description cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})

// Indexes for better query performance
ProductSchema.index({ name: 'text', brand: 'text', description: 'text' })
ProductSchema.index({ category: 1 })
ProductSchema.index({ brand: 1 })
ProductSchema.index({ createdAt: -1 })

// Virtual for ingredient count
ProductSchema.virtual('ingredientCount').get(function() {
  return this.ingredients.length
})

// Pre-save middleware to validate ingredients
ProductSchema.pre('save', function(next) {
  if (this.ingredients && this.ingredients.length === 0) {
    return next(new Error('At least one ingredient is required'))
  }
  next()
})

export const Product = mongoose.model<IProduct>('Product', ProductSchema)
