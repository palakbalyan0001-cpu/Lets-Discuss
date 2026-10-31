const mongoose = require("mongoose");
require("dotenv").config();

const connectdb = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_CON);
    console.log("Connected successfully with mongodb");
  } catch (error) {
    console.log("Failed to connect with mongodb", error.message);
    process.exit(1);
  }
};
module.exports = connectdb;
