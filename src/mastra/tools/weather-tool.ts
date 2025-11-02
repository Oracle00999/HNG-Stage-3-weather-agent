import { createTool } from "@mastra/core/tools";
import { z } from "zod";

interface GeocodingResponse {
  results: {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
    admin1?: string;
  }[];
}

interface CurrentWeatherResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
    precipitation: number;
    uv_index?: number;
  };
}

interface ForecastResponse {
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_probability_max: number[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
  };
}

// Existing weather tool (enhanced)
export const weatherTool = createTool({
  id: "get-current-weather",
  description: "Get current weather conditions for a location",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    precipitation: z.number(),
    uvIndex: z.number().optional(),
    conditions: z.string(),
    location: z.string(),
    country: z.string(),
  }),
  execute: async ({ context }) => {
    return await getCurrentWeather(context.location);
  },
});

// New: Forecast Tool
export const forecastTool = createTool({
  id: "get-weather-forecast",
  description: "Get multi-day weather forecast for a location",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
    days: z
      .number()
      .min(1)
      .max(7)
      .default(3)
      .describe("Number of days to forecast"),
  }),
  outputSchema: z.object({
    location: z.string(),
    country: z.string(),
    forecast: z.array(
      z.object({
        date: z.string(),
        high: z.number(),
        low: z.number(),
        conditions: z.string(),
        precipitationChance: z.number(),
        windSpeed: z.number(),
        uvIndex: z.number(),
      })
    ),
  }),
  execute: async ({ context }) => {
    return await getWeatherForecast(context.location, context.days);
  },
});

// New: Activity Recommendation Tool
export const activityTool = createTool({
  id: "get-activity-recommendations",
  description: "Get activity recommendations based on weather conditions",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
    interests: z
      .array(z.string())
      .optional()
      .describe("User interests (hiking, beach, dining, etc.)"),
  }),
  outputSchema: z.object({
    location: z.string(),
    currentConditions: z.string(),
    temperature: z.number(),
    recommendations: z.array(
      z.object({
        activity: z.string(),
        suitability: z.enum(["excellent", "good", "fair", "poor"]),
        reason: z.string(),
        indoorAlternative: z.string().optional(),
      })
    ),
  }),
  execute: async ({ context }) => {
    return await getActivityRecommendations(
      context.location,
      context.interests
    );
  },
});

// New: Weather Alert Tool
export const alertTool = createTool({
  id: "get-weather-alerts",
  description: "Get severe weather alerts for a location",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
  }),
  outputSchema: z.object({
    location: z.string(),
    country: z.string(),
    alerts: z.array(
      z.object({
        severity: z.enum(["extreme", "severe", "moderate", "minor"]),
        event: z.string(),
        description: z.string(),
        instructions: z.string(),
      })
    ),
    hasAlerts: z.boolean(),
  }),
  execute: async ({ context }) => {
    return await getWeatherAlerts(context.location);
  },
});

// New: Clothing Recommendation Tool
export const clothingTool = createTool({
  id: "get-clothing-recommendations",
  description: "Get clothing recommendations based on weather conditions",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
    activity: z.string().optional().describe("Planned activity"),
  }),
  outputSchema: z.object({
    location: z.string(),
    temperature: z.number(),
    conditions: z.string(),
    recommendations: z.object({
      layers: z.array(z.string()),
      accessories: z.array(z.string()),
      footwear: z.string(),
      notes: z.string(),
    }),
  }),
  execute: async ({ context }) => {
    return await getClothingRecommendations(context.location, context.activity);
  },
});

// Helper Functions
const geocodeLocation = async (location: string) => {
  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`;
  const geocodingResponse = await fetch(geocodingUrl);
  const geocodingData = (await geocodingResponse.json()) as GeocodingResponse;

  if (!geocodingData.results?.[0]) {
    throw new Error(`Location '${location}' not found`);
  }

  return geocodingData.results[0];
};

const getCurrentWeather = async (location: string) => {
  const { latitude, longitude, name, country } =
    await geocodeLocation(location);

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code,precipitation,uv_index`;

  const response = await fetch(weatherUrl);
  const data = (await response.json()) as CurrentWeatherResponse;

  return {
    temperature: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    humidity: data.current.relative_humidity_2m,
    windSpeed: data.current.wind_speed_10m,
    windGust: data.current.wind_gusts_10m,
    precipitation: data.current.precipitation,
    uvIndex: data.current.uv_index,
    conditions: getWeatherCondition(data.current.weather_code),
    location: name,
    country: country,
  };
};

