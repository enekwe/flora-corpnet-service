/**
 * Incorporation Controller
 * Handles HTTP requests for incorporation operations
 */

const IncorporationService = require('../services/incorporationService');
const logger = require('../config/logger');

const incorporationService = new IncorporationService();

class IncorporationController {
  /**
   * POST /api/incorporation/create
   * Create new incorporation order
   */
  async createIncorporation(req, res) {
    try {
      const userId = req.user?.id; // From JWT auth middleware
      const data = req.body;

      logger.info(`Creating incorporation for: ${data.companyName}`);

      const result = await incorporationService.createIncorporation(data, userId);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Create incorporation error: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/incorporation/status/:orderId
   * Get incorporation order status
   */
  async getOrderStatus(req, res) {
    try {
      const { orderId } = req.params;

      logger.info(`Getting status for order: ${orderId}`);

      const status = await incorporationService.getOrderStatus(orderId);

      res.status(200).json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error(`Get order status error: ${error.message}`);
      const statusCode = error.message.includes('not found') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /api/incorporation/orders
   * List incorporation orders
   */
  async listOrders(req, res) {
    try {
      const { status, entityType, companyName, page, limit, sortBy } = req.query;
      const userId = req.user?.id;

      const filters = {};
      if (status) filters.status = status;
      if (entityType) filters.entityType = entityType;
      if (companyName) filters.companyName = companyName;
      if (userId && !req.user?.isAdmin) filters.createdBy = userId;

      const pagination = { page: parseInt(page) || 1, limit: parseInt(limit) || 20, sortBy };

      const result = await incorporationService.listOrders(filters, pagination);

      res.status(200).json({
        success: true,
        data: result.orders,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error(`List orders error: ${error.message}`);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/ein/file-83b
   * File 83(b) election
   */
  async file83bElection(req, res) {
    try {
      const data = req.body;

      logger.info(`Filing 83(b) for order: ${data.orderId}`);

      const result = await incorporationService.file83bElection(data);

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`File 83(b) error: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * POST /api/incorporation/:orderId/entity
   * Create entity formation record
   */
  async createEntityFormation(req, res) {
    try {
      const { orderId } = req.params;
      const additionalData = req.body;

      logger.info(`Creating entity formation for order: ${orderId}`);

      const entity = await incorporationService.createEntityFormation(orderId, additionalData);

      res.status(201).json({
        success: true,
        data: entity
      });
    } catch (error) {
      logger.error(`Create entity formation error: ${error.message}`);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * GET /health
   * Health check endpoint
   */
  async healthCheck(req, res) {
    res.status(200).json({
      success: true,
      service: 'flora-corpnet-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mockMode: process.env.MOCK_MODE === 'true'
    });
  }
}

module.exports = new IncorporationController();
