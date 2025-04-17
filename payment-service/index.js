const express = require("express");
const mongoose = require("mongoose");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();
const PORT = 3004;

app.use(express.json());
app.use("/payments", paymentRoutes);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Payment Service connected to MongoDB");
    app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
  })
  .catch((err) => console.error(err));
