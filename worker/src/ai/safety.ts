export function validateAndNormalizeAIResponse(content: string, languageCode = "en"): string {
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    throw new Error("AI provider returned empty content");
  }

  let cleaned = content.trim();

  // Ensure disclaimer exists
  const disclaimerKeywords = [
    "disclaimer",
    "medical advice",
    "educational purposes",
    "సలహా", // Telugu
    "अस्वीकरण", // Hindi
    "चिकित्सा सलाह",
  ];

  const hasDisclaimer = disclaimerKeywords.some(keyword =>
    cleaned.toLowerCase().includes(keyword.toLowerCase())
  );

  if (!hasDisclaimer) {
    const disclaimers: Record<string, string> = {
      te: "\n\n*గమనిక: ఈ సమాచారం సాధారణ అవగాహన కోసం మాత్రమే. వైద్య సలహా ప్రత్యామ్నాయం కాదు.*",
      hi: "\n\n*अस्वीकरण: यह जानकारी केवल शैक्षिक उद्देश्यों के लिए है और पेशेवर चिकित्सा सलाह का विकल्प नहीं है।*",
      en: "\n\n*Disclaimer: Information is for educational purposes and is not a substitute for professional medical advice.*",
    };
    cleaned += disclaimers[languageCode] || disclaimers["en"];
  }

  return cleaned;
}
