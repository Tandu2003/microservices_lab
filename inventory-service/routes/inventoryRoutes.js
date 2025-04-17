const express = require("express");
const Inventory = require("../models/Inventory");

const router = express.Router();

// Get inventory by product ID
router.get("/product/:productId", async (req, res) => {
  try {
    const inventory = await Inventory.findOne({ productId: req.params.productId });
    if (!inventory) return res.status(404).json({ error: "Inventory not found" });
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update inventory
router.put("/product/:productId", async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: "Quantity is required" });
    }

    const inventory = await Inventory.findOneAndUpdate(
      { productId: req.params.productId },
      { quantity, lastUpdated: Date.now() },
      { new: true, upsert: true }
    );

    res.json(inventory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reserve inventory for an order
router.post("/reserve", async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: "Product ID and quantity are required" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ error: "Inventory not found" });
    }

    if (inventory.quantity < quantity) {
      return res.status(400).json({
        error: "Insufficient inventory",
        available: inventory.quantity,
      });
    }

    // Reserve the requested quantity
    inventory.quantity -= quantity;
    inventory.reserved += quantity;
    inventory.lastUpdated = Date.now();
    await inventory.save();

    res.json({
      success: true,
      message: `${quantity} units reserved successfully`,
      inventory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Release reserved inventory (e.g., failed order)
router.post("/release", async (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || quantity === undefined) {
      return res.status(400).json({ error: "Product ID and quantity are required" });
    }

    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      return res.status(404).json({ error: "Inventory not found" });
    }

    if (inventory.reserved < quantity) {
      return res.status(400).json({
        error: "Cannot release more than reserved amount",
        reserved: inventory.reserved,
      });
    }

    // Release the reserved quantity
    inventory.quantity += quantity;
    inventory.reserved -= quantity;
    inventory.lastUpdated = Date.now();
    await inventory.save();

    res.json({
      success: true,
      message: `${quantity} units released successfully`,
      inventory,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
