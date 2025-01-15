const llmModule = require('assistos').loadModule('llm', {});

export class BiasAnalysisService {
    constructor() {
        this.personality = null;
    }

    setPersonality(personality) {
        this.personality = personality;
    }

    async analyzeText(text, topN = 5) {
        if (!this.personality) {
            throw new Error('Personality must be set before analysis');
        }

        // Use the personality's LLM to analyze the text
        const analysis = await this.detectBiases(text);
        return this.processAnalysisResults(analysis, topN);
    }

    async detectBiases(text) {
        try {
            // Prepare the analysis prompt
            const prompt = `
            Analyze the following text for potential biases. For each bias detected:
            1. Name the specific type of bias (keep it concise and clear)
            2. Rate its strength on a scale of 0-1 (use a decimal number)
            3. Provide a brief explanation (maximum 100 words) of why this bias is present
            
            You must respond in valid JSON format with this exact structure:
            {
                "biases": ["bias1", "bias2", ...],
                "scores": [0.8, 0.6, ...],
                "explanations": ["brief explanation 1", "brief explanation 2", ...]
            }

            IMPORTANT:
            - Keep explanations concise and clear
            - Do not repeat text or get stuck in loops
            - Ensure the response is valid JSON
            - Each explanation should be under 100 words

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
                        explanations: jsonResponse.explanations.slice(0, length).map(exp =>
                            exp.length > 100 ? exp.substring(0, 100) + '...' : exp
                        )
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