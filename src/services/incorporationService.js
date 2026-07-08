/**
 * Incorporation Service
 * Business logic for managing incorporation orders
 */

const CorpNetClient = require('./corpnetClient');
const IncorporationOrder = require('../models/IncorporationOrder');
const EntityFormation = require('../models/EntityFormation');
const logger = require('../config/logger');

class IncorporationService {
  constructor() {
    this.corpnetClient = new CorpNetClient();
  }

  /**
   * Create a new incorporation order
   * @param {Object} data - Incorporation request data
   * @param {String} userId - User ID from main Flora app
   * @returns {Object} Created order
   */
  async createIncorporation(data, userId) {
    try {
      // Validate input
      this._validateIncorporationData(data);

      // Create order in database first
      const order = new IncorporationOrder({
        orderId: this._generateOrderId(),
        portfolioCompanyId: data.portfolioCompanyId,
        companyName: data.companyName,
        entityType: data.entityType,
        state: data.state || 'DELAWARE',
        founders: data.founders,
        authorizedShares: data.authorizedShares,
        parValue: data.parValue,
        registeredAgent: data.registeredAgent !== false,
        einRequired: data.einRequired !== false,
        status: 'PENDING',
        estimatedCost: this._calculateCost(data),
        createdBy: userId,
        isMockOrder: this.corpnetClient.mockMode,
        steps: [
          { name: 'NAME_RESERVATION', status: 'PENDING' },
          { name: 'STATE_FILING', status: 'PENDING' },
          { name: 'EIN_APPLICATION', status: 'PENDING' },
          { name: 'REGISTERED_AGENT', status: 'PENDING' }
        ]
      });

      await order.save();
      logger.info(`Incorporation order created: ${order.orderId}`);

      // Submit to CorpNet
      try {
        const corpnetResponse = await this.corpnetClient.createCorporation(data);

        // Update order with CorpNet response
        order.corpnetOrderId = corpnetResponse.orderId;
        order.status = 'SUBMITTED';
        order.trackingUrl = corpnetResponse.trackingUrl;
        order.estimatedCompletion = new Date(corpnetResponse.estimatedCompletion);
        order.actualCost = corpnetResponse.cost;

        await order.save();

        logger.info(`Order ${order.orderId} submitted to CorpNet: ${corpnetResponse.orderId}`);

        return {
          orderId: order.orderId,
          corpnetOrderId: corpnetResponse.orderId,
          status: order.status,
          estimatedCompletion: corpnetResponse.estimatedCompletion,
          cost: corpnetResponse.cost,
          trackingUrl: corpnetResponse.trackingUrl,
          companyName: order.companyName,
          entityType: order.entityType,
          isMockOrder: order.isMockOrder
        };
      } catch (error) {
        // CorpNet submission failed
        order.status = 'FAILED';
        order.lastError = error.message;
        await order.save();

        logger.error(`CorpNet submission failed for order ${order.orderId}: ${error.message}`);
        throw error;
      }
    } catch (error) {
      logger.error(`Create incorporation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get order status and update from CorpNet
   * @param {String} orderId - Order ID
   * @returns {Object} Order status
   */
  async getOrderStatus(orderId) {
    try {
      const order = await IncorporationOrder.findOne({ orderId });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      // Fetch latest status from CorpNet if not completed
      if (order.status !== 'COMPLETED' && order.status !== 'FAILED') {
        try {
          const corpnetStatus = await this.corpnetClient.getOrderStatus(order.corpnetOrderId || orderId);

          // Update order in database
          order.status = corpnetStatus.status;
          order.currentStep = corpnetStatus.currentStep;
          order.progress = corpnetStatus.progress;

          // Update steps
          if (corpnetStatus.steps) {
            corpnetStatus.steps.forEach(step => {
              order.updateStep(step.name, step.status, step.notes);
            });
          }

          // Add any new documents
          if (corpnetStatus.documents) {
            corpnetStatus.documents.forEach(doc => {
              const exists = order.documents.some(d => d.type === doc.type);
              if (!exists) {
                order.addDocument(doc);
              }
            });
          }

          // If completed, extract EIN
          if (corpnetStatus.status === 'COMPLETED') {
            order.completedAt = new Date();
            // Extract EIN from documents or metadata if available
            // This would be implemented based on CorpNet's actual response
          }

          await order.save();

          logger.info(`Order ${orderId} status updated: ${order.status}`);
        } catch (error) {
          logger.error(`Failed to fetch CorpNet status for ${orderId}: ${error.message}`);
          // Continue with cached data from database
        }
      }

      return {
        orderId: order.orderId,
        corpnetOrderId: order.corpnetOrderId,
        status: order.status,
        currentStep: order.currentStep,
        progress: order.progress,
        steps: order.steps,
        documents: order.documents,
        companyName: order.companyName,
        entityType: order.entityType,
        estimatedCompletion: order.estimatedCompletion,
        completedAt: order.completedAt,
        cost: order.actualCost || order.estimatedCost,
        paymentStatus: order.paymentStatus,
        trackingUrl: order.trackingUrl,
        isMockOrder: order.isMockOrder,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    } catch (error) {
      logger.error(`Get order status failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all incorporation orders
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination options
   * @returns {Object} List of orders
   */
  async listOrders(filters = {}, pagination = {}) {
    try {
      const { page = 1, limit = 20, sortBy = '-createdAt' } = pagination;
      const skip = (page - 1) * limit;

      const query = {};

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.entityType) {
        query.entityType = filters.entityType;
      }

      if (filters.companyName) {
        query.$text = { $search: filters.companyName };
      }

      if (filters.createdBy) {
        query.createdBy = filters.createdBy;
      }

      const orders = await IncorporationOrder.find(query)
        .sort(sortBy)
        .skip(skip)
        .limit(limit)
        .select('-metadata -__v')
        .lean();

      const total = await IncorporationOrder.countDocuments(query);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error(`List orders failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * File 83(b) election
   * @param {Object} data - 83(b) election data
   * @returns {Object} Filing confirmation
   */
  async file83bElection(data) {
    try {
      const { orderId, founder, sharesPurchased, purchasePrice, fairMarketValue, purchaseDate } = data;

      // Find the order
      const order = await IncorporationOrder.findOne({ orderId });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (order.entityType !== 'C_CORP' && order.entityType !== 'S_CORP') {
        throw new Error('83(b) elections only apply to corporations');
      }

      // Submit to CorpNet
      const filingData = {
        companyId: order.corpnetOrderId || orderId,
        founder,
        sharesPurchased,
        purchasePrice,
        fairMarketValue,
        purchaseDate
      };

      const response = await this.corpnetClient.file83bElection(filingData);

      // Add as a document to the order
      await order.addDocument({
        type: 'OTHER',
        name: `83(b) Election - ${founder.name}`,
        url: response.confirmationUrl,
        category: '83B_ELECTION'
      });

      logger.info(`83(b) election filed for order ${orderId}: ${response.filingId}`);

      return {
        filingId: response.filingId,
        status: response.status,
        deadline: response.deadline,
        confirmationUrl: response.confirmationUrl,
        orderId: order.orderId
      };
    } catch (error) {
      logger.error(`83(b) filing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create entity formation record after completion
   * @param {String} orderId - Incorporation order ID
   * @param {Object} additionalData - Additional entity data
   * @returns {Object} Entity formation record
   */
  async createEntityFormation(orderId, additionalData = {}) {
    try {
      const order = await IncorporationOrder.findOne({ orderId });

      if (!order) {
        throw new Error(`Order not found: ${orderId}`);
      }

      if (order.status !== 'COMPLETED') {
        throw new Error(`Order not completed yet: ${order.status}`);
      }

      // Create entity formation record
      const entity = new EntityFormation({
        incorporationOrderId: order._id,
        legalName: order.companyName,
        entityType: order.entityType,
        state: order.state,
        ein: order.ein || additionalData.ein,
        einIssuedDate: additionalData.einIssuedDate || new Date(),
        incorporationDate: order.completedAt,
        businessAddress: additionalData.businessAddress,
        businessPurpose: additionalData.businessPurpose,
        formationDocuments: order.documents.map(doc => ({
          type: doc.type,
          name: doc.name,
          url: doc.url,
          uploadedAt: doc.uploadedAt
        }))
      });

      // Add stock or membership info
      if (order.entityType === 'C_CORP' || order.entityType === 'S_CORP') {
        entity.stock = {
          authorizedShares: order.authorizedShares,
          parValue: order.parValue,
          issuedShares: additionalData.issuedShares || 0,
          outstandingShares: additionalData.outstandingShares || 0
        };

        // Add founders as officers
        order.founders.forEach(founder => {
          entity.officers.push({
            name: founder.name,
            title: founder.title || 'Director',
            email: founder.email,
            appointedDate: order.completedAt
          });
        });
      } else {
        // LLC
        order.founders.forEach(founder => {
          entity.members.push({
            name: founder.name,
            ownershipPercentage: founder.ownershipPercentage,
            email: founder.email,
            joinedDate: order.completedAt
          });
        });
      }

      await entity.save();

      logger.info(`Entity formation record created for ${entity.legalName}`);

      return entity;
    } catch (error) {
      logger.error(`Create entity formation failed: ${error.message}`);
      throw error;
    }
  }

  // ==================== HELPER METHODS ====================

  _generateOrderId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `FLR-CORP-${timestamp}-${random}`.toUpperCase();
  }

  _validateIncorporationData(data) {
    if (!data.companyName) {
      throw new Error('Company name is required');
    }

    if (!data.entityType || !['C_CORP', 'LLC', 'S_CORP'].includes(data.entityType)) {
      throw new Error('Valid entity type is required (C_CORP, LLC, S_CORP)');
    }

    if (!data.founders || !Array.isArray(data.founders) || data.founders.length === 0) {
      throw new Error('At least one founder is required');
    }

    // Validate founders
    data.founders.forEach((founder, index) => {
      if (!founder.name) {
        throw new Error(`Founder ${index + 1}: Name is required`);
      }
      if (!founder.email) {
        throw new Error(`Founder ${index + 1}: Email is required`);
      }
      if (!founder.ownershipPercentage || founder.ownershipPercentage <= 0) {
        throw new Error(`Founder ${index + 1}: Valid ownership percentage is required`);
      }
    });

    // Validate total ownership = 100%
    const totalOwnership = data.founders.reduce((sum, f) => sum + f.ownershipPercentage, 0);
    if (Math.abs(totalOwnership - 100) > 0.01) {
      throw new Error(`Total ownership must equal 100% (current: ${totalOwnership}%)`);
    }

    // Validate corporation-specific fields
    if (data.entityType === 'C_CORP' || data.entityType === 'S_CORP') {
      if (!data.authorizedShares || data.authorizedShares <= 0) {
        throw new Error('Authorized shares is required for corporations');
      }
      if (data.parValue === undefined || data.parValue < 0) {
        throw new Error('Par value is required for corporations');
      }
    }
  }

  _calculateCost(data) {
    // Base costs (mock pricing)
    const baseCosts = {
      C_CORP: 599.00,
      S_CORP: 599.00,
      LLC: 499.00
    };

    let cost = baseCosts[data.entityType] || 599.00;

    // Add-ons
    if (data.registeredAgent !== false) {
      cost += 99.00; // Annual registered agent fee
    }

    if (data.einRequired !== false) {
      cost += 50.00; // EIN application fee
    }

    return cost;
  }
}

module.exports = IncorporationService;
