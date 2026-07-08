/**
 * API Routes
 */

const express = require('express');
const incorporationController = require('../controllers/incorporationController');
const auth = require('../middleware/auth');
const { validateIncorporation, validate83b } = require('../middleware/validation');

const router = express.Router();

// Health check (public)
router.get('/health', incorporationController.healthCheck);

// Incorporation routes (protected)
router.post(
  '/api/incorporation/create',
  auth,
  validateIncorporation,
  incorporationController.createIncorporation
);

router.get(
  '/api/incorporation/status/:orderId',
  auth,
  incorporationController.getOrderStatus
);

router.get(
  '/api/incorporation/orders',
  auth,
  incorporationController.listOrders
);

router.post(
  '/api/incorporation/:orderId/entity',
  auth,
  incorporationController.createEntityFormation
);

// EIN and tax routes (protected)
router.post(
  '/api/ein/file-83b',
  auth,
  validate83b,
  incorporationController.file83bElection
);

module.exports = router;
