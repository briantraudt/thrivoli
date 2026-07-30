const STEDI_ELIGIBILITY_URL =
  "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/eligibility/v3";

const SANDBOX_REQUEST = {
  provider: {
    organizationName: "STEDI",
    npi: "1447848577",
  },
  tradingPartnerServiceId: "STEDI",
  controlNumber: "112233445",
  subscriber: {
    memberId: "23051322",
    lastName: "Prohas",
    firstName: "Bernie",
  },
  encounter: {
    serviceTypeCodes: ["30"],
  },
  stediTest: true,
};

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function collectBenefits(payload) {
  const benefits = Array.isArray(payload?.benefitsInformation)
    ? payload.benefitsInformation
    : [];

  return benefits.slice(0, 40).map((benefit) => ({
    name:
      text(benefit?.name) ||
      text(benefit?.serviceTypeCodes?.join?.(", ")) ||
      "Health plan benefit",
    status:
      text(benefit?.code) ||
      text(benefit?.coverageLevelCode) ||
      text(benefit?.insuranceTypeCode),
    amount:
      money(benefit?.benefitAmount) ||
      money(benefit?.benefitPercent) ||
      text(benefit?.benefitAmount),
    network: text(benefit?.inPlanNetworkIndicatorCode),
    messages: Array.isArray(benefit?.additionalInformation)
      ? benefit.additionalInformation
          .map((item) => text(item?.description || item))
          .filter(Boolean)
          .slice(0, 3)
      : [],
  }));
}

export function normalizeEligibility(payload) {
  const subscriber = payload?.subscriber || {};
  const payer = payload?.payer || payload?.informationReceiver || {};
  const planStatuses = Array.isArray(payload?.planStatus) ? payload.planStatus : [];
  const errors = Array.isArray(payload?.errors)
    ? payload.errors
        .map((error) => text(error?.description || error?.message || error?.followupAction))
        .filter(Boolean)
    : [];

  return {
    id: text(payload?.id),
    traceId: text(payload?.meta?.traceId),
    mode: text(payload?.meta?.applicationMode) || "test",
    checkedAt: new Date().toISOString(),
    payer: text(payer?.name || payer?.organizationName) || "Stedi test payer",
    subscriber: {
      name:
        [text(subscriber?.firstName), text(subscriber?.lastName)]
          .filter(Boolean)
          .join(" ") || "Bernie Prohas",
      memberId: text(subscriber?.memberId) || "23051322",
    },
    coverage: planStatuses.map((status) => ({
      status: text(status?.statusCode || status?.status) || "Unknown",
      plan: text(status?.planDetails || status?.planName),
      serviceTypes: Array.isArray(status?.serviceTypeCodes)
        ? status.serviceTypeCodes
        : [],
    })),
    benefits: collectBenefits(payload),
    errors,
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  if (!process.env.STEDI_API_KEY) {
    return response.status(503).json({
      error:
        "Stedi is not configured. Add STEDI_API_KEY to the server environment and redeploy.",
    });
  }

  try {
    const stediResponse = await fetch(STEDI_ELIGIBILITY_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.STEDI_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SANDBOX_REQUEST),
    });
    const payload = await stediResponse.json().catch(() => ({}));

    if (!stediResponse.ok) {
      console.error("Stedi eligibility error", {
        status: stediResponse.status,
        traceId: payload?.meta?.traceId,
        errors: payload?.errors,
      });
      return response.status(stediResponse.status >= 500 ? 502 : 400).json({
        error:
          payload?.message ||
          payload?.errors?.[0]?.description ||
          "Stedi could not complete the eligibility check.",
        traceId: payload?.meta?.traceId || null,
      });
    }

    return response.status(200).json(normalizeEligibility(payload));
  } catch (error) {
    console.error("Stedi eligibility request failed", error);
    return response.status(502).json({
      error: "Thrivoli could not reach Stedi. Please try again.",
    });
  }
}
