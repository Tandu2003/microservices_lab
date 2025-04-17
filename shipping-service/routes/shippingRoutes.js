const express = require("express");
const Shipping = require("../models/Shipping");

const router = express.Router();

// Create shipping record
router.post("/", async (req, res) => {
  try {
    const shipping = new Shipping(req.body);

    // Generate random tracking number
    shipping.trackingNumber = "TRK" + Date.now() + Math.floor(Math.random() * 1000);

    // Set estimated delivery date (example: 7 days from now)
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7);
    shipping.estimatedDelivery = deliveryDate;

    await shipping.save();
    res.status(201).json(shipping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shipping by ID
router.get("/:id", async (req, res) => {
  try {
    const shipping = await Shipping.findById(req.params.id);
    if (!shipping) return res.status(404).json({ error: "Shipping record not found" });
    res.json(shipping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shipping by order ID
router.get("/order/:orderId", async (req, res) => {
  try {
    const shipping = await Shipping.findOne({ orderId: req.params.orderId });
    if (!shipping) return res.status(404).json({ error: "Shipping record not found" });
    res.json(shipping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update shipping status
router.put("/status/:id", async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const validStatuses = ["Preparing", "Shipped", "In Transit", "Delivered", "Failed"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid status",
        validStatuses,
      });
    }

    const shipping = await Shipping.findById(req.params.id);
    if (!shipping) return res.status(404).json({ error: "Shipping record not found" });

    shipping.status = status;
    shipping.updatedAt = Date.now();
    await shipping.save();

    res.json({
      success: true,
      message: `Shipping status updated to ${status}`,
      shipping,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all shipments for a customer
router.get("/customer/:customerId", async (req, res) => {
  try {
    const shipments = await Shipping.find({ customerId: req.params.customerId });
    res.json(shipments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
