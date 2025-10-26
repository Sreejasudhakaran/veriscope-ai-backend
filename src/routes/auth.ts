import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { body, validationResult } from 'express-validator'
import { User } from '../models/User'
import { protect } from '../middleware/auth'

const router = express.Router()

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('company').optional().trim().isLength({ max: 200 }).withMessage('Company name cannot exceed 200 characters')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { name, email, password, company } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      })
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      company
    })

    // Generate JWT token
    // ensure JWT_SECRET is present
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set')
      return res.status(500).json({ success: false, error: 'Server misconfiguration' })
    }
    const signOptions: any = { expiresIn: process.env.JWT_EXPIRE || '7d' }
    const token = jwt.sign({ id: user._id }, jwtSecret, signOptions)

    return res.status(201).json({
      success: true,
      token,
      // user.profile is a mongoose virtual — cast to any for now
      user: (user as any).profile
    })
  } catch (error) {
    console.error('Registration error:', error)
    return res.status(500).json({
      success: false,
      error: 'Server error during registration'
    })
  }
})

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req: Request, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { email, password } = req.body

    // Check for user and include password
    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      })
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      })
    }

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET is not set')
      return res.status(500).json({ success: false, error: 'Server misconfiguration' })
    }
    const signOptions: any = { expiresIn: process.env.JWT_EXPIRE || '7d' }
    const token = jwt.sign({ id: user._id }, jwtSecret, signOptions)

    return res.json({
      success: true,
      token,
      user: (user as any).profile
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      error: 'Server error during login'
    })
  }
})

// @desc    Get current user
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req: any, res: Response) => {
  try {
    const user = await User.findById(req.user._id)
    return res.json({
      success: true,
      user: (user as any)?.profile
    })
  } catch (error) {
    console.error('Profile error:', error)
    return res.status(500).json({
      success: false,
      error: 'Server error fetching profile'
    })
  }
})

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
router.put('/profile', [
  protect,
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
  body('company').optional().trim().isLength({ max: 200 }).withMessage('Company name cannot exceed 200 characters')
], async (req: any, res: Response) => {
  try {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      })
    }

    const { name, company } = req.body
    const updateData: any = {}
    
    if (name) updateData.name = name
    if (company) updateData.company = company

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    )

    return res.json({
      success: true,
      user: (user as any)?.profile
    })
  } catch (error) {
    console.error('Profile update error:', error)
    return res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    })
  }
})

export { router as authRoutes }
