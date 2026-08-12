export const CONTRIBUTION_SETTINGS = Object.freeze({
  concessionalCap: 32500,
  effectiveFrom: "2026-07-01",
  defaultSgRate: 12
});

const amount = value => Math.max(0, Number(value) || 0);

export function calculateClientContext(input, settings = CONTRIBUTION_SETTINGS) {
  const employmentStatus = input.employmentStatus || "employed";
  const isWorking = employmentStatus === "employed" || employmentStatus === "self-employed";
  const age = Math.min(100, Math.max(18, Number(input.age) || 18));
  const retirementAge = Math.min(100, Math.max(age, Number(input.retirementAge) || age));
  const superableEarnings = amount(input.superableEarnings);
  const sgRate = amount(input.sgRate);
  const employerSg = employmentStatus === "employed" ? superableEarnings * sgRate / 100 : 0;
  const salarySacrifice = isWorking ? amount(input.salarySacrifice) : 0;
  const personalConcessional = isWorking ? amount(input.personalConcessional) : 0;
  const totalConcessional = employerSg + salarySacrifice + personalConcessional;
  const remainingCap = settings.concessionalCap - totalConcessional;
  const dollars = value => "$" + value.toLocaleString("en-AU");
  const capStatus = totalConcessional > settings.concessionalCap ? "over" : totalConcessional >= settings.concessionalCap * 0.9 ? "near" : "within";
  const capMessage = capStatus === "over"
    ? "Exceeds the general " + dollars(settings.concessionalCap) + " concessional cap by " + dollars(Math.abs(remainingCap)) + " — adviser review required."
    : capStatus === "near"
      ? "Within 10% of the general " + dollars(settings.concessionalCap) + " concessional cap."
      : dollars(remainingCap) + " remaining below the general concessional cap.";
  return {employmentStatus,isWorking,currentFund:String(input.currentFund || "").trim(),age,retirementAge,yearsToRetirement:retirementAge-age,superableEarnings,sgRate,employerSg,salarySacrifice,personalConcessional,totalConcessional,remainingCap,capStatus,capMessage,settingsEffectiveFrom:settings.effectiveFrom};
}
