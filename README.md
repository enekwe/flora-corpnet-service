# Flora CorpNet Service

Microservice for handling company incorporation and business formation through CorpNet's Business Formation API.

## Features

- **Company Formation**: Incorporate C-Corps, S-Corps, and LLCs in all 50 states
- **EIN Applications**: Automatic Employer Identification Number (EIN) filing
- **83(b) Elections**: File 83(b) tax elections for founders
- **Registered Agent**: Automatic registered agent services
- **Document Management**: Store and retrieve formation documents
- **Mock Mode**: Full development/testing without API credentials
- **Status Tracking**: Real-time progress tracking for all orders

## Architecture

This is a standalone microservice that:
- Runs independently of the main Flora app
- Communicates via REST API
- Manages its own MongoDB database
- Authenticates requests via JWT tokens from the main app

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
# For development, leave MOCK_MODE=true
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production) | development | No |
| `PORT` | Server port | 3010 | No |
| `MONGODB_URI` | MongoDB connection string | localhost | Yes |
| `JWT_SECRET` | JWT secret (must match main app) | - | Yes |
| `CORPNET_API_KEY` | CorpNet API key | - | No* |
| `CORPNET_API_URL` | CorpNet API base URL | https://api.corpnet.com/v1 | No |
| `MOCK_MODE` | Enable mock mode | true | No |

*Required only when MOCK_MODE=false

### Mock Mode

Mock mode allows full development and testing without CorpNet API credentials:

```bash
# Enable mock mode (default)
MOCK_MODE=true

# Disable mock mode (requires CORPNET_API_KEY)
MOCK_MODE=false
```

In mock mode:
- All API calls return realistic simulated data
- Order status progresses over time
- Documents are mock URLs
- No actual CorpNet API calls are made

## Running Locally

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test
```

## API Endpoints

### Health Check
```http
GET /health
```

Returns service health status and configuration.

### Create Incorporation
```http
POST /api/incorporation/create
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "companyName": "Acme Corp",
  "entityType": "C_CORP",
  "state": "DELAWARE",
  "founders": [
    {
      "name": "John Doe",
      "email": "john@acme.com",
      "address": {
        "street": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102"
      },
      "ownershipPercentage": 50,
      "isOfficer": true,
      "title": "CEO"
    }
  ],
  "authorizedShares": 10000000,
  "parValue": 0.00001,
  "registeredAgent": true,
  "einRequired": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": "FLR-CORP-1234567890-ABC123",
    "corpnetOrderId": "corp_789xyz",
    "status": "SUBMITTED",
    "estimatedCompletion": "2026-08-15T00:00:00.000Z",
    "cost": 599.00,
    "trackingUrl": "https://corpnet-api.flora.passbook.vc/orders/corp_789xyz",
    "companyName": "Acme Corp",
    "entityType": "C_CORP",
    "isMockOrder": true
  }
}
```

### Get Order Status
```http
GET /api/incorporation/status/:orderId
Authorization: Bearer {jwt-token}
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": "FLR-CORP-1234567890-ABC123",
    "status": "IN_PROGRESS",
    "currentStep": "STATE_FILING",
    "progress": 40,
    "steps": [
      {
        "name": "NAME_RESERVATION",
        "status": "COMPLETED",
        "startedAt": "2026-08-01T10:00:00.000Z",
        "completedAt": "2026-08-02T15:30:00.000Z"
      },
      {
        "name": "STATE_FILING",
        "status": "IN_PROGRESS",
        "startedAt": "2026-08-02T15:31:00.000Z"
      },
      {
        "name": "EIN_APPLICATION",
        "status": "PENDING"
      },
      {
        "name": "REGISTERED_AGENT",
        "status": "PENDING"
      }
    ],
    "documents": [
      {
        "type": "CERTIFICATE_OF_INCORPORATION",
        "url": "https://mock-documents.flora.passbook.vc/cert-inc.pdf",
        "receivedAt": "2026-08-05T10:00:00.000Z"
      }
    ],
    "estimatedCompletion": "2026-08-08T00:00:00.000Z"
  }
}
```

### List Orders
```http
GET /api/incorporation/orders?status=IN_PROGRESS&page=1&limit=20
Authorization: Bearer {jwt-token}
```

### File 83(b) Election
```http
POST /api/ein/file-83b
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "orderId": "FLR-CORP-1234567890-ABC123",
  "founder": {
    "name": "John Doe",
    "ssn": "123-45-6789",
    "address": {
      "street": "123 Main St",
      "city": "San Francisco",
      "state": "CA",
      "zip": "94102"
    }
  },
  "sharesPurchased": 5000000,
  "purchasePrice": 0.00001,
  "fairMarketValue": 0.00001,
  "purchaseDate": "2026-08-01"
}
```

## Integration with Main Flora App

### Step 1: Add Environment Variable

In the main Flora app's `.env`:
```bash
CORPNET_SERVICE_URL=http://localhost:3010
# or in production:
# CORPNET_SERVICE_URL=https://corpnet-api.flora.passbook.vc
```

### Step 2: Create Integration Client

Create `/services/integrations/corpnetClient.js` in the main app:

```javascript
import apiClient from '../api/apiClient';

