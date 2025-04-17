const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema({
  name: String,
  price: Number,
  description: String,
  inventory: Number,
});

module.exports = mongoose.model("Product", ProductSchema);
