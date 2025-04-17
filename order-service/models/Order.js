const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  customerId: String,
  productId: String,
  quantity: Number,
  totalPrice: Number,
  status: { type: String, default: "Pending" },
});

module.exports = mongoose.model("Order", OrderSchema);
