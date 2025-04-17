const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const CircuitBreaker = require("opossum");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");

const app = express();
const PORT = 3000;

// Configure circuit breaker options
const circuitBreakerOptions = {
  timeout: 2000, // If service doesn't respond within 2 seconds, trigger failure
  errorThresholdPercentage: 50, // When 50% of requests fail, open the circuit
  resetTimeout: 30000, // After 30 seconds, try again
  rollingCountTimeout: 10000, // Sets the duration of the statistical rolling window
  rollingCountBuckets: 10, // Sets the number of buckets the rolling window is divided into
};

// Rate limiter middleware - 5 requests per minute
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per windowMs
  message: { error: "Too many requests, please try again later." },
});

// Speed limiter middleware - slow down after 3 requests
const speedLimiter = slowDown({
  windowMs: 60 * 1000, // 1 minute
  delayAfter: 3, // allow 3 requests per minute at full speed
  delayMs: 500, // add 500ms of delay to each request after the limit is reached
});

// Create circuit breakers for services
const createBreaker = (serviceName, targetUrl) => {
  const breaker = new CircuitBreaker(() => {
    return new Promise((resolve, reject) => {
      // Here would be the actual service call, but for demo we'll just use a proxy
      resolve();
    });
  }, circuitBreakerOptions);

  // Event handlers
  breaker.on("open", () => console.log(`Circuit breaker for ${serviceName} is now OPEN`));
  breaker.on("close", () => console.log(`Circuit breaker for ${serviceName} is now CLOSED`));
  breaker.on("halfOpen", () => console.log(`Circuit breaker for ${serviceName} is now HALF-OPEN`));
  breaker.on("fallback", () => console.log(`Fallback executed for ${serviceName}`));

  // Create proxy with circuit breaker
  return createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      const startTime = Date.now();

      // Handle response to update circuit breaker
      res.on("finish", () => {
        const responseTime = Date.now() - startTime;

        // If response takes too long or has error status, count as failure
        if (responseTime > 2000 || res.statusCode >= 500) {
          console.log(
            `Request to ${serviceName} ${
              res.statusCode >= 500 ? "failed" : "slow"
            } in ${responseTime}ms`
          );
          breaker.fire().catch(() => {
            // This failure is already handled by the circuit breaker
          });

          // If response is slow but successful
          if (responseTime > 2000 && res.statusCode < 500) {
            res.status(503).json({ error: "Service response too slow", service: serviceName });
          }
        }
      });
    },
  });
};

// Apply rate limiting and speed limiting to all routes
app.use(limiter);
app.use(speedLimiter);

// Setup proxy routes with circuit breakers
app.use("/products", createBreaker("Product Service", "http://product-service:3001"));

app.use("/orders", createBreaker("Order Service", "http://order-service:3002"));

app.use("/customers", createBreaker("Customer Service", "http://customer-service:3003"));

app.use("/payments", createBreaker("Payment Service", "http://payment-service:3004"));

app.use("/inventory", createBreaker("Inventory Service", "http://inventory-service:3005"));

app.use("/shipping", createBreaker("Shipping Service", "http://shipping-service:3006"));

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "UP",
    timestamp: new Date(),
    services: [
      { name: "Product Service", status: "UP" },
      { name: "Order Service", status: "UP" },
      { name: "Customer Service", status: "UP" },
      { name: "Payment Service", status: "UP" },
      { name: "Inventory Service", status: "UP" },
      { name: "Shipping Service", status: "UP" },
    ],
  });
});

app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
