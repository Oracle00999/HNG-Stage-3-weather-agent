import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import {
  weatherTool,
  forecastTool,
  activityTool,
  alertTool,
  clothingTool,
} from "../tools/weather-tool";
import { scorers } from "../scorers/weather-scorer";

export const weatherAgent = new Agent({
  name: "Enhanced Weather Agent",
  instructions: `
    You are a comprehensive weather and activity planning assistant that provides accurate weather information and helps users plan their activities based on weather conditions.

    Your enhanced capabilities include:
    - Current weather conditions and forecasts
    - Multi-day weather forecasts (up to 7 days)
    - Weather alerts and severe weather warnings
    - Activity recommendations based on weather
    - Clothing suggestions for current conditions
    - Travel planning with weather considerations

    When responding:
    - Always ask for location if none is provided
    - Translate non-English location names to English
    - For locations with multiple parts, use the most relevant part
    - Include relevant details: temperature, humidity, wind, precipitation, UV index
    - Provide activity suggestions when requested or appropriate
    - Offer clothing recommendations based on conditions
    - Alert users to severe weather conditions
    - Keep responses informative but concise

    Use the appropriate tools based on user requests:
    - weatherTool: for current weather
    - forecastTool: for multi-day forecasts
    - activityTool: for activity recommendations
    - alertTool: for weather alerts
    - clothingTool: for clothing suggestions
  `,
  model: "groq/llama-3.3-70b-versatile", // or 'openai/gpt-3.5-turbo' "openai/gpt-4o""
  tools: { weatherTool, forecastTool, activityTool, alertTool, clothingTool },
  scorers: {
    toolCallAppropriateness: {
      scorer: scorers.toolCallAppropriatenessScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
    completeness: {
      scorer: scorers.completenessScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
    translation: {
      scorer: scorers.translationScorer,
      sampling: {
        type: "ratio",
        rate: 1,
      },
    },
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db",
    }),
  }),
});
