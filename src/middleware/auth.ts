import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { User, IUser } from '../models/User'

interface AuthRequest extends Request {
  user?: IUser
}

export const protect = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let token: string | undefined

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1]
    }

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Not authorized, no token provided'
      })
      return
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string }
    
    // Get user from token
    const user = await User.findById(decoded.id).select('+password')
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Not authorized, user not found'
      })
      return
    }

    if (!user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Not authorized, account is deactivated'
      })
      return
    }

    req.user = user
    next()
    return
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Not authorized, token failed'
    })
    return
  }
}

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Not authorized'
      })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `User role '${req.user.role}' is not authorized to access this route`
      })
      return
    }

    next()
    return
  }
}
