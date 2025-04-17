# Simple Sales Management System

This project is a microservices-based sales management system. It consists of the following services:

- **Product Service**: Manages product information.
- **Order Service**: Manages orders.
- **Customer Service**: Manages customer information.
- **Payment Service**: Processes payment transactions.
- **Inventory Service**: Manages product inventory.
- **Shipping Service**: Manages order shipping and tracking.
- **API Gateway**: Routes requests to the appropriate microservice with fault tolerance mechanisms.

## Prerequisites

- Install [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/).
- Ensure ports `3000` through `3006` are available on your machine.

## How to Run

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd sale-app
   ```

2. Build and start the services using Docker Compose:

   ```bash
   docker-compose up --build
   ```

3. Access the services:
   - API Gateway: `http://localhost:3000`
   - Product Service: `http://localhost:3001`
   - Order Service: `http://localhost:3002`
   - Customer Service: `http://localhost:3003`
   - Payment Service: `http://localhost:3004`
   - Inventory Service: `http://localhost:3005`
   - Shipping Service: `http://localhost:3006`

## API Endpoints

### Products

- `POST /products`: Create a new product.
- `GET /products/{id}`: Get product details by ID.
- `PUT /products/{id}`: Update product details by ID.
- `DELETE /products/{id}`: Delete a product by ID.

### Orders

- `POST /orders`: Create a new order.
- `GET /orders/{id}`: Get order details by ID.
- `PUT /orders/{id}`: Update order details by ID.
- `DELETE /orders/{id}`: Delete an order by ID.

### Customers

- `POST /customers`: Create a new customer.
- `GET /customers/{id}`: Get customer details by ID.
- `PUT /customers/{id}`: Update customer details by ID.
- `DELETE /customers/{id}`: Delete a customer by ID.

### Payments

- `POST /payments`: Create a new payment.
- `GET /payments/{id}`: Get payment details by ID.
- `POST /payments/process`: Process a payment.
- `POST /payments/refund/{id}`: Process a refund.
- `GET /payments/order/{orderId}`: Get payments by order ID.

### Inventory

- `GET /inventory/product/{productId}`: Get inventory by product ID.
- `PUT /inventory/product/{productId}`: Update inventory.
- `POST /inventory/reserve`: Reserve inventory for an order.
- `POST /inventory/release`: Release reserved inventory.

### Shipping

- `POST /shipping`: Create a shipping record.
- `GET /shipping/{id}`: Get shipping details by ID.
- `GET /shipping/order/{orderId}`: Get shipping by order ID.
- `PUT /shipping/status/{id}`: Update shipping status.
- `GET /shipping/customer/{customerId}`: Get all shipments for a customer.

## Fault Tolerance Features

The API Gateway implements several fault tolerance mechanisms:

1. **Circuit Breaker**: Prevents calls to services that are likely to fail.
2. **Retry Mechanism**: Automatically retries failed requests.
3. **Rate Limiter**: Limits the number of requests to 5 per minute per IP.
4. **Time Limiter**: Marks responses as "slow" if they take more than 2 seconds.

## Stopping the Services

To stop the services, run:

```bash
docker-compose down
```

## Notes

- All services share the same MongoDB instance.
- The API Gateway routes requests to the appropriate service based on the endpoint.

Let me know if you need further assistance!
