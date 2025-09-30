// ai-assistant.js (Corrected with Refactored Tool Execution)
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { getPrayerTimes, calculateZakat, convertDate, searchHistory } = require('./app-functions');

// 1. Define the "tools" that the AI can use (this section is unchanged).
const tools = [
    {
        type: 'function',
        function: {
            name: 'getPrayerTimes',
            description: 'Get prayer times for a specific city. The current date and user location (Dubai) are assumed if not provided.',
            parameters: {
                type: 'object',
                properties: {
                    lat: { type: 'number', description: 'The latitude of the location.' },
                    lon: { type: 'number', description: 'The longitude of the location.' },
                },
                required: ['lat', 'lon'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'calculateZakat',
            description: 'Calculates the Zakat due based on various assets. If assets are not provided, ask the user for them.',
            parameters: {
                type: 'object',
                properties: {
                    cash: { type: 'number', description: "User's cash on hand." },
                    goldGrams: { type: 'number', description: "Total grams of gold the user owns." },
                    silverGrams: { type: 'number', description: "Total grams of silver the user owns." },
                    currency: { type: 'string', description: "The currency for the calculation, e.g., AED, USD. Defaults to USD." }
                },
                required: ['cash', 'goldGrams', 'silverGrams'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'convertDate',
            description: 'Converts a date between Gregorian and Hijri calendars.',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'The date to convert. For Gregorian to Hijri, use YYYY-MM-DD. For Hijri to Gregorian, use iYYYY/iM/iD.' },
                    from: { type: 'string', enum: ['Gregorian', 'Hijri'] },
                    to: { type: 'string', enum: ['Gregorian', 'Hijri'] },
                },
                required: ['date', 'from', 'to'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchHistory',
            description: 'Searches the user\'s personal translation history for a specific term.',
            parameters: {
                type: 'object',
                properties: {
                    searchTerm: { type: 'string', description: 'The term to search for in the translation history.' },
                },
                required: ['searchTerm'],
            },
        },
    }
];

// <<< FIX POINT 12: Helper function to process tool calls >>>
async function _executeToolCalls(toolCalls, sessionId) {
    const availableFunctions = { getPrayerTimes, calculateZakat, convertDate, searchHistory };
    const tool_results = [];

    // Loop through each tool call requested by the model
    for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionToCall = availableFunctions[functionName];
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResponse;

        // Execute the function and handle potential errors
        try {
            console.log(`Calling tool: ${functionName} with args:`, functionArgs);
            if (functionName === 'searchHistory') {
                 functionResponse = await functionToCall(functionArgs.searchTerm, sessionId);
            } else {
                 functionResponse = await functionToCall(...Object.values(functionArgs));
            }
        } catch (error) {
            console.error(`Error executing tool '${functionName}':`, error);
            functionResponse = { 
                error: `The function ${functionName} failed to execute.`, 
                details: error.message 
            };
        }

        // Add the tool's response to the results array
        tool_results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: functionName,
            content: JSON.stringify(functionResponse),
        });
    }
    return tool_results;
}


// Main handler function (now more concise)
async function handleUserQuery(question, sessionId) {
    const systemMessage = `You are a helpful assistant for an Islamic web portal. The current date is ${new Date().toDateString()}. The user's current location is Dubai, UAE, latitude 25.2048, longitude 55.2708. Use this location for any prayer time requests unless another city is specified.`;

    const messages = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: question }
    ];

    // First API call to see if the model wants to use a tool
    const firstResponse = await openai.chat.completions.create({
        model: 'gpt-5',
        messages: messages,
        tools: tools,
        tool_choice: 'auto',
    });

    const responseMessage = firstResponse.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    // Check if the model decided to call any tools
    if (toolCalls) {
        messages.push(responseMessage);
        
        // <<< FIX POINT 12: Call the refactored helper function >>>
        const toolResponses = await _executeToolCalls(toolCalls, sessionId);
        messages.push(...toolResponses);

        // Second API call to get a final summary from the model based on tool results
        const finalResponse = await openai.chat.completions.create({
            model: 'gpt-5',
            messages: messages,
        });

        return finalResponse.choices[0].message.content;
    } else {
        // If no tool was called, return the model's first response directly.
        return responseMessage.content;
    }
}

module.exports = { handleUserQuery };