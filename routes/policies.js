const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

// 2025년 기준 중위소득 (월 단위, 원)
const medianIncome2025 = {
  1: 2392013,
  2: 3932658,
  3: 5025353,
  4: 6097773,
};

// 데이터 파일 경로
const dataPath = path.join(__dirname, "../data/mockPolicies.json");

// 나이 조건 체크
function isAgeMatch(ageRange, userAge) {
  if (!ageRange || !userAge) return true;
  if (typeof ageRange === "string" && ageRange.includes("대학생")) return true;

  const [min, max] = ageRange.split("~").map(Number);
  if (isNaN(min) || isNaN(max)) return true;
  return userAge >= min && userAge <= max;
}

// 소득 조건 체크 (incomeCriteria: 숫자면 퍼센트, 그 외는 무시)
function isIncomeMatch(policy, userIncome, householdSize) {
  if (typeof policy.incomeCriteria !== "number") return true;
  if (!userIncome || !householdSize) return true;

  const median = medianIncome2025[householdSize] || medianIncome2025[1];
  const limit = Math.floor(median * (policy.incomeCriteria / 100));
  return userIncome <= limit;
}
function explainMatch(p, q) {
  const reasons = [];
  let score = 0;
  if (q.region && p.region === q.region) { reasons.push("지역 일치"); score += 2; }
  if (q.userAge && isAgeMatch(p.age, q.userAge)) { reasons.push("나이 충족"); score += 2; }
  if (q.job && Array.isArray(p.job) && p.job.includes(q.job)) { reasons.push("직업 대상"); score += 1; }
  if (q.userIncome && isIncomeMatch(p, q.userIncome, q.household)) {
    reasons.push(
      typeof p.incomeCriteria === "number"
        ? `소득 ≤ 중위소득 ${p.incomeCriteria}%`
        : "소득 기준: 복합/무관"
    );
    score += 1;
  }
  return { reasons, score };
}

router.get("/", (req, res) => {
  try {
    const { age, region, job, income, householdSize, limit } = req.query;
    const userAge = age ? parseInt(age, 10) : null;
    const userIncome = income ? parseInt(income, 10) : null;
    const household = householdSize ? parseInt(householdSize, 10) : 1;

    const policies = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    const enriched = policies
      .filter((p) =>
        (!userAge || isAgeMatch(p.age, userAge)) &&
        (!region || p.region === region) &&
        (!job || (Array.isArray(p.job) && p.job.includes(job))) &&
        (!userIncome || isIncomeMatch(p, userIncome, household))
      )
      .map((p) => {
        const { reasons, score } = explainMatch(p, { region, userAge, job, userIncome, household });
        return { ...p, reasons, score };
      })
      .sort((a, b) => b.score - a.score);

    const lim = limit ? parseInt(limit, 10) : undefined;
    res.json({ source: "mock", count: enriched.length, policies: lim ? enriched.slice(0, lim) : enriched });
  } catch (err) {
    console.error("❌ 정책 필터링 오류:", err);
    res.status(500).json({ error: "정책 데이터를 불러오는 데 실패했습니다." });
  }
});
module.exports = router;
