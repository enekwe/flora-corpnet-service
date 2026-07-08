/**
 * Incorporation Order Model
 * Tracks all incorporation orders placed through CorpNet
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const IncorporationOrderSchema = new Schema({
  // Main Flora platform reference
  portfolioCompanyId: {
    type: Schema.Types.ObjectId,
    required: false, // May not exist yet if this is pre-formation
    index: true
  },

  // Order identification
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  corpnetOrderId: {
    type: String, // External CorpNet order ID
    sparse: true,
    index: true
  },

  // Company information
  companyName: {
    type: String,
    required: true,
    index: true
  },

  entityType: {
    type: String,
    enum: ['C_CORP', 'LLC', 'S_CORP'],
    required: true
  },

  state: {
    type: String,
    default: 'DELAWARE'
  },

  // Founders/Members
  founders: [{
    name: { type: String, required: true },
    email: { type: String, required: true },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String
    },
    ownershipPercentage: { type: Number, required: true },
    isOfficer: { type: Boolean, default: false },
    title: String
  }],

  // Corporation-specific fields
  authorizedShares: {
    type: Number,
    default: 10000000
  },

  parValue: {
    type: Number,
    default: 0.00001
  },

  // Services requested
  registeredAgent: {
    type: Boolean,
    default: true
  },

  einRequired: {
    type: Boolean,
    default: true
  },

  ein: {
    type: String,
    sparse: true
  },

  // Order status
  status: {
    type: String,
    enum: ['PENDING', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },

  currentStep: {
    type: String,
    enum: ['NAME_RESERVATION', 'STATE_FILING', 'EIN_APPLICATION', 'REGISTERED_AGENT', 'COMPLETED'],
    default: 'NAME_RESERVATION'
  },

  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // Processing steps
  steps: [{
    name: {
      type: String,
      enum: ['NAME_RESERVATION', 'STATE_FILING', 'EIN_APPLICATION', 'REGISTERED_AGENT']
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED']
    },
    startedAt: Date,
    completedAt: Date,
    notes: String
  }],

  // Documents
  documents: [{
    type: {
      type: String,
      enum: ['CERTIFICATE_OF_INCORPORATION', 'ARTICLES_OF_ORGANIZATION', 'EIN_CONFIRMATION', 'BYLAWS', 'OPERATING_AGREEMENT', 'OTHER']
    },
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now },
    category: String
  }],

  // Cost and payment
  estimatedCost: {
    type: Number,
    required: true
  },

  actualCost: Number,

  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'REFUNDED'],
    default: 'PENDING'
  },

  // Timeline
  estimatedCompletion: Date,

  completedAt: Date,

  // Tracking
  trackingUrl: String,

  // Error handling
  lastError: String,

  retryCount: {
    type: Number,
    default: 0
  },

  // Created by (user from main Flora app)
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Metadata
  metadata: {
    type: Map,
    of: String
  },

  // Mock mode flag
  isMockOrder: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
IncorporationOrderSchema.index({ status: 1, createdAt: -1 });
IncorporationOrderSchema.index({ companyName: 'text' });

// Methods
IncorporationOrderSchema.methods.updateStatus = function(newStatus, currentStep, progress) {
  this.status = newStatus;
  if (currentStep) this.currentStep = currentStep;
  if (progress !== undefined) this.progress = progress;

  if (newStatus === 'COMPLETED') {
    this.completedAt = new Date();
  }

  return this.save();
};

IncorporationOrderSchema.methods.addDocument = function(documentData) {
  this.documents.push({
    ...documentData,
    uploadedAt: new Date()
  });
  return this.save();
};

IncorporationOrderSchema.methods.updateStep = function(stepName, status, notes) {
  const step = this.steps.find(s => s.name === stepName);
  if (step) {
    step.status = status;
    if (status === 'IN_PROGRESS' && !step.startedAt) {
      step.startedAt = new Date();
    }
    if (status === 'COMPLETED' && !step.completedAt) {
      step.completedAt = new Date();
    }
    if (notes) {
      step.notes = notes;
    }
  } else {
    this.steps.push({
      name: stepName,
      status,
      startedAt: status === 'IN_PROGRESS' ? new Date() : undefined,
      completedAt: status === 'COMPLETED' ? new Date() : undefined,
      notes
    });
  }
  return this.save();
};

module.exports = mongoose.model('IncorporationOrder', IncorporationOrderSchema);