const CORPNET_SERVICE_URL = process.env.CORPNET_SERVICE_URL;

export const corpnetClient = {
  async createIncorporation(data) {
    const response = await apiClient.post(
      `${CORPNET_SERVICE_URL}/api/incorporation/create`,
      data
    );
    return response.data;
  },

  async getOrderStatus(orderId) {
    const response = await apiClient.get(
      `${CORPNET_SERVICE_URL}/api/incorporation/status/${orderId}`
    );
    return response.data;
  },

  async file83b(data) {
    const response = await apiClient.post(
      `${CORPNET_SERVICE_URL}/api/ein/file-83b`,
      data
    );
    return response.data;
  },

  async listOrders(filters) {
    const params = new URLSearchParams(filters);
    const response = await apiClient.get(
      `${CORPNET_SERVICE_URL}/api/incorporation/orders?${params}`
    );
    return response.data;
  }
};
```

### Step 3: Use in Frontend

```typescript
import { corpnetClient } from '@/services/integrations/corpnetClient';
import { useMutation, useQuery } from '@tanstack/react-query';

export function useCreateIncorporation() {
  return useMutation({
    mutationFn: (data) => corpnetClient.createIncorporation(data),
    onSuccess: (response) => {
      console.log('Incorporation created:', response.data.orderId);
    }
  });
}

export function useOrderStatus(orderId) {
  return useQuery({
    queryKey: ['incorporation', 'status', orderId],
    queryFn: () => corpnetClient.getOrderStatus(orderId),
    refetchInterval: 30000 // Refresh every 30 seconds
  });
}
```

## Deployment

### Railway

1. Create new service in Railway:
   ```bash
   railway link
   ```

2. Add environment variables:
   ```bash
   railway variables set MONGODB_URI=<your-mongo-url>
   railway variables set JWT_SECRET=<your-jwt-secret>
   railway variables set MOCK_MODE=true  # or false for production
   railway variables set CORPNET_API_KEY=<your-api-key>  # if MOCK_MODE=false
   ```

3. Deploy:
   ```bash
   railway up
   ```

### Docker

```bash
# Build image
docker build -t flora-corpnet-service .

# Run container
docker run -p 3010:3010 \
  -e MONGODB_URI=mongodb://mongo:27017/flora-corpnet \
  -e JWT_SECRET=your-secret \
  -e MOCK_MODE=true \
  flora-corpnet-service
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Manual Testing with cURL

```bash
# Health check
curl http://localhost:3010/health

# Create incorporation (requires JWT token)
curl -X POST http://localhost:3010/api/incorporation/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test Corp",
    "entityType": "C_CORP",
    "founders": [{
      "name": "John Doe",
      "email": "john@test.com",
      "ownershipPercentage": 100
    }],
    "authorizedShares": 10000000,
    "parValue": 0.00001
  }'

# Get status
curl http://localhost:3010/api/incorporation/status/FLR-CORP-XXX \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Database Models

### IncorporationOrder
Tracks all incorporation orders from submission to completion.

### EntityFormation
Stores complete entity details after successful incorporation.

## Logging

Logs are written to:
- Console (all levels)
- `logs/error.log` (errors only)
- `logs/combined.log` (all logs)

Log format: JSON with timestamps

## Error Handling

All errors return consistent JSON format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

HTTP status codes:
- 200: Success
- 201: Created
- 400: Bad request / validation error
- 401: Unauthorized
- 404: Not found
- 500: Server error

## Security

- JWT authentication for all protected endpoints
- Helmet.js for security headers
- CORS enabled (configure for production)
- Input validation with express-validator
- MongoDB injection prevention via Mongoose

## License

MIT

## Support

For issues or questions, contact: development@flora.passbook.vc
