/**
 * Entity Formation Model
 * Stores complete entity formation details after completion
 */

const mongoose = require('mongoose');
const { Schema } = mongoose;

const EntityFormationSchema = new Schema({
  // Link to incorporation order
  incorporationOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'IncorporationOrder',
    required: true,
    index: true
  },

  // Company details
  legalName: {
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
    required: true
  },

  // Tax identification
  ein: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  einIssuedDate: Date,

  // Incorporation details
  incorporationDate: {
    type: Date,
    required: true
  },

  fileNumber: String, // State filing number

  certificateNumber: String,

  // Registered agent
  registeredAgent: {
    name: String,
    address: {
      street: String,
      city: String,
      state: String,
      zip: String
    },
    contactEmail: String,
    contactPhone: String
  },

  // Stock/Membership details
  stock: {
    authorizedShares: Number,
    parValue: Number,
    issuedShares: Number,
    outstandingShares: Number
  },

  membership: {
    totalUnits: Number,
    issuedUnits: Number
  },

  // Officers (for corporations)
  officers: [{
    name: String,
    title: {
      type: String,
      enum: ['CEO', 'CFO', 'CTO', 'COO', 'President', 'Vice President', 'Secretary', 'Treasurer', 'Director']
    },
    appointedDate: Date,
    email: String
  }],

  // Members (for LLCs)
  members: [{
    name: String,
    ownershipPercentage: Number,
    memberClass: String,
    joinedDate: Date,
    email: String
  }],

  // Formation documents
  formationDocuments: [{
    type: {
      type: String,
      enum: [
        'CERTIFICATE_OF_INCORPORATION',
        'ARTICLES_OF_ORGANIZATION',
        'BYLAWS',
        'OPERATING_AGREEMENT',
        'EIN_CONFIRMATION',
        'STOCK_CERTIFICATES',
        'MEMBERSHIP_CERTIFICATES',
        'INITIAL_RESOLUTIONS',
        'OTHER'
      ],
      required: true
    },
    name: String,
    url: String,
    fileSize: Number,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Business address
  businessAddress: {
    street: { type: String, required: true },
    street2: String,
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, default: 'USA' }
  },

  // Mailing address (if different)
  mailingAddress: {
    street: String,
    street2: String,
    city: String,
    state: String,
    zip: String,
    country: String
  },

  // Business details
  businessPurpose: String,

  fiscalYearEnd: String, // MM-DD format

  naicsCode: String,

  // Compliance tracking
  annualReportDueDate: Date,

  franchiseTaxDueDate: Date,

  dissolutionDate: Date,

  // Status
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'DISSOLVED', 'MERGED', 'CONVERTED'],
    default: 'ACTIVE'
  },

  // Metadata
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Indexes
EntityFormationSchema.index({ legalName: 'text', ein: 'text' });
EntityFormationSchema.index({ status: 1, incorporationDate: -1 });

// Methods
EntityFormationSchema.methods.addOfficer = function(officerData) {
  this.officers.push({
    ...officerData,
    appointedDate: officerData.appointedDate || new Date()
  });
  return this.save();
};

EntityFormationSchema.methods.addMember = function(memberData) {
  this.members.push({
    ...memberData,
    joinedDate: memberData.joinedDate || new Date()
  });
  return this.save();
};

EntityFormationSchema.methods.addDocument = function(documentData) {
  this.formationDocuments.push({
    ...documentData,
    uploadedAt: new Date()
  });
  return this.save();
};

EntityFormationSchema.methods.dissolve = function(dissolutionDate) {
  this.status = 'DISSOLVED';
  this.dissolutionDate = dissolutionDate || new Date();
  return this.save();
};

module.exports = mongoose.model('EntityFormation', EntityFormationSchema);
