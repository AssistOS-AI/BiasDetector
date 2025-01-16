const llmModule = require('assistos').loadModule('llm', {});
const personalityModule = require('assistos').loadModule('personality', {});

export class BiasAnalysisService {
    constructor() {
        this.personality = null;
        this.analysisPrompt = '';
    }

    setPersonality(personality) {
        this.personality = personality;
    }

    setAnalysisPrompt(prompt) {
        this.analysisPrompt = prompt;
    }

    async analyzeText(text, topN = 5) {
        if (!this.personality) {
            throw new Error('Personality must be set before analysis');
        }

        // Use the personality's LLM to analyze the text
        const analysis = await this.detectBiases(text, topN);
        return this.processAnalysisResults(analysis, topN);
    }

    async detectBiases(text, topN) {
        try {
            // Get personality description
            const personalityObj = await personalityModule.getPersonalityByName(assistOS.space.id, this.personality);
            const personalityDescription = personalityObj.description;

            // Prepare the analysis prompt
            const prompt = `
            You are analyzing this text with the following personality and context:
            
            Personality: ${this.personality}
            Description: ${personalityDescription}
            
            User's Analysis Focus: ${this.analysisPrompt || 'Analyze the text for any potential biases'}

            Analyze the following text for potential biases. For each bias detected:
            1. Name the specific type of bias (keep it concise, clear, and avoid quotes or special characters)
            2. Rate its strength on a scale of -10 to 10, where:
               - Negative values (-10 to -1) indicate harmful biases
               - Zero (0) indicates neutral or no bias
               - Positive values (1 to 10) indicate beneficial biases
            3. Provide a brief explanation of why this bias is present (do not include the rating in the explanation - maximum 150 words)
            
            You must respond in valid JSON format with this exact structure:
            {
                "biases": ["bias1", "bias2", ...],
                "scores": [-8.5, 6.2, ...],
                "explanations": ["brief explanation 1", "brief explanation 2", ...]
            }

            IMPORTANT:
            - Return exactly ${topN} most significant biases
            - Keep explanations concise and clear
            - Do not repeat text or get stuck in loops
            - Ensure the response is valid JSON
            - Use decimal numbers for scores between -10 and 10
            - Do not use quotes or special characters in bias names
            - Ensure all arrays have the same length
            - Do not include ratings in explanations
            - Keep bias names short and clear
            - Each explanation should be under 150 words

            Text to analyze:
            ${text}
            `;

            // Get LLM response using the personality's settings
            const response = await llmModule.generateText(assistOS.space.id, prompt, this.personality);
            console.log('Raw Response:', response);

            try {
                // Extract the message content from the response
                if (response && response.message) {
                    const jsonResponse = JSON.parse(response.message);
                    console.log('Parsed message:', jsonResponse);

                    // Validate and clean up the response
                    if (!Array.isArray(jsonResponse.biases) ||
                        !Array.isArray(jsonResponse.scores) ||
                        !Array.isArray(jsonResponse.explanations)) {
                        throw new Error('Invalid response structure');
                    }

                    // Ensure arrays are of equal length
                    const length = Math.min(
                        jsonResponse.biases.length,
                        jsonResponse.scores.length,
                        jsonResponse.explanations.length
                    );

                    return {
                        biases: jsonResponse.biases.slice(0, length),
                        scores: jsonResponse.scores.slice(0, length),
                        explanations: jsonResponse.explanations.slice(0, length)
                    };
                } else {
                    throw new Error('Response missing message property');
                }
            } catch (error) {
                console.error('Error parsing LLM response:', error);
                console.error('Raw response:', response);
                throw new Error('Invalid analysis response format');
            }
        } catch (error) {
            console.error('Error in bias detection:', error);
            throw error;
        }
    }

    processAnalysisResults(analysis, topN) {
        try {
            // Validate analysis structure
            if (!analysis.biases || !analysis.scores || !analysis.explanations) {
                throw new Error('Invalid analysis structure');
            }

            // Create array of bias objects with their scores
            const biasObjects = analysis.biases.map((bias, index) => ({
                bias,
                score: analysis.scores[index],
                explanation: analysis.explanations[index]
            }));

            // Sort by score in descending order
            biasObjects.sort((a, b) => b.score - a.score);

            // Take top N results based on the input parameter
            const topResults = biasObjects.slice(0, topN);

            // Format results
            return {
                biases: topResults.map(obj => obj.bias),
                scores: topResults.map(obj => obj.score),
                explanations: topResults.map(obj => obj.explanation)
            };
        } catch (error) {
            console.error('Error processing analysis results:', error);
            throw error;
        }
    }
} 