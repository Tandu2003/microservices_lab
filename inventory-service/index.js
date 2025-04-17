const express = require("express");
const mongoose = require("mongoose");
const inventoryRoutes = require("./routes/inventoryRoutes");

const app = express();
const PORT = 3005;

app.use(express.json());
app.use("/inventory", inventoryRoutes);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Inventory Service connected to MongoDB");
    app.listen(PORT, () => console.log(`Inventory Service running on port ${PORT}`));
  })
  .catch((err) => console.error(err));
