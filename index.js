
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const chatRouter = require("./routes/chat");
const policyRouter = require("./routes/policies");

app.use("/chat", chatRouter);
app.use("/policies", policyRouter);

app.get("/", (req, res) => {
  res.send("✅ 복지콕 백엔드 서버 작동 중");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