const getWeatherForecast = async (location: string, days: number = 3) => {
  const { latitude, longitude, name, country } =
    await geocodeLocation(location);

  const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=auto&forecast_days=${days}`;

  const response = await fetch(forecastUrl);
  const data = (await response.json()) as ForecastResponse;

  const forecast = data.daily.time.map((date, index) => ({
    date,
    high: data.daily.temperature_2m_max[index],
    low: data.daily.temperature_2m_min[index],
    conditions: getWeatherCondition(data.daily.weather_code[index]),
    precipitationChance: data.daily.precipitation_probability_max[index],
    windSpeed: data.daily.wind_speed_10m_max[index],
    uvIndex: data.daily.uv_index_max[index],
  }));

  return {
    location: name,
    country: country,
    forecast,
  };
};

const getActivityRecommendations = async (
  location: string,
  interests?: string[]
) => {
  const weather = await getCurrentWeather(location);

  const allActivities = [
    {
      activity: "Hiking",
      tempRange: [10, 30],
      conditions: ["Clear sky", "Mainly clear", "Partly cloudy"],
    },
    {
      activity: "Beach",
      tempRange: [20, 35],
      conditions: ["Clear sky", "Mainly clear"],
    },
    {
      activity: "Cycling",
      tempRange: [5, 30],
      conditions: ["Clear sky", "Mainly clear", "Partly cloudy"],
    },
    {
      activity: "Picnic",
      tempRange: [15, 28],
      conditions: ["Clear sky", "Mainly clear", "Partly cloudy"],
    },
    { activity: "Museum", tempRange: [-10, 40], conditions: ["All"] },
    { activity: "Shopping", tempRange: [-10, 40], conditions: ["All"] },
    { activity: "Restaurant", tempRange: [-10, 40], conditions: ["All"] },
  ];

  const recommendations = allActivities
    .filter((act) => {
      const tempSuitable =
        weather.temperature >= act.tempRange[0] &&
        weather.temperature <= act.tempRange[1];
      const conditionsSuitable =
        act.conditions.includes("All") ||
        act.conditions.includes(weather.conditions);
      return tempSuitable && conditionsSuitable;
    })
    .map((act) => {
      let suitability: "excellent" | "good" | "fair" | "poor" = "good";

      if (
        weather.temperature >= act.tempRange[0] + 5 &&
        weather.temperature <= act.tempRange[1] - 5
      ) {
        suitability = "excellent";
      } else if (weather.precipitation > 5) {
        suitability = "fair";
      }

      return {
        activity: act.activity,
        suitability,
        reason: getActivityReason(act.activity, weather),
        indoorAlternative: getIndoorAlternative(act.activity),
      };
    });

  return {
    location: weather.location,
    currentConditions: weather.conditions,
    temperature: weather.temperature,
    recommendations: recommendations.slice(0, 5), // Return top 5
  };
};

const getWeatherAlerts = async (location: string) => {
  // Note: Open-Meteo doesn't have alerts API, this is a mock implementation
  // In production, you'd integrate with a service like National Weather Service
  const weather = await getCurrentWeather(location);

  const alerts = [];

  // Mock alert logic based on conditions
  if (weather.precipitation > 20) {
    alerts.push({
      severity: "moderate" as const,
      event: "Heavy Rain",
      description: "Heavy rainfall expected in the area",
      instructions: "Avoid low-lying areas and drive carefully",
    });
  }

  if (weather.windSpeed > 30) {
    alerts.push({
      severity: "severe" as const,
      event: "High Winds",
      description: "Strong winds expected",
      instructions: "Secure outdoor objects and avoid wooded areas",
    });
  }

  return {
    location: weather.location,
    country: weather.country,
    alerts,
    hasAlerts: alerts.length > 0,
  };
};

const getClothingRecommendations = async (
  location: string,
  activity?: string
) => {
  const weather = await getCurrentWeather(location);

  let layers: string[] = [];
  let accessories: string[] = [];
  let footwear = "";
  let notes = "";

  if (weather.temperature < 0) {
    layers = ["Thermal base layer", "Insulated mid-layer", "Waterproof jacket"];
    accessories = ["Warm hat", "Gloves", "Scarf"];
    footwear = "Insulated waterproof boots";
  } else if (weather.temperature < 10) {
    layers = ["Long-sleeve shirt", "Fleece or sweater", "Light jacket"];
    accessories = ["Light hat", "Gloves if windy"];
    footwear = "Closed shoes or boots";
  } else if (weather.temperature < 20) {
    layers = ["T-shirt", "Light jacket or hoodie"];
    accessories = [];
    footwear = "Sneakers or comfortable shoes";
  } else {
    layers = ["T-shirt or light top"];
    accessories = ["Sunglasses", "Hat for sun protection"];
    footwear = "Sandals or breathable shoes";
  }

  // Add rain protection if needed
  if (weather.precipitation > 5) {
    accessories.push("Umbrella", "Waterproof jacket");
    notes = "Expect rain, bring waterproof gear";
  }

  // Activity-specific adjustments
  if (activity?.toLowerCase().includes("hiking")) {
    footwear = "Hiking boots";
    accessories.push("Backpack", "Water bottle");
  }

  return {
    location: weather.location,
    temperature: weather.temperature,
    conditions: weather.conditions,
    recommendations: {
      layers,
      accessories,
      footwear,
      notes: notes || "Dress comfortably for the conditions",
    },
  };
};

// Helper functions
function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return conditions[code] || "Unknown";
}

function getActivityReason(activity: string, weather: any): string {
  const reasons: Record<string, string> = {
    Hiking: `Perfect temperature of ${weather.temperature}°C and ${weather.conditions.toLowerCase()} for hiking`,
    Beach: `Warm ${weather.temperature}°C and clear skies ideal for beach activities`,
    Cycling: `Comfortable conditions for cycling with mild temperatures`,
    Picnic: `Pleasant weather for outdoor dining and relaxation`,
    Museum: `Great indoor activity regardless of weather conditions`,
    Shopping: `Comfortable indoor activity suitable for any weather`,
    Restaurant: `Enjoy dining in climate-controlled comfort`,
  };
  return reasons[activity] || `Suitable activity for current conditions`;
}

function getIndoorAlternative(activity: string): string {
  const alternatives: Record<string, string> = {
    Hiking: "Visit a nature museum or indoor botanical garden",
    Beach: "Visit an indoor pool or aquatic center",
    Cycling: "Try a stationary bike at a gym",
    Picnic: "Have an indoor picnic or visit a food hall",
  };
  return alternatives[activity];
}
