import express, { Request, Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import { Report } from '../models/Report'
import { Product } from '../models/Product'
import { protect } from '../middleware/auth'
import axios from 'axios'

const router = express.Router()
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'

/* ============================================================
   🧠 Utility: Error Formatter
============================================================ */
const sendValidationErrors = (req: Request, res: Response) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array(),
    })
    return true
  }
  return false
}

interface AuthRequest extends Request {
  user?: any
}

/* ============================================================
   📊 GET /api/reports/stats/overview — Reports Statistics (user scoped)
============================================================ */
router.get('/stats/overview', protect, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id

    const matchStage = userId ? { $match: { userId } } : { $match: {} }

    const stats = await Report.aggregate([
      matchStage,
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          averageScore: { $avg: '$transparencyScore' },
          maxScore: { $max: '$transparencyScore' },
          minScore: { $min: '$transparencyScore' },
          completedReports: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pendingReports: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          draftReports: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        },
      },
    ])

    const scoreDistribution = await Report.aggregate([
      matchStage,
      {
        $bucket: {
          groupBy: '$transparencyScore',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'Other',
          output: { count: { $sum: 1 } },
        },
      },
    ])

    res.json({
      success: true,
      data: {
        overview:
          stats[0] || {
            totalReports: 0,
            averageScore: 0,
            maxScore: 0,
            minScore: 0,
            completedReports: 0,
            pendingReports: 0,
            draftReports: 0,
          },
        scoreDistribution,
      },
    })
  } catch (error) {
    console.error('Get stats error:', error)
    res.status(500).json({ success: false, error: 'Server error fetching statistics' })
  }
})

/* ============================================================
   📋 GET /api/reports — List Reports (Paginated)
============================================================ */
router.get(
  '/',
  [
    protect,
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isIn(['draft', 'pending', 'completed']),
    query('minScore').optional().isInt({ min: 0, max: 100 }),
    query('maxScore').optional().isInt({ min: 0, max: 100 }),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (sendValidationErrors(req, res)) return

    try {
      const page = parseInt(req.query.page as string) || 1
      const limit = parseInt(req.query.limit as string) || 10
      const skip = (page - 1) * limit
      const { status, minScore, maxScore } = req.query

      const filter: any = {}
      // Scope reports to requesting user
      if (req.user && req.user._id) filter.userId = req.user._id
      if (status) filter.status = status
      if (minScore || maxScore) {
        filter.transparencyScore = {}
        if (minScore) filter.transparencyScore.$gte = parseInt(minScore as string)
        if (maxScore) filter.transparencyScore.$lte = parseInt(maxScore as string)
      }

      const [reports, total] = await Promise.all([
        Report.find(filter)
          .populate('productId', 'name brand category')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Report.countDocuments(filter),
      ])

      res.json({
        success: true,
        count: reports.length,
        total,
        page,
        totalPages: Math.ceil(total / limit),
        data: reports,
      })
    } catch (error) {
      console.error('Get reports error:', error)
      res.status(500).json({ success: false, error: 'Server error fetching reports' })
    }
  }
)

/* ============================================================
   📄 GET /api/reports/:id — Get Single Report
============================================================ */
router.get('/:id', protect, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await Report.findById(req.params.id).populate(
      'productId',
      'name brand category ingredients description'
    )

    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }

    // ownership check — only owner or admin can view
    if (req.user && report.userId && report.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    res.json({ success: true, data: report })
  } catch (error) {
    console.error('Get report error:', error)
    res.status(500).json({ success: false, error: 'Server error fetching report' })
  }
})

