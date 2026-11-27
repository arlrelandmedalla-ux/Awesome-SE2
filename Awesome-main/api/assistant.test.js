const assert = require("node:assert/strict");
const { after, test } = require("node:test");

const geminiRequestPath = require.resolve("../scripts/gemini-request");
const assistantPath = require.resolve("./assistant");
const originalGeminiRequest = require(geminiRequestPath);
const originalAssistantModule = require.cache[assistantPath];
const originalApiKey = process.env.GEMINI_API_KEY;
let capturedRequest;

require.cache[geminiRequestPath].exports = async (_client, request) => {
  capturedRequest = request;
  return {
    text: JSON.stringify({
      answer: "May gallery pictures sa 2026.",
      language: "tl",
      escalate: false
    })
  };
};
delete require.cache[assistantPath];
const assistant = require("./assistant");

after(() => {
  require.cache[geminiRequestPath].exports = originalGeminiRequest;
  if (originalAssistantModule) require.cache[assistantPath] = originalAssistantModule;
  else delete require.cache[assistantPath];
  if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalApiKey;
});

test("includes curated company facts and live page content in assistant answers", async () => {
  process.env.GEMINI_API_KEY = "test-api-key";
  capturedRequest = null;
  const response = {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader() {}
  };

  await assistant({
    method: "POST",
    body: {
      serviceId: "company-process",
      question: "Anong taon may mga picture sa website?",
      language: "tl",
      websiteContext: "PUBLISHED GALLERY ITEMS:\n2026-11-04 | image: Office photo"
    }
  }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.answer, "May gallery pictures sa 2026.");
  assert.match(capturedRequest.config.systemInstruction, /Accounting clarity for growing businesses\./);
  assert.match(capturedRequest.config.systemInstruction, /PUBLISHED GALLERY ITEMS:[\s\S]*2026-11-04 \| image: Office photo/);
});
