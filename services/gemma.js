const fs = require('fs');
const path = require('path');
const {GoogleGenAI} = require('@google/genai');

const promptPath = path.join(__dirname, '../prompts/gemma.txt');
const prompt = fs.readFileSync(promptPath, 'utf8');

async function gemma(userStatement) {
    const ai = new GoogleGenAI({apiKey: process.env.GEMMA_API_KEY});

    const fullPrompt = prompt.replace('{{userStatement}}', userStatement);

    const response = await ai.models.generateContentStream({
        model: process.env.GEMMA_MODEL,
        config: {responseMimeType: 'text/plain'},
        contents: {role: 'user', parts: [{text: fullPrompt}]},
    });

    let output = '';
    for await (const chunk of response) {
        output += chunk.text || '';
    }

    return output;
}

module.exports = {gemma};
