/**
 * API request and response type definitions for the Identity Reconciliation system
 */

/**
 * Request payload for the /identify endpoint
 */
export interface IdentifyRequest {
  email?: string;
  phoneNumber?: string;
}

/**
 * Response structure for the /identify endpoint
 */
export interface IdentifyResponse {
  contact: {
    primaryContactId: number;
    emails: string[];
    phoneNumbers: string[];
    secondaryContactIds: number[];
  };
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  path: string;
  correlationId?: string;
}

/**
 * Health check response structure
 */
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version?: string;
  database?: {
    status: 'healthy' | 'unhealthy';
    connected: boolean;
    message: string;
  };
}
