/**
 * CorpNet API Client
 * Handles all communication with CorpNet's Business Formation API
 * Supports MOCK_MODE for development without API credentials
 */

const axios = require('axios');
const logger = require('../config/logger');

class CorpNetClient {
  constructor() {
    this.mockMode = process.env.MOCK_MODE === 'true';
    this.apiKey = process.env.CORPNET_API_KEY;
    this.baseUrl = process.env.CORPNET_API_URL || 'https://api.corpnet.com/v1';

    if (!this.mockMode && !this.apiKey) {
      logger.warn('CorpNet API key not found. Running in MOCK_MODE.');
      this.mockMode = true;
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info(`CorpNet API Request: ${config.method.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.info(`CorpNet API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`CorpNet API Error: ${error.message}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Create a new corporation or LLC
   * @param {Object} data - Formation data
   * @returns {Object} Order details with ID and status
   */
  async createCorporation(data) {
    if (this.mockMode) {
      return this._mockCreateCorporation(data);
    }

    try {
      const payload = {
        entity_type: data.entityType, // 'C_CORP' or 'LLC'
        state: data.state || 'DELAWARE',
        company_name: data.companyName,
        registered_agent: data.registeredAgent !== false,
        founders: data.founders.map(f => ({
          name: f.name,
          email: f.email,
          address: f.address,
          ownership_percentage: f.ownershipPercentage,
          is_officer: f.isOfficer,
          title: f.title
        })),
        ein_application: data.einRequired !== false
      };

      // Add corporation-specific fields
      if (data.entityType === 'C_CORP') {
        payload.authorized_shares = data.authorizedShares || 10000000;
        payload.par_value = data.parValue || 0.00001;
      }

      const response = await this.client.post('/formations', payload);

      return {
        orderId: response.data.order_id,
        status: response.data.status,
        estimatedCompletion: response.data.estimated_completion,
        cost: response.data.total_cost,
        trackingUrl: response.data.tracking_url
      };
    } catch (error) {
      throw this._handleError(error, 'Corporation creation failed');
    }
  }

  /**
   * Get the status of an incorporation order
   * @param {String} orderId - The order ID
   * @returns {Object} Order status details
   */
  async getOrderStatus(orderId) {
    if (this.mockMode) {
      return this._mockGetOrderStatus(orderId);
    }

    try {
      const response = await this.client.get(`/orders/${orderId}`);

      return {
        orderId: response.data.order_id,
        status: response.data.status,
        currentStep: response.data.current_step,
        progress: response.data.progress_percentage,
        steps: response.data.steps,
        documents: response.data.documents || [],
        estimatedCompletion: response.data.estimated_completion
      };
    } catch (error) {
      throw this._handleError(error, 'Failed to retrieve order status');
    }
  }

  /**
   * File 83(b) tax election
   * @param {Object} data - 83(b) election data
   * @returns {Object} Filing details
   */
  async file83bElection(data) {
    if (this.mockMode) {
      return this._mockFile83b(data);
    }

    try {
      const payload = {
        company_id: data.companyId,
        taxpayer: {
          name: data.founder.name,
          ssn: data.founder.ssn, // Should be encrypted before transmission
          address: data.founder.address
        },
        shares_purchased: data.sharesPurchased,
        purchase_price: data.purchasePrice,
        fair_market_value: data.fairMarketValue,
        purchase_date: data.purchaseDate
      };

      const response = await this.client.post('/tax/83b-election', payload);

      return {
        filingId: response.data.filing_id,
        status: response.data.status,
        deadline: response.data.filing_deadline,
        confirmationUrl: response.data.confirmation_url
      };
    } catch (error) {
      throw this._handleError(error, '83(b) election filing failed');
    }
  }

  /**
   * Reserve a company name
   * @param {Object} data - Name reservation data
   * @returns {Object} Reservation details
   */
  async reserveName(data) {
    if (this.mockMode) {
      return this._mockReserveName(data);
    }

    try {
      const payload = {
        state: data.state,
        company_name: data.companyName,
        entity_type: data.entityType
      };

      const response = await this.client.post('/name-reservation', payload);

      return {
        reservationId: response.data.reservation_id,
        status: response.data.status,
        expiresAt: response.data.expires_at,
        available: response.data.available
      };
    } catch (error) {
      throw this._handleError(error, 'Name reservation failed');
    }
  }

  // ==================== MOCK MODE IMPLEMENTATIONS ====================

  _mockCreateCorporation(data) {
    logger.info('[MOCK MODE] Creating corporation:', data.companyName);

    // Simulate API delay
    return new Promise((resolve) => {
      setTimeout(() => {
        const orderId = `mock_corp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const estimatedDays = 7;
        const estimatedCompletion = new Date();
        estimatedCompletion.setDate(estimatedCompletion.getDate() + estimatedDays);

        resolve({
          orderId,
          status: 'SUBMITTED',
          estimatedCompletion: estimatedCompletion.toISOString(),
          cost: data.entityType === 'C_CORP' ? 599.00 : 499.00,
          trackingUrl: `https://corpnet-api.flora.passbook.vc/orders/${orderId}`
        });
      }, 1000);
    });
  }

  _mockGetOrderStatus(orderId) {
    logger.info('[MOCK MODE] Getting order status:', orderId);

    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate different statuses based on order age
        const isMock = orderId.startsWith('mock_');
        const timestamp = isMock ? parseInt(orderId.split('_')[2]) : Date.now();
        const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);

        let status = 'SUBMITTED';
        let currentStep = 'NAME_RESERVATION';
        let progress = 10;
        let steps = [
          { name: 'NAME_RESERVATION', status: 'IN_PROGRESS', startedAt: new Date(timestamp).toISOString() },
          { name: 'STATE_FILING', status: 'PENDING' },
          { name: 'EIN_APPLICATION', status: 'PENDING' },
          { name: 'REGISTERED_AGENT', status: 'PENDING' }
        ];

        if (ageInDays > 1) {
          status = 'IN_PROGRESS';
          currentStep = 'STATE_FILING';
          progress = 40;
          steps[0].status = 'COMPLETED';
          steps[0].completedAt = new Date(timestamp + 24 * 60 * 60 * 1000).toISOString();
          steps[1].status = 'IN_PROGRESS';
          steps[1].startedAt = new Date(timestamp + 24 * 60 * 60 * 1000).toISOString();
        }

        if (ageInDays > 3) {
          currentStep = 'EIN_APPLICATION';
          progress = 70;
          steps[1].status = 'COMPLETED';
          steps[1].completedAt = new Date(timestamp + 3 * 24 * 60 * 60 * 1000).toISOString();
          steps[2].status = 'IN_PROGRESS';
          steps[2].startedAt = new Date(timestamp + 3 * 24 * 60 * 60 * 1000).toISOString();
        }

        if (ageInDays > 7) {
          status = 'COMPLETED';
          currentStep = 'REGISTERED_AGENT';
          progress = 100;
          steps[2].status = 'COMPLETED';
          steps[2].completedAt = new Date(timestamp + 5 * 24 * 60 * 60 * 1000).toISOString();
          steps[3].status = 'COMPLETED';
          steps[3].completedAt = new Date(timestamp + 7 * 24 * 60 * 60 * 1000).toISOString();
        }

        const documents = [];
        if (progress >= 40) {
          documents.push({
            type: 'CERTIFICATE_OF_INCORPORATION',
            url: 'https://mock-documents.flora.passbook.vc/cert-inc.pdf',
            receivedAt: steps[1].completedAt
          });
        }
        if (progress >= 70) {
          documents.push({
            type: 'EIN_CONFIRMATION',
            url: 'https://mock-documents.flora.passbook.vc/ein-conf.pdf',
            receivedAt: steps[2].completedAt
          });
        }

        resolve({
          orderId,
          status,
          currentStep,
          progress,
          steps,
          documents,
          estimatedCompletion: new Date(timestamp + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
      }, 500);
    });
  }

  _mockFile83b(data) {
    logger.info('[MOCK MODE] Filing 83(b) election for:', data.founder.name);

    return new Promise((resolve) => {
      setTimeout(() => {
        const filingId = `mock_83b_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const deadline = new Date(data.purchaseDate);
        deadline.setDate(deadline.getDate() + 30);

        resolve({
          filingId,
          status: 'SUBMITTED',
          deadline: deadline.toISOString(),
          confirmationUrl: `https://mock-documents.flora.passbook.vc/83b-${filingId}.pdf`
        });
      }, 800);
    });
  }

  _mockReserveName(data) {
    logger.info('[MOCK MODE] Reserving name:', data.companyName);

    return new Promise((resolve) => {
      setTimeout(() => {
        const available = !data.companyName.toLowerCase().includes('unavailable');
        const reservationId = available ? `mock_res_${Date.now()}` : null;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        resolve({
          reservationId,
          status: available ? 'RESERVED' : 'UNAVAILABLE',
          expiresAt: available ? expiresAt.toISOString() : null,
          available
        });
      }, 600);
    });
  }

  // ==================== ERROR HANDLING ====================

  _handleError(error, message) {
    if (error.response) {
      // API returned an error response
      logger.error(`CorpNet API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      return new Error(`${message}: ${error.response.data.message || error.response.statusText}`);
    } else if (error.request) {
      // Request was made but no response received
      logger.error(`CorpNet API Error: No response received`);
      return new Error(`${message}: No response from CorpNet API`);
    } else {
      // Something else happened
      logger.error(`CorpNet API Error: ${error.message}`);
      return new Error(`${message}: ${error.message}`);
    }
  }
}

module.exports = CorpNetClient;
