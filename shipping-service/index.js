const express = require("express");
const mongoose = require("mongoose");
const shippingRoutes = require("./routes/shippingRoutes");

const app = express();
const PORT = 3006;

app.use(express.json());
app.use("/shipping", shippingRoutes);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Shipping Service connected to MongoDB");
    app.listen(PORT, () => console.log(`Shipping Service running on port ${PORT}`));
  })
  .catch((err) => console.error(err));
