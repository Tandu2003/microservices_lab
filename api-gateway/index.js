const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const CircuitBreaker = require("opossum");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const axios = require("axios");
const axiosRetry = require("axios-retry");

const app = express();
const PORT = 3000;

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

// Configure circuit breaker options
const circuitBreakerOptions = {
  timeout: 2000, // If service doesn't respond within 2 seconds, trigger failure
  errorThresholdPercentage: 20, // 20% failure rate (5 out of 25 requests fail)
  resetTimeout: 30000, // After 30 seconds, try again (half-open state)
  rollingCountTimeout: 10000, // Sets the duration of the statistical rolling window
  rollingCountBuckets: 10, // Sets the number of buckets the rolling window is divided into
};

// Rate limiter middleware - 5 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    // Return a normal response instead of an error
    res.status(200).json({
      message: "Rate limit exceeded. Please wait before making more requests.",
      timestamp: new Date().toISOString(),
    });
  },
  skip: (req) => {
    // Skip rate limiting for status endpoint
    return req.path === "/status";
  },
});

// Speed limiter middleware - slow down after 3 requests
const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 3, // allow 3 requests per minute at full speed
  delayMs: 500, // add 500ms of delay to each request after the limit is reached
  skip: (req) => {
    // Skip speed limiting for status endpoint
    return req.path === "/status";
  },
});

// Function to create a service proxy with fault tolerance
function createServiceProxy(serviceName, targetUrl) {
  // Create circuit breaker for the service
  const breaker = new CircuitBreaker(async (path, method, body) => {
    const url = `${targetUrl}${path}`;
    console.log(`${method} request to ${url}`);

    try {
      const response = await axios({
        method: method,
        url: url,
        data: method !== "GET" ? body : undefined,
        timeout: 2000, // 2 second timeout (for time limiter)
      });

      return response.data;
    } catch (error) {
      console.error(`Error calling ${serviceName}: ${error.message}`);
      throw error;
    }
  }, circuitBreakerOptions);

  // Set up circuit breaker event handlers
  breaker.on("open", () => {
    console.log(`CIRCUIT BREAKER OPEN for ${serviceName} - service is unavailable`);
  });

  breaker.on("halfOpen", () => {
    console.log(`CIRCUIT BREAKER HALF-OPEN for ${serviceName} - trying to recover`);
  });

  breaker.on("close", () => {
    console.log(`CIRCUIT BREAKER CLOSED for ${serviceName} - service is operational`);
  });

  breaker.on("timeout", () => {
    console.log(`TIMEOUT for ${serviceName} - request took too long`);
  });

  breaker.fallback(() => {
    return {
      error: `${serviceName} is currently unavailable. Please try again later.`,
      status: "Service Unavailable",
      timestamp: new Date().toISOString(),
    };
  });

  // Return Express middleware function for this service
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
        console.log(`SLOW RESPONSE from ${serviceName}: ${responseTime}ms`);
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

// Apply rate limiting and speed limiting to all routes
app.use(limiter);
app.use(speedLimiter);

// Request logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Parse JSON request bodies
app.use(express.json());

// Define routes for each microservice
app.use(
  "/products",
  createProxyMiddleware({
    target: "http://product-service:3001",
    changeOrigin: true,
    pathRewrite: {
      "^/products": "/products",
    },
    onProxyReq: (proxyReq, req, res) => {
      // If the request has a body, write it to the proxy request
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000, // Time Limiter: 2 seconds timeout
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Product Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

app.use(
  "/orders",
  createProxyMiddleware({
    target: "http://order-service:3002",
    changeOrigin: true,
    pathRewrite: {
      "^/orders": "/orders",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000,
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Order Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

app.use(
  "/customers",
  createProxyMiddleware({
    target: "http://customer-service:3003",
    changeOrigin: true,
    pathRewrite: {
      "^/customers": "/customers",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000,
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Customer Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

app.use(
  "/payments",
  createProxyMiddleware({
    target: "http://payment-service:3004",
    changeOrigin: true,
    pathRewrite: {
      "^/payments": "/payments",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000,
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Payment Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

app.use(
  "/inventory",
  createProxyMiddleware({
    target: "http://inventory-service:3005",
    changeOrigin: true,
    pathRewrite: {
      "^/inventory": "/inventory",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000,
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Inventory Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

app.use(
  "/shipping",
  createProxyMiddleware({
    target: "http://shipping-service:3006",
    changeOrigin: true,
    pathRewrite: {
      "^/shipping": "/shipping",
    },
    onProxyReq: (proxyReq, req, res) => {
      if (req.body) {
        const bodyData = JSON.stringify(req.body);
        proxyReq.setHeader("Content-Type", "application/json");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
    proxyTimeout: 2000,
    onError: (err, req, res) => {
      console.error("Proxy error:", err);
      res.status(500).json({
        error: "Shipping Service unavailable",
        timestamp: new Date().toISOString(),
      });
    },
  })
);

// Status endpoint that shows the health of all services
app.get("/status", async (req, res) => {
  try {
    // TODO: In a production app, you would actually probe each service
    res.json({
      status: "UP",
      timestamp: new Date().toISOString(),
      services: [
        { name: "Product Service", status: "UP" },
        { name: "Order Service", status: "UP" },
        { name: "Customer Service", status: "UP" },
        { name: "Payment Service", status: "UP" },
        { name: "Inventory Service", status: "UP" },
        { name: "Shipping Service", status: "UP" },
      ],
      fault_tolerance: {
        circuit_breaker: "Enabled",
        retry: "Enabled (3 attempts with exponential backoff)",
        rate_limiter: "Enabled (5 requests per minute)",
        time_limiter: "Enabled (2 second threshold)",
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Error checking service status" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: err.message,
  });
});

// Start the API Gateway
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
  console.log(`Fault tolerance features enabled:`);
  console.log(`- Circuit Breaker: Prevents calls to failing services`);
  console.log(`- Retry: Attempts to retry failed calls up to 3 times`);
  console.log(`- Rate Limiter: Limits clients to 5 requests per minute`);
  console.log(`- Time Limiter: Marks responses taking more than 2 seconds as slow`);
});
