const express = require("express");
const Payment = require("../models/Payment");

const router = express.Router();

// Create new payment
router.post("/", async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.status(201).json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payment by ID
router.get("/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process payment
router.post("/process", async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;

    if (!orderId) return res.status(400).json({ error: "Order ID is required" });

    // In a real system, this would integrate with payment gateways
    // For demo purposes, we'll simulate payment processing
    const payment = await Payment.findOne({ orderId });

    if (!payment) return res.status(404).json({ error: "Payment not found" });

    // Simulate payment processing
    payment.status = "Completed";
    payment.updatedAt = Date.now();
    payment.transactionId = "TX" + Date.now();
    await payment.save();

    res.json({
      success: true,
      message: "Payment processed successfully",
      payment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process refund
router.post("/refund/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    if (payment.status !== "Completed") {
      return res.status(400).json({ error: "Only completed payments can be refunded" });
    }

    // Simulate refund processing
    payment.status = "Refunded";
    payment.updatedAt = Date.now();
    await payment.save();

    res.json({
      success: true,
      message: "Payment refunded successfully",
      payment,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get payments by order ID
router.get("/order/:orderId", async (req, res) => {
  try {
    const payments = await Payment.find({ orderId: req.params.orderId });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
