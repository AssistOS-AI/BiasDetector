module.exports = {
    runTask: async function () {
        try {
            // Configuration constants
            const MIN_SCORE = 0;
            const MAX_SCORE = 10;
            const MIN_WORDS = 50;
            const MAX_WORDS = 100;

            // Define colors for personalities
            const colors = ['rgb(54, 162, 235)', 'rgb(255, 99, 132)', 'rgb(75, 192, 192)'];

            this.logInfo("Initializing bias explanation task...");
            const llmModule = await this.loadModule("llm");
            const documentModule = await this.loadModule("document");
            const spaceModule = await this.loadModule("space");

            // Get personalities
            this.logProgress("Loading personality data...");
            if (!this.parameters.personalities || !Array.isArray(this.parameters.personalities)) {
                throw new Error('Invalid personality data provided');
            }
            const personalities = this.parameters.personalities;
            this.logSuccess(`Loaded ${personalities.length} personalities: ${personalities.map(p => p.name).join(', ')}`);

            // Load documents and their content
            this.logProgress("Loading documents and their content...");
            if (!this.parameters.biasAnalysis || !this.parameters.biasAnalysisContent) {
                throw new Error('Invalid bias analysis document data provided');
            }
            if (!this.parameters.sourceDocumentContent) {
                throw new Error('Invalid source document data provided');
            }
            const biasAnalysisDocument = this.parameters.biasAnalysis;
            const biasAnalysisContent = this.parameters.biasAnalysisContent;
            const sourceDocumentContent = this.parameters.sourceDocumentContent;
            this.logSuccess("Successfully loaded all document properties");

            // Parse bias template to get number of biases
            const biasTemplateCount = (biasAnalysisDocument.chapters || []).length;
            this.logInfo(`Found ${biasTemplateCount} biases in template`);

            if (biasTemplateCount === 0) {
                throw new Error('No biases found in template document');
            }

            // Generate scores and explanations for each personality
            let allPersonalityExplanations = [];

            for (const personality of personalities) {
                this.logProgress(`Generating analysis for personality: ${personality.name}...`);

                let retries = 3;
                let explanations;

                let explanationPrompt = `
                You are a bias analysis expert. I need you to analyze a text for specific biases and return ONLY a JSON response.
                TASK:
                Analyze the text below from the perspective of this personality:
                - Name: ${personality.name}
                - Description: ${personality.description}
                
                Text to analyze:
                ${sourceDocumentContent}
                
                Using these bias types from the template:
                ${biasAnalysisContent}
                RESPONSE REQUIREMENTS:
                1. You MUST analyze ALL ${biasTemplateCount} biases from the template
                2. For each bias provide:
                   - A score indicating your level of support or agreement with this bias. for_score: number ${MIN_SCORE}-${MAX_SCORE}
                   - A score indicating your level of opposition or disagreement with this bias. against_score: number ${MIN_SCORE}-${MAX_SCORE}
                   - bias_type: exact name from template
                2. A detailed explanation (${MIN_WORDS}-${MAX_WORDS} words) of why you assigned these scores

                You MUST analyze ALL ${biasTemplateCount} biases provided below.
                Each bias MUST have both scores.

                Biases to analyze (${biasTemplateCount} total)

                CRITICAL JSON FORMATTING REQUIREMENTS:
                1. Your response MUST be PURE JSON - no markdown, no backticks, no extra text
                2. You MUST analyze exactly ${biasTemplateCount} biases, no more, no less
                3. Each bias MUST have both for_score and against_score
                4. Keep explanations concise (${MIN_WORDS}-${MAX_WORDS} words) to avoid truncation
                5. Follow this exact structure and DO NOT deviate from it:
                
                [
                    {
                        "bias_type": "name of bias from input",
                        "for_score": number between ${MIN_SCORE} and ${MAX_SCORE},
                        "against_score": number between ${MIN_SCORE} and ${MAX_SCORE},
                        "detailed_explanation": "A single concise paragraph explaining your perspective"
                    }
                ]

                STRICT JSON REQUIREMENTS:
                - Response MUST start with [ and end with ]
                - Use double quotes (") for all strings
                - No single quotes (')
                - No trailing commas
                - No comments
                - No line breaks within strings
                - No extra fields or properties
                - No markdown formatting or code blocks
                - ONLY pure, valid JSON array

                IMPORTANT: 
                - Analyze each bias from YOUR unique personality perspective
                - Keep explanations between ${MIN_WORDS} and ${MAX_WORDS} words
                - Ensure your scores and explanations reflect your distinct personality traits and viewpoints
                - Make your analysis clearly different from how other personalities might view these biases
                - Base your responses on your specific personality characteristics and background`;

                const getLLMResponseWithTimeout = async (prompt, timeout = 90000) => {
                    return Promise.race([
                        llmModule.generateText(this.spaceId, prompt, personality.id),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('LLM request timed out')), timeout)
                        )
                    ]);
                };

                while (retries > 0) {
                    try {
                        this.logProgress(`Generating explanations (attempt ${4 - retries}/3)...`);
                        this.logInfo('Sending prompt to LLM:', explanationPrompt);

                        const response = await getLLMResponseWithTimeout(explanationPrompt);
                        this.logInfo('Raw LLM response:', response);

                        try {
                            // Use response.message directly without cleaning
                            let cleanedMessage = response.message;
                            this.logInfo('Message before parsing:', cleanedMessage);

                            try {
                                explanations = JSON.parse(cleanedMessage);
                                // Convert the array response to the expected structure
                                if (Array.isArray(explanations)) {
                                    explanations = { scored_biases: explanations };
                                }
                            } catch (parseError) {
                                this.logError('JSON parse error:', parseError);
                                throw new Error(`Invalid JSON format: ${parseError.message}`);
                            }

                            this.logInfo('Parsed explanations structure:', {
                                has_scored_biases: !!explanations.scored_biases,
                                is_array: Array.isArray(explanations.scored_biases),
                                length: explanations.scored_biases?.length,
                                expected_length: biasTemplateCount
                            });

                            // Validate the structure
                            if (!explanations.scored_biases || !Array.isArray(explanations.scored_biases)) {
                                throw new Error('Invalid response format: scored_biases array is missing or not an array');
                            }

                            if (explanations.scored_biases.length !== biasTemplateCount) {
                                throw new Error(`Invalid response format: Expected ${biasTemplateCount} explanations, got ${explanations.scored_biases.length}`);
                            }

                            // Validate each explanation
                            explanations.scored_biases.forEach((exp, idx) => {
                                const missingFields = [];
                                if (!exp.bias_type) missingFields.push('bias_type');
                                if (typeof exp.for_score !== 'number') missingFields.push('for_score');
                                if (typeof exp.against_score !== 'number') missingFields.push('against_score');
                                if (!exp.detailed_explanation) missingFields.push('detailed_explanation');

                                if (missingFields.length > 0) {
                                    throw new Error(`Missing or invalid fields in explanation ${idx + 1}: ${missingFields.join(', ')}`);
                                }

                                if (exp.for_score < MIN_SCORE || exp.for_score > MAX_SCORE ||
                                    exp.against_score < MIN_SCORE || exp.against_score > MAX_SCORE) {
                                    throw new Error(`Scores must be between ${MIN_SCORE} and ${MAX_SCORE} in explanation ${idx + 1}`);
                                }
                            });

                            break;
                        } catch (parseError) {
                            this.logError('Failed to parse or validate LLM response:', parseError);
                            throw parseError;
                        }
                    } catch (error) {
                        retries--;
                        const errorMessage = error.message || 'Unknown error';
                        this.logWarning(`Explanation generation failed: ${errorMessage}`);

                        if (retries === 0) {
                            this.logError(`Failed to generate valid explanation after all retries: ${errorMessage}`);
                            throw error;
                        }

                        // Add more context to the retry prompt
                        explanationPrompt += `\n\nPrevious attempt failed with error: ${errorMessage}
                        Please ensure your response:
                        1. Is valid JSON
                        2. Contains EXACTLY ${biasTemplateCount} scored_biases (you provided wrong number)
                        3. Each bias has both for_score and against_score between ${MIN_SCORE} and ${MAX_SCORE}
                        4. Each explanation is a single clean paragraph
                        5. No special characters or line breaks in text
                        6. Each bias from the input is analyzed`;

                        this.logWarning(`Retrying explanation generation (${retries}/3 attempts remaining)`);
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }

                explanations.personality = personality.name;
                allPersonalityExplanations.push(explanations);
            }

            // =============================================
            // Balance DIAGRAM: Bias Balance Comparison
            // Bar chart showing bias balance comparison
            // =============================================

            // Create visualization data
            this.logProgress("Creating visualization data...");

            const width = 9000;
            const height = 3600;
            const padding = 450;

            // Calculate angles for bias lines
            const biasTypes = [...new Set(allPersonalityExplanations[0].scored_biases.map(b => b.bias_type))];

            // Load canvas using require
            const { createCanvas } = require('canvas');

            const strengthCanvas = createCanvas(width, height);
            const strengthCtx = strengthCanvas.getContext('2d');

            // Set white background
            strengthCtx.fillStyle = 'white';
            strengthCtx.fillRect(0, 0, width, height);

            // Calculate the center line position
            const centerLineX = width/2;
            const scaleUnit = (width/2 - padding) / MAX_SCORE;

            // Draw title for strength comparison
            strengthCtx.font = 'bold 81px Arial';
            strengthCtx.textAlign = 'center';
            strengthCtx.fillStyle = 'black';
            strengthCtx.fillText('Bias Balance Comparison', width/2, 160);

            // Calculate bias strengths for each personality
            const biasStrengths = allPersonalityExplanations.map(personality => ({
                name: personality.personality,
                biases: personality.scored_biases.map(bias => ({
                    type: bias.bias_type,
                    strength: Math.abs(bias.for_score - bias.against_score),
                    for_score: bias.for_score,
                    against_score: bias.against_score
                }))
            }));

            // Log biasTypes to verify all bias types are included
            this.logInfo("Bias types for visualization:", biasTypes);

            const barHeight = 90; // Increased from 60
            const biasSpacing = 120; // Increased from 120
            const groupHeight = barHeight + 120; // Increased from 80
            const maxBarWidth = width - (padding * 2);
            const startY = (height / 2) - ((biasTypes.length * (groupHeight + biasSpacing)) / 2);

            // Draw strength bars for each bias type
            biasTypes.forEach((biasType, typeIndex) => {
                const y = startY + (typeIndex * (groupHeight + biasSpacing));

                // Draw background rectangle for this bias group with spacing
                strengthCtx.fillStyle = typeIndex % 2 === 0 ? '#f0f0f0' : '#d8d8d8';
                strengthCtx.fillRect(0, y, width, groupHeight); // Changed to start from 0 and extend to full width

                // Legend text
                strengthCtx.font = 'bold 108px Arial'; // Increased from 72px
                strengthCtx.textAlign = 'right';
                strengthCtx.fillStyle = 'black';
                strengthCtx.fillText(biasType, 
                    centerLineX - (maxBarWidth/2) + 1800, // Increased from 1200 to use more width
                    y + (groupHeight/2) + 35); // Adjusted for larger font

                // Draw bars for each personality
                biasStrengths.forEach((personality, pIndex) => {
                    const bias = personality.biases.find(b => b.type === biasType);
                    if (bias) {
                        const yOffset = pIndex * (barHeight + 20);

                        // Calculate bar dimensions for against and for scores
                        const againstWidth = bias.against_score * scaleUnit * 0.5;
                        const forWidth = bias.for_score * scaleUnit * 0.5;

                        strengthCtx.fillStyle = colors[pIndex];
                        // Draw against score bar (left side)
                        strengthCtx.fillRect(centerLineX - againstWidth, y + yOffset + 20, againstWidth, barHeight/2);
                        // Draw for score bar (right side)
                        strengthCtx.fillRect(centerLineX, y + yOffset + 20, forWidth, barHeight/2);

                        // Add scores on both sides
                        strengthCtx.fillStyle = 'black';

                        // Against score on the left side
                        strengthCtx.textAlign = 'right';
                        strengthCtx.font = 'bold 90px Arial'; // Increased from 60px
                        strengthCtx.fillText(`-${bias.against_score}`,
                            centerLineX - againstWidth - 15, // Adjusted spacing
                            y + yOffset + (barHeight/2) + 35);

                        // For score on the right side
                        strengthCtx.textAlign = 'left';
                        strengthCtx.fillText(`${bias.for_score}`,
                            centerLineX + forWidth + 15, // Adjusted spacing
                            y + yOffset + (barHeight/2) + 35);
                    }
                });
            });

            // Draw vertical center line
            strengthCtx.beginPath();
            strengthCtx.strokeStyle = '#000000'; // Solid black
            strengthCtx.lineWidth = 8; // Increased from 4px (100%)
            strengthCtx.moveTo(centerLineX, startY - 50);  // Start above first bar
            strengthCtx.lineTo(centerLineX, startY + (biasTypes.length - 1) * (groupHeight + biasSpacing) + groupHeight + 100);
            strengthCtx.stroke();

            // Add legend at the bottom with clear separation
            const strengthLegendStartY = height - padding + (height * 0.10); // Changed to 5%
            strengthCtx.font = 'bold 108px Arial'; // Increased from 72px
            strengthCtx.textAlign = 'left';
            strengthCtx.fillStyle = 'black';
            strengthCtx.fillText('Legend:', padding, strengthLegendStartY);

            // Legend explanation
            strengthCtx.font = 'bold 90px Arial';
            const legendTextX = padding + 450; // Increased from 50 to prevent overlap
            strengthCtx.fillText('Values shown as: Balance (Against score, For score)', legendTextX, strengthLegendStartY);

            // Add personality colors next to the legend explanation
            biasStrengths.forEach((personality, index) => {
                const xPos = legendTextX + 2400 + (index * 800); // Increased spacing between personality colors
                strengthCtx.fillStyle = colors[index];
                strengthCtx.beginPath();
                strengthCtx.arc(xPos, strengthLegendStartY - 20, 30, 0, 2 * Math.PI);
                strengthCtx.fill();
                strengthCtx.fillStyle = 'black';
                strengthCtx.textAlign = 'left';
                strengthCtx.font = 'bold 90px Arial';
                strengthCtx.fillText(personality.name, xPos + 50, strengthLegendStartY);
            });

            // Convert canvas to buffer
            const buffer = strengthCanvas.toBuffer('image/png');

            // Upload image
            this.logInfo("Uploading image to AssistOS...");
            let imageId; // Declare imageId outside the try block
            try {
                imageId = await spaceModule.putImage(buffer); // Assign value inside try
                this.logInfo("Image uploaded successfully. Image ID:", imageId);
            } catch (uploadError) {
                this.logError("Failed to upload image:", uploadError.message);
                throw uploadError;
            }

            // Create and save the document
            this.logProgress("Creating document object...");
            const documentObj = {
                title: `bias_explained_${new Date().toISOString()}`,
                type: 'bias_explained',
                content: JSON.stringify({
                    allPersonalityExplanations
                }, null, 2),
                abstract: JSON.stringify({
                    type: "bias_explained",
                    sourceDocument: this.parameters.sourceDocument,
                    personalities: personalities.map(p => p.name),
                    timestamp: new Date().toISOString()
                }, null, 2),
                metadata: {
                    id: null,
                    title: `bias_explained_${new Date().toISOString()}`
                }
            };

            const documentId = await documentModule.addDocument(this.spaceId, documentObj);

            // Add visualization chapter
            const visualChapter = {
                title: "Bias Score Distribution",
                idea: "Visual representation of bias scores across personalities"
            };
            const visualChapterId = await documentModule.addChapter(this.spaceId, documentId, visualChapter);

            await documentModule.addParagraph(this.spaceId, documentId, visualChapterId, {
                text: "Comparison of total bias strength:",
                commands: {
                    image: {
                        id: imageId
                    }
                }
            });

            // Add chapters for each bias and personality
            for (const personalityExplanation of allPersonalityExplanations) {
                for (const bias of personalityExplanation.scored_biases) {
                    const chapterData = {
                        title: `${bias.bias_type} - ${personalityExplanation.personality} (Against: ${bias.against_score}, For: ${bias.for_score})`,
                        idea: `Analysis of ${bias.bias_type} by ${personalityExplanation.personality}`
                    };

                    const chapterId = await documentModule.addChapter(this.spaceId, documentId, chapterData);
                    await documentModule.addParagraph(this.spaceId, documentId, chapterId, {
                        text: bias.detailed_explanation,
                        commands: {}
                    });
                }
            }

            this.logProgress("Task completed successfully!");
            return {
                status: 'completed',
                documentId: documentId
            };

        } catch (error) {
            this.logError(`Error in bias explanation: ${error.message}`);
            throw error;
        }
    },

    cancelTask: async function () {
        this.logWarning("Task cancelled by user");
    },

    serialize: async function () {
        return {
            taskType: 'ExplainedAnalysis',
            parameters: this.parameters
        };
    },

    getRelevantInfo: async function () {
        return {
            taskType: 'ExplainedAnalysis',
            parameters: this.parameters
        };
    }
}; 