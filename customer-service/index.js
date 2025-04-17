const express = require("express");
const mongoose = require("mongoose");
const customerRoutes = require("./routes/customerRoutes");

const app = express();
const PORT = 3003;

app.use(express.json());
app.use("/customers", customerRoutes);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Customer Service connected to MongoDB");
    app.listen(PORT, () => console.log(`Customer Service running on port ${PORT}`));
  })
  .catch((err) => console.error(err));
