const mongoose = require("mongoose");

const ShippingSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  customerId: { type: String, required: true },
  address: { type: String, required: true },
  status: {
    type: String,
    enum: ["Preparing", "Shipped", "In Transit", "Delivered", "Failed"],
    default: "Preparing",
  },
  trackingNumber: { type: String },
  carrier: { type: String },
  estimatedDelivery: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Shipping", ShippingSchema);