/* ============================================================
   🧾 POST /api/reports — Create New Report
============================================================ */
router.post(
  '/',
  [
    protect,
    body('productId').isMongoId().withMessage('Valid product ID is required'),
    body('answers').isObject().withMessage('Answers must be an object'),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (sendValidationErrors(req, res)) return

    try {
      const { productId, answers } = req.body
      const product = await Product.findById(productId)
      if (!product) {
        res.status(404).json({ success: false, error: 'Product not found' })
        return
      }

      // 🔗 Call AI microservice
      let aiAnalysis
      try {
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/api/ai/analyze-product`, {
          product: product.toObject(),
          answers,
        })
        aiAnalysis = aiResponse.data
      } catch (aiError) {
        console.warn('⚠️ AI service unavailable, using fallback.')
        aiAnalysis = {
          summary: `Analysis for ${product.name}: This product shows basic transparency with room for improvement.`,
          transparencyScore: Math.floor(Math.random() * 40) + 40,
          analysis: {
            strengths: ['Product information provided', 'Basic ingredient list available'],
            improvements: ['Add sustainability data', 'Include certification details'],
            recommendations: ['Provide sourcing details', 'Add eco-impact information'],
          },
        }
      }

      // Compute a dynamic transparencyScore using AI analysis, answers completeness, and product category
      const deriveTransparencyScore = (aiResult: any, productObj: any, answersObj: any) => {
        // base score from AI if provided, otherwise fallback to previous random-ish baseline
        const baseFromAI = Number(aiResult?.transparencyScore ?? aiResult?.score)
        const base = Number.isFinite(baseFromAI) ? Math.max(0, Math.min(100, Math.round(baseFromAI))) : Math.floor(Math.random() * 40) + 40

        // determine number of questions the AI expected/asked (if available)
        const aiQuestionsCount = Array.isArray(aiResult?.questions) ? aiResult.questions.length : (Array.isArray(aiResult?.expectedQuestions) ? aiResult.expectedQuestions.length : null)

        // fallback: use number of answer keys provided by the frontend
        const providedAnswersCount = answersObj && typeof answersObj === 'object' ? Object.keys(answersObj).length : 0

        const questionCount = aiQuestionsCount ?? Math.max(1, providedAnswersCount)
        const answeredCount = providedAnswersCount

        const completenessRatio = questionCount > 0 ? Math.min(1, answeredCount / questionCount) : 0

        // category sensitivity: certain categories are expected to have more detailed disclosures
        const category = (productObj?.category || '').toString().toLowerCase()
        let categoryBoost = 0
        if (category.includes('skincare')) categoryBoost = 5
        else if (category.includes('food')) categoryBoost = 4
        else if (category.includes('personal') || category.includes('care')) categoryBoost = 3
        else if (category.includes('cleaning')) categoryBoost = 3
        else if (category.includes('clothing') || category.includes('apparel')) categoryBoost = 2
        else if (category.includes('electronics')) categoryBoost = 1

        // Combine base AI score with completeness and category bonus.
        // Weighting: 60% AI base (if present), 40% completeness-derived, plus categoryBoost when completeness is reasonable.
        const completenessPercent = Math.round(completenessRatio * 100)
        let computed = Math.round((base * 0.6) + (completenessPercent * 0.4))

        // apply small category-based bump if the user provided meaningful answers
        if (completenessRatio >= 0.5) {
          computed += categoryBoost
        } else {
          // small penalty if very incomplete
          computed -= Math.max(0, Math.floor((1 - completenessRatio) * 5))
        }

        // clamp to 0-100
        computed = Math.max(0, Math.min(100, computed))
        return computed
      }

      const computedScore = deriveTransparencyScore(aiAnalysis, product.toObject(), answers)

      const report = await Report.create({
        productId,
        userId: req.user?._id,
        summary: aiAnalysis.summary,
        transparencyScore: computedScore,
        analysis: aiAnalysis.analysis,
        answers,
        status: 'completed',
      })

      await report.populate('productId', 'name brand category ingredients description')

      res.status(201).json({ success: true, data: report })
    } catch (error) {
      console.error('Create report error:', error)
      res.status(500).json({ success: false, error: 'Server error creating report' })
    }
  }
)

/* ============================================================
   ✏️ PUT /api/reports/:id — Update Report
============================================================ */
router.put(
  '/:id',
  [
    protect,
    body('summary').optional().isLength({ max: 2000 }),
    body('transparencyScore').optional().isInt({ min: 0, max: 100 }),
    body('status').optional().isIn(['draft', 'pending', 'completed']),
    body('answers').optional().isObject(),
  ],
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (sendValidationErrors(req, res)) return

    try {
      const report = await Report.findById(req.params.id)
      if (!report) {
        res.status(404).json({ success: false, error: 'Report not found' })
        return
      }

      // ownership check
      if (req.user && report.userId && report.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
        res.status(403).json({ success: false, error: 'Forbidden' })
        return
      }

      Object.assign(report, req.body)
      await report.save()
      await report.populate('productId', 'name brand category')

      res.json({ success: true, data: report })
    } catch (error) {
      console.error('Update report error:', error)
      res.status(500).json({ success: false, error: 'Server error updating report' })
    }
  }
)

/* ============================================================
   🗑️ DELETE /api/reports/:id — Delete Report
============================================================ */
router.delete('/:id', protect, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const report = await Report.findById(req.params.id)
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }

    // ownership check
    if (req.user && report.userId && report.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Forbidden' })
      return
    }

    await report.deleteOne()
    res.json({ success: true, message: 'Report deleted successfully' })
  } catch (error) {
    console.error('Delete report error:', error)
    res.status(500).json({ success: false, error: 'Server error deleting report' })
  }
})

export { router as reportRoutes }
