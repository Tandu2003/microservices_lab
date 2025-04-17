const CircuitBreaker = require("opossum");
const axios = require("axios");
const axiosRetry = require("axios-retry");

// Configure axios with retry mechanism
axiosRetry(axios, {
  retries: 3, // Number of retry attempts
  retryDelay: (retryCount) => {
    console.log(`Retry attempt: ${retryCount}`);
    return retryCount * 1000; // Exponential backoff: 1s, 2s, 3s
  },
  retryCondition: (error) => {
    // Retry on network errors and 5xx responses
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response && error.response.status >= 500)
    );
  },
});

// Circuit breaker options
const circuitBreakerOptions = {
  timeout: 2000, // If service doesn't respond within 2 seconds, trigger failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 30000, // After 30 seconds, try again (half-open state)
  rollingCountTimeout: 10000, // Sets the duration of the statistical rolling window
  rollingCountBuckets: 10, // Sets the number of buckets the rolling window is divided into
};

function createCircuitBreaker(serviceName, serviceUrl) {
  const breaker = new CircuitBreaker(async (path, method, body) => {
    const url = `${serviceUrl}${path}`;
    console.log(`[${serviceName}] ${method} request to ${url}`);

    try {
      const response = await axios({
        method: method,
        url: url,
        data: method !== "GET" ? body : undefined,
        timeout: 2000, // 2 second timeout (for time limiter)
      });

      return response.data;
    } catch (error) {
      console.error(`[${serviceName}] Request failed: ${error.message}`);
      throw error;
    }
  }, circuitBreakerOptions);

  // Set up circuit breaker event handlers
  breaker.on("open", () => {
    console.log(`[${serviceName}] CIRCUIT BREAKER OPEN - service is unavailable`);
  });

  breaker.on("halfOpen", () => {
    console.log(`[${serviceName}] CIRCUIT BREAKER HALF-OPEN - trying to recover`);
  });

  breaker.on("close", () => {
    console.log(`[${serviceName}] CIRCUIT BREAKER CLOSED - service is operational`);
  });

  breaker.on("timeout", () => {
    console.log(`[${serviceName}] TIMEOUT - request took too long`);
  });

  breaker.fallback(() => {
    return {
      error: `${serviceName} is currently unavailable. Please try again later.`,
      status: "Service Unavailable",
      timestamp: new Date().toISOString(),
    };
  });

  return breaker;
}

function createServiceHandler(serviceName, serviceUrl) {
  const breaker = createCircuitBreaker(serviceName, serviceUrl);

  return async (req, res, next) => {
    // Measure response time (for Time Limiter)
    const startTime = Date.now();

    try {
      // Call the service through the circuit breaker
      const result = await breaker.fire(
        req.url,
        req.method,
        req.method !== "GET" ? req.body : undefined
      );

      // Calculate response time
      const responseTime = Date.now() - startTime;

      // Add response time header
      res.setHeader("X-Response-Time", `${responseTime}ms`);

      // Check if response is slow (Time Limiter)
      if (responseTime > 2000) {
        console.log(`[${serviceName}] SLOW RESPONSE: ${responseTime}ms`);
        res.setHeader("X-Response-Status", "slow");
      }

      // Send the response
      res.json(result);
    } catch (error) {
      // If the circuit is open, return a custom error
      if (breaker.status === "open") {
        return res.status(503).json({
          error: `${serviceName} is currently unavailable. Circuit is OPEN.`,
          status: "Service Unavailable",
          timestamp: new Date().toISOString(),
        });
      }

      // Handle timeout error
      if (error.code === "ETIMEDOUT" || error.code === "ESOCKETTIMEDOUT") {
        return res.status(504).json({
          error: `${serviceName} request timed out after 2000ms`,
          status: "Gateway Timeout",
          timestamp: new Date().toISOString(),
        });
      }

      // Handle other errors
      const statusCode = error.response?.status || 500;
      res.status(statusCode).json({
        error: error.message || `Error calling ${serviceName}`,
        status: "Error",
        timestamp: new Date().toISOString(),
      });
    }
  };
}

module.exports = {
  createCircuitBreaker,
  createServiceHandler,
};
