import express, { Request, Response } from 'express'
import { body, validationResult, query } from 'express-validator'
import { Product } from '../models/Product'
import { protect } from '../middleware/auth'

const router = express.Router()

// @desc    Get all products
// @route   GET /api/products
// @access  Private
router.get(
  '/',
  [
    protect,
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().trim().isLength({ max: 100 }).withMessage('Search term cannot exceed 100 characters'),
    query('category').optional().trim().isLength({ max: 50 }).withMessage('Category cannot exceed 50 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        })
        return
      }

      const page = parseInt((req.query.page as string) ?? '1')
      const limit = parseInt((req.query.limit as string) ?? '10')
      const skip = (page - 1) * limit
      const search = req.query.search as string | undefined
      const category = req.query.category as string | undefined

      const queryObj: Record<string, any> = {}

      if (search) {
        queryObj.$or = [
          { name: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ]
      }

      if (category) {
        queryObj.category = category
      }

      const products = await Product.find(queryObj)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()

      const total = await Product.countDocuments(queryObj)
      const totalPages = Math.ceil(total / limit)

      res.json({
        success: true,
        count: products.length,
        total,
        page,
        totalPages,
        data: products,
      })
    } catch (error) {
      console.error('Get products error:', error)
      res.status(500).json({
        success: false,
        error: 'Server error fetching products',
      })
    }
  }
)

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
router.get('/:id', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      })
      return
    }

    res.json({
      success: true,
      data: product,
    })
  } catch (error) {
    console.error('Get product error:', error)
    res.status(500).json({
      success: false,
      error: 'Server error fetching product',
    })
  }
})

// @desc    Create new product
// @route   POST /api/products
// @access  Private
router.post(
  '/',
  [
    protect,
    body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
    body('category')
      .isIn(['Skincare', 'Food & Beverage', 'Personal Care', 'Cleaning Products', 'Clothing', 'Electronics', 'Other'])
      .withMessage('Invalid category'),
    body('brand').trim().isLength({ min: 1, max: 100 }).withMessage('Brand must be between 1 and 100 characters'),
    body('ingredients').isArray({ min: 1 }).withMessage('At least one ingredient is required'),
    body('ingredients.*')
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each ingredient must be between 1 and 100 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('certifications').optional().isArray().withMessage('Certifications must be an array'),
    body('certifications.*')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Each certification cannot exceed 100 characters'),
    body('packaging').optional().trim().isLength({ max: 200 }).withMessage('Packaging description cannot exceed 200 characters'),
    body('sustainability')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Sustainability description cannot exceed 500 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        })
        return
      }

      const product = await Product.create(req.body)
      res.status(201).json({
        success: true,
        data: product,
      })
    } catch (error) {
      console.error('Create product error:', error)
      res.status(500).json({
        success: false,
        error: 'Server error creating product',
      })
    }
  }
)

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
router.put(
  '/:id',
  [
    protect,
    body('name').optional().trim().isLength({ min: 1, max: 200 }).withMessage('Name must be between 1 and 200 characters'),
    body('category')
      .optional()
      .isIn(['Skincare', 'Food & Beverage', 'Personal Care', 'Cleaning Products', 'Clothing', 'Electronics', 'Other'])
      .withMessage('Invalid category'),
    body('brand').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Brand must be between 1 and 100 characters'),
    body('ingredients').optional().isArray({ min: 1 }).withMessage('At least one ingredient is required'),
    body('ingredients.*')
      .optional()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Each ingredient must be between 1 and 100 characters'),
    body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description cannot exceed 1000 characters'),
    body('certifications').optional().isArray().withMessage('Certifications must be an array'),
    body('certifications.*')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Each certification cannot exceed 100 characters'),
    body('packaging').optional().trim().isLength({ max: 200 }).withMessage('Packaging description cannot exceed 200 characters'),
    body('sustainability')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Sustainability description cannot exceed 500 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
        })
        return
      }

      const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      })

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Product not found',
        })
        return
      }

      res.json({
        success: true,
        data: product,
      })
    } catch (error) {
      console.error('Update product error:', error)
      res.status(500).json({
        success: false,
        error: 'Server error updating product',
      })
    }
  }
)

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
router.delete('/:id', protect, async (req: Request, res: Response): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id)

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found',
      })
      return
    }

    res.json({
      success: true,
      message: 'Product deleted successfully',
    })
  } catch (error) {
    console.error('Delete product error:', error)
    res.status(500).json({
      success: false,
      error: 'Server error deleting product',
    })
  }
})

export { router as productRoutes }
