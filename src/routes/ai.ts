import express, { Request, Response } from 'express'
import { body, validationResult } from 'express-validator'
import { protect } from '../middleware/auth'
import axios from 'axios'

const router = express.Router()

// @desc    Generate AI questions for product
// @route   POST /api/ai/generate-questions
// @access  Private
router.post(
  '/generate-questions',
  [
    protect,
    body('productData').isObject().withMessage('Product data is required'),
    body('productData.name').notEmpty().withMessage('Product name is required'),
    body('productData.category').notEmpty().withMessage('Product category is required'),
    body('productData.ingredients').isArray({ min: 1 }).withMessage('At least one ingredient is required'),
  ],
  async (req: any, res: Response): Promise<void> => {
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

      const { productData } = req.body

      let aiQuestions
      try {
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/generate-questions`, { productData })
        aiQuestions = aiResponse.data.questions
      } catch (aiError) {
        console.error('AI service error:', aiError)
        aiQuestions = generateFallbackQuestions(productData)
      }

      res.json({ success: true, questions: aiQuestions })
    } catch (error) {
      console.error('Generate questions error:', error)
      res.status(500).json({ success: false, error: 'Server error generating questions' })
    }
  }
)

// @desc    Calculate transparency score
// @route   POST /api/ai/transparency-score
// @access  Private
router.post(
  '/transparency-score',
  [
    protect,
    body('productData').isObject().withMessage('Product data is required'),
    body('answers').isObject().withMessage('Answers are required'),
  ],
  async (req: any, res: Response): Promise<void> => {
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

      const { productData, answers } = req.body

      let scoreData
      try {
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/transparency-score`, { productData, answers })
        scoreData = aiResponse.data
      } catch (aiError) {
        console.error('AI service error:', aiError)
        scoreData = calculateFallbackScore(productData, answers)
      }

      res.json({ success: true, data: scoreData })
    } catch (error) {
      console.error('Calculate score error:', error)
      res.status(500).json({ success: false, error: 'Server error calculating score' })
    }
  }
)

// @desc    Analyze product for report generation
// @route   POST /api/ai/analyze-product
// @access  Private
router.post(
  '/analyze-product',
  [
    protect,
    body('product').isObject().withMessage('Product data is required'),
    body('answers').isObject().withMessage('Answers are required'),
  ],
  async (req: any, res: Response): Promise<void> => {
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

      const { product, answers } = req.body

      let analysis
      try {
        const aiResponse = await axios.post(`${process.env.AI_SERVICE_URL}/api/ai/analyze-product`, { product, answers })
        analysis = aiResponse.data
      } catch (aiError) {
        console.error('AI service error:', aiError)
        analysis = generateFallbackAnalysis(product, answers)
      }

      res.json({ success: true, data: analysis })
    } catch (error) {
      console.error('Analyze product error:', error)
      res.status(500).json({ success: false, error: 'Server error analyzing product' })
    }
  }
)

// --- Helper Functions (unchanged) ---
function generateFallbackQuestions(productData: any) { /* same as before */ }
function calculateFallbackScore(productData: any, answers: any) { /* same as before */ }
function generateFallbackAnalysis(product: any, answers: any) { /* same as before */ }
function generateStrengths(answers: any) { /* same as before */ }
function generateImprovements(answers: any) { /* same as before */ }
function generateRecommendations(answers: any) { /* same as before */ }

export { router as aiRoutes }
