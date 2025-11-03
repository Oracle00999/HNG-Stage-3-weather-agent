Weather Agent - Forecast Genius
A comprehensive AI weather assistant built with Mastra that provides current weather conditions, multi-day forecasts, activity recommendations, and clothing suggestions.

Features
🌤️ Current Weather - Real-time temperature, humidity, wind conditions

📅 Multi-day Forecasts - 1-7 day weather outlook

🎯 Activity Recommendations - Weather-appropriate activity suggestions

👕 Clothing Suggestions - Outfit recommendations based on conditions

⚠️ Weather Alerts - Severe weather warnings and safety advice

🌍 Global Coverage - Supports locations worldwide with automatic translation

# Install dependencies

npm install

# Start development server

npm run dev

# Build for production

npm run build

API Usage
A2A Endpoint
POST /a2a/agent/weatherAgent

Example Request:
{
"messages": [
{
"role": "user",
"content": "What's the weather in Tokyo?"
}
]
}
Example Queries
"What's the weather in London?"

"3-day forecast for Paris"

"What activities can I do in Miami?"

"What should I wear in New York today?"

"Weather alerts in Tokyo"

Environment Variables
bash
GROQ_API_KEY=your_groq_api_key
