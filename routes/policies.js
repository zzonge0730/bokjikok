// routes/policies.js
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

// 지역 조건 체크
function isRegionMatch(policyRegion, userRegion) {
  if (!policyRegion || !userRegion) return true;

  // 전국은 항상 포함
  if (policyRegion === "전국") return true;

  // 사용자 지역에서 광역시/도 단위만 추출
  const wideRegion = userRegion.replace(
    /특별시|광역시|특별자치시|특별자치도|시|군|구/g,
    ""
  );

  // 정책 region이 사용자 전체 지역에 포함되거나 wideRegion에 포함되면 매칭
  return (
    userRegion.includes(policyRegion) ||
    wideRegion.includes(policyRegion) ||
    policyRegion.includes(wideRegion)
  );
}

// 직업 매핑 (프론트 → 정책 JSON)
const jobMap = {
  student: "학생",
  employee: "근로자",
  unemployed: "무직",
  freelancer: "프리랜서",
  business: "사업자",
  etc: "기타",
};

function explainMatch(p, q) {
  const reasons = [];
  let score = 0;

  if (q.region && isRegionMatch(p.region, q.region)) {
    reasons.push("지역 일치");
    score += 2;
  }
  if (q.userAge && isAgeMatch(p.age, q.userAge)) {
    reasons.push("나이 충족");
    score += 2;
  }
  if (q.job && Array.isArray(p.job) && p.job.includes(q.job)) {
    reasons.push("직업 대상");
    score += 1;
  }
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

    // 직업 매핑 (영어 → 한글)
    const mappedJob = job ? jobMap[job] || job : null;

    const policies = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

    const enriched = policies
      .filter(
        (p) =>
          (!userAge || isAgeMatch(p.age, userAge)) &&
          (!region || isRegionMatch(p.region, region)) &&
          (!mappedJob || (Array.isArray(p.job) && p.job.includes(mappedJob))) &&
          (!userIncome || isIncomeMatch(p, userIncome, household))
      )
      .map((p) => {
        const { reasons, score } = explainMatch(p, {
          region,
          userAge,
          job: mappedJob, // ✅ 한글 값 넘김
          userIncome,
          household,
        });
        return { ...p, reasons, score };
      })
      .sort((a, b) => b.score - a.score);

    const lim = limit ? parseInt(limit, 10) : undefined;
    res.json({
      source: "mock",
      count: enriched.length,
      policies: lim ? enriched.slice(0, lim) : enriched,
    });
  } catch (err) {
    console.error("❌ 정책 필터링 오류:", err);
    res
      .status(500)
      .json({ error: "정책 데이터를 불러오는 데 실패했습니다." });
  }
});

module.exports = router;
