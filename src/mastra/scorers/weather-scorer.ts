import { z } from "zod";
import { createToolCallAccuracyScorerCode } from "@mastra/evals/scorers/code";
import { createCompletenessScorer } from "@mastra/evals/scorers/code";
import { createScorer } from "@mastra/core/scores";

// Enhanced tool appropriateness scorer for multiple tools
export const toolCallAppropriatenessScorer = createScorer({
  name: "Tool Call Appropriateness",
  description: "Evaluates if the right tool was used for the user request",
  type: "agent",
  judge: {
    model: "openai/gpt-4o-mini",
    instructions:
      "You are an expert evaluator of tool usage appropriateness. " +
      "Determine whether the assistant selected the most appropriate tool for the user request. " +
      "Available tools: weatherTool (current conditions), forecastTool (multi-day forecast), " +
      "activityTool (activity recommendations), alertTool (weather alerts), clothingTool (clothing suggestions). " +
      "Return only the structured JSON matching the provided schema.",
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || "";
    const toolCalls = run.output?.[0]?.toolCalls || [];
    const assistantText = (run.output?.[0]?.content as string) || "";
    return { userText, toolCalls, assistantText };
  })
  .analyze({
    description: "Evaluate tool selection appropriateness",
    outputSchema: z.object({
      expectedTools: z.array(z.string()),
      usedTools: z.array(z.string()),
      appropriateness: z.enum(["excellent", "good", "fair", "poor"]),
      reasoning: z.string(),
      confidence: z.number().min(0).max(1).default(1),
    }),
    createPrompt: ({ results }) => `
      Evaluate if the assistant used appropriate tools for this weather-related request.
      
      USER REQUEST: "${results.preprocessStepResult.userText}"
      
      TOOLS USED: ${JSON.stringify(results.preprocessStepResult.toolCalls.map((tc: any) => tc.toolName))}
      
      ASSISTANT RESPONSE: "${results.preprocessStepResult.assistantText}"
      
      Available tools and their purposes:
      - weatherTool: Current weather conditions for a location
      - forecastTool: Multi-day weather forecasts (1-7 days)
      - activityTool: Activity recommendations based on weather
      - alertTool: Weather alerts and severe weather warnings
      - clothingTool: Clothing recommendations for current conditions
      
      Consider:
      1. Did the assistant use tools that match the user's request?
      2. Were multiple tools used when appropriate?
      3. Were tools omitted when they should have been used?
      4. Is the tool selection logical for the query type?
      
      Return JSON with:
      - expectedTools: array of tool names that should have been used
      - usedTools: array of tool names that were actually used
      - appropriateness: "excellent" | "good" | "fair" | "poor"
      - reasoning: explanation of your evaluation
      - confidence: 0-1 confidence in your assessment
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    const scoreMap = {
      excellent: 1.0,
      good: 0.8,
      fair: 0.5,
      poor: 0.2,
    };
    const baseScore =
      scoreMap[r.appropriateness as keyof typeof scoreMap] || 0.5;
    return Math.max(0, Math.min(1, baseScore * (r.confidence ?? 1)));
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Tool appropriateness: ${r.appropriateness || "unknown"}. Expected: ${r.expectedTools?.join(", ") || "none"}, Used: ${r.usedTools?.join(", ") || "none"}. Score: ${score}. ${r.reasoning || ""}`;
  });

// Enhanced completeness scorer for comprehensive weather responses
export const completenessScorer = createScorer({
  name: "Response Completeness",
  description:
    "Evaluates if the response fully addresses all aspects of the user request",
  type: "agent",
  judge: {
    model: "openai/gpt-4o-mini",
    instructions:
      "You are an expert evaluator of response completeness for weather assistance. " +
      "Determine whether the assistant fully addressed all aspects of the user request, " +
      "including current conditions, forecasts, activities, alerts, or clothing as relevant. " +
      "Return only the structured JSON matching the provided schema.",
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || "";
    const assistantText = (run.output?.[0]?.content as string) || "";
    const toolCalls = run.output?.[0]?.toolCalls || [];
    return { userText, assistantText, toolCalls };
  })
  .analyze({
    description: "Evaluate response completeness for weather queries",
    outputSchema: z.object({
      requestType: z.array(
        z.enum([
          "current",
          "forecast",
          "activities",
          "alerts",
          "clothing",
          "general",
        ])
      ),
      addressedAspects: z.array(z.string()),
      missingAspects: z.array(z.string()),
      completeness: z.enum([
        "complete",
        "mostly_complete",
        "partial",
        "incomplete",
      ]),
      reasoning: z.string(),
    }),
    createPrompt: ({ results }) => `
      Evaluate if the weather assistant's response completely addresses the user's request.
      
      USER REQUEST: "${results.preprocessStepResult.userText}"
      
      ASSISTANT RESPONSE: "${results.preprocessStepResult.assistantText}"
      
      TOOLS USED: ${JSON.stringify(results.preprocessStepResult.toolCalls.map((tc: any) => tc.toolName))}
      
      Analyze:
      1. What type of weather information was requested? (current, forecast, activities, alerts, clothing, general)
      2. Did the response address all explicit and implicit needs?
      3. Were relevant details provided (temperature, conditions, recommendations, etc.)?
      4. Was location handling appropriate?
      5. Were activity/clothing suggestions provided when relevant?
      
      Return JSON with:
      - requestType: array of relevant request types
      - addressedAspects: array of aspects that were properly addressed
      - missingAspects: array of aspects that were missing or incomplete
      - completeness: "complete" | "mostly_complete" | "partial" | "incomplete"
      - reasoning: explanation of your evaluation
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    const scoreMap = {
      complete: 1.0,
      mostly_complete: 0.8,
      partial: 0.5,
      incomplete: 0.2,
    };
    return scoreMap[r.completeness as keyof typeof scoreMap] || 0.5;
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Completeness: ${r.completeness || "unknown"}. Addressed: ${r.addressedAspects?.join(", ") || "none"}. Missing: ${r.missingAspects?.join(", ") || "none"}. Score: ${score}. ${r.reasoning || ""}`;
  });

// Enhanced translation scorer for location handling
export const translationScorer = createScorer({
  name: "Location Translation Quality",
  description:
    "Checks that non-English location names are translated and used correctly across all tools",
  type: "agent",
  judge: {
    model: "openai/gpt-4o-mini",
    instructions:
      "You are an expert evaluator of translation quality for geographic locations in weather contexts. " +
      "Determine whether non-English locations are properly translated and consistently used across tool calls and responses. " +
      "Return only the structured JSON matching the provided schema.",
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || "";
    const assistantText = (run.output?.[0]?.content as string) || "";
    const toolCalls = run.output?.[0]?.toolCalls || [];

    // Extract locations from tool calls
    const toolLocations = toolCalls.map((tc: any) => ({
      tool: tc.toolName,
      location: tc.input?.location || tc.input?.city || "unknown",
    }));

    return { userText, assistantText, toolLocations };
  })
  .analyze({
    description:
      "Extract location names and detect translation consistency across tools",
    outputSchema: z.object({
      userLocation: z.string().default(""), // Fixed: provide default instead of optional
      detectedLanguage: z.enum(["english", "non-english", "mixed", "unknown"]),
      translationConsistency: z.enum([
        "consistent",
        "mostly_consistent",
        "inconsistent",
      ]),
      toolsUsedEnglish: z.boolean(),
      confidence: z.number().min(0).max(1).default(1),
      explanation: z.string().default(""),
    }),
    createPrompt: ({ results }) => `
      Evaluate location translation handling across the weather assistant's tools and response.
      
      USER TEXT: "${results.preprocessStepResult.userText}"
      
      ASSISTANT RESPONSE: "${results.preprocessStepResult.assistantText}"
      
      TOOL LOCATIONS: ${JSON.stringify(results.preprocessStepResult.toolLocations)}
      
      Tasks:
      1) Identify if the user mentioned a location that appears non-English.
      2) Check if all tool calls used consistent English location names.
      3) Verify the final response uses proper English location names.
      4) Assess overall translation consistency across the entire interaction.
      
      Be lenient with transliteration differences (e.g., accents/diacritics).
      
      Return JSON with:
      {
        "userLocation": string (the main location mentioned, empty string if none),
        "detectedLanguage": "english" | "non-english" | "mixed" | "unknown",
        "translationConsistency": "consistent" | "mostly_consistent" | "inconsistent",
        "toolsUsedEnglish": boolean,
        "confidence": number (0-1),
        "explanation": string
      }
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};

    if (r.detectedLanguage === "english") return 1.0; // Not applicable, full credit

    let baseScore = 0.5;
    if (r.translationConsistency === "consistent" && r.toolsUsedEnglish) {
      baseScore = 1.0;
    } else if (
      r.translationConsistency === "mostly_consistent" &&
      r.toolsUsedEnglish
    ) {
      baseScore = 0.8;
    } else if (
      r.translationConsistency === "inconsistent" ||
      !r.toolsUsedEnglish
    ) {
      baseScore = 0.3;
    }

    return Math.max(0, Math.min(1, baseScore * (r.confidence ?? 1)));
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Translation scoring: language=${r.detectedLanguage || "unknown"}, consistency=${r.translationConsistency || "unknown"}, toolsEnglish=${r.toolsUsedEnglish || false}, confidence=${r.confidence || 0}. Score=${score}. ${r.explanation || ""}`;
  });
// New: Activity Relevance Scorer
export const activityRelevanceScorer = createScorer({
  name: "Activity Recommendation Relevance",
  description:
    "Evaluates if activity suggestions are appropriate for the weather conditions",
  type: "agent",
  judge: {
    model: "groq/llama-3.3-70b-versatile",
    instructions:
      "You are an expert evaluator of weather-based activity recommendations. " +
      "Determine whether the suggested activities are appropriate for the reported weather conditions. " +
      "Return only the structured JSON matching the provided schema.",
  },
})
  .preprocess(({ run }) => {
    const userText = (run.input?.inputMessages?.[0]?.content as string) || "";
    const assistantText = (run.output?.[0]?.content as string) || "";
    const toolCalls = run.output?.[0]?.toolCalls || [];

    // Extract weather data and activities from tool calls
    const weatherData = toolCalls.find(
      (tc: any) =>
        tc.toolName === "weatherTool" || tc.toolName === "forecastTool"
    )?.output;

    const activityData = toolCalls.find(
      (tc: any) => tc.toolName === "activityTool"
    )?.output;

    return { userText, assistantText, weatherData, activityData };
  })
  .analyze({
    description: "Evaluate activity recommendations against weather conditions",
    outputSchema: z.object({
      weatherConditions: z.string(),
      activitiesSuggested: z.array(z.string()),
      relevance: z.enum([
        "highly_relevant",
        "relevant",
        "somewhat_relevant",
        "irrelevant",
      ]),
      reasoning: z.string(),
      improvements: z.array(z.string()),
    }),
    createPrompt: ({ results }) => `
      Evaluate if the activity recommendations match the weather conditions.
      
      USER REQUEST: "${results.preprocessStepResult.userText}"
      
      WEATHER DATA: ${JSON.stringify(results.preprocessStepResult.weatherData)}
      
      ACTIVITY DATA: ${JSON.stringify(results.preprocessStepResult.activityData)}
      
      ASSISTANT RESPONSE: "${results.preprocessStepResult.assistantText}"
      
      Consider:
      1. Are outdoor activities suggested during good weather?
      2. Are indoor alternatives provided during poor weather?
      3. Do activity suggestions consider temperature, precipitation, and other factors?
      4. Are the recommendations practical and safe?
      
      Return JSON with:
      - weatherConditions: summary of weather conditions
      - activitiesSuggested: array of recommended activities
      - relevance: "highly_relevant" | "relevant" | "somewhat_relevant" | "irrelevant"
      - reasoning: explanation of your evaluation
      - improvements: array of suggested improvements
    `,
  })
  .generateScore(({ results }) => {
    const r = (results as any)?.analyzeStepResult || {};
    const scoreMap = {
      highly_relevant: 1.0,
      relevant: 0.8,
      somewhat_relevant: 0.5,
      irrelevant: 0.2,
    };
    return scoreMap[r.relevance as keyof typeof scoreMap] || 0.5;
  })
  .generateReason(({ results, score }) => {
    const r = (results as any)?.analyzeStepResult || {};
    return `Activity relevance: ${r.relevance || "unknown"}. Suggested: ${r.activitiesSuggested?.join(", ") || "none"}. Score: ${score}. ${r.reasoning || ""}`;
  });

export const scorers = {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
  activityRelevanceScorer,
};
