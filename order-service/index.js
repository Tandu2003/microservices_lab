const express = require("express");
const mongoose = require("mongoose");
const orderRoutes = require("./routes/orderRoutes");

const app = express();
const PORT = 3002;

app.use(express.json());
app.use("/orders", orderRoutes);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Order Service connected to MongoDB");
    app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
  })
  .catch((err) => console.error(err));
