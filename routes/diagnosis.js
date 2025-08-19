const express = require("express");
const router = express.Router();

router.post("/", (req, res) => {
  const { age, income, job } = req.body;

  // 필수 필드 검사
  if (!age || !income || !job) {
    return res.status(400).json({ error: "나이, 소득, 직업은 필수 입력값입니다." });
  }

  // 정상 처리
  res.json({ message: "진단 시작 성공", data: { age, income, job } });
});

module.exports = router;
