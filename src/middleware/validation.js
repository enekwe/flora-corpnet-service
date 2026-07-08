/**
 * Request Validation Middleware
 */

const { body, validationResult } = require('express-validator');

// Validation rules for incorporation
const validateIncorporation = [
  body('companyName')
    .trim()
    .notEmpty().withMessage('Company name is required')
    .isLength({ min: 2, max: 200 }).withMessage('Company name must be 2-200 characters'),

  body('entityType')
    .notEmpty().withMessage('Entity type is required')
    .isIn(['C_CORP', 'LLC', 'S_CORP']).withMessage('Invalid entity type'),

  body('state')
    .optional()
    .isLength({ min: 2, max: 50 }).withMessage('Invalid state'),

  body('founders')
    .isArray({ min: 1 }).withMessage('At least one founder is required'),

  body('founders.*.name')
    .trim()
    .notEmpty().withMessage('Founder name is required'),

  body('founders.*.email')
    .trim()
    .notEmpty().withMessage('Founder email is required')
    .isEmail().withMessage('Invalid email address'),

  body('founders.*.ownershipPercentage')
    .isFloat({ min: 0.01, max: 100 }).withMessage('Ownership must be between 0.01 and 100'),

  body('authorizedShares')
    .if(body('entityType').isIn(['C_CORP', 'S_CORP']))
    .isInt({ min: 1 }).withMessage('Authorized shares must be at least 1'),

  body('parValue')
    .if(body('entityType').isIn(['C_CORP', 'S_CORP']))
    .isFloat({ min: 0 }).withMessage('Par value must be 0 or greater'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation rules for 83(b) election
const validate83b = [
  body('orderId')
    .trim()
    .notEmpty().withMessage('Order ID is required'),

  body('founder.name')
    .trim()
    .notEmpty().withMessage('Founder name is required'),

  body('founder.ssn')
    .trim()
    .notEmpty().withMessage('SSN is required'),

  body('sharesPurchased')
    .isInt({ min: 1 }).withMessage('Shares purchased must be at least 1'),

  body('purchasePrice')
    .isFloat({ min: 0 }).withMessage('Purchase price must be 0 or greater'),

  body('fairMarketValue')
    .isFloat({ min: 0 }).withMessage('Fair market value must be 0 or greater'),

  body('purchaseDate')
    .isISO8601().withMessage('Invalid purchase date'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];

module.exports = {
  validateIncorporation,
  validate83b
};
