module.exports = {
    runTask: async function () {
        try {
            // Configuration constants
            const MIN_SCORE = 0;
            const MAX_SCORE = 10;
            const MIN_WORDS = 50;
            const MAX_WORDS = 100;

            // Define colors for personalities
            const colors = [
                'rgb(54, 162, 235)',  // Blue
                'rgb(255, 99, 132)',  // Red
                'rgb(75, 192, 192)',  // Teal
                'rgb(153, 102, 255)', // Purple
                'rgb(255, 159, 64)',  // Orange
                'rgb(255, 205, 86)',  // Yellow
                'rgb(201, 203, 207)', // Gray
                'rgb(0, 128, 0)',     // Green
                'rgb(128, 0, 128)',   // Dark Purple
                'rgb(0, 0, 128)'      // Navy
            ];

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

            // Load canvas using require
            const { createCanvas } = require('canvas');

            // Get unique bias types from the first personality's biases
            const biasTypes = [...new Set(allPersonalityExplanations[0].scored_biases.map(b => b.bias_type))];

            const balanceCanvasWidth = 1200;
            const balanceCanvasHeight = 1200;

            // Calculate percentage-based measurements
            const topPadding = Math.floor(balanceCanvasHeight * 0.005); // 0.5% from top
            const bottomPadding = Math.floor(balanceCanvasHeight * 0.005); // 0.5% from bottom
            const leftPadding = Math.floor(balanceCanvasWidth * 0.01); // 1% from left for bias names

            // Define font sizes
            const titleFontSize = Math.floor(balanceCanvasHeight * 0.02); // 2%
            const biasNameFontSize = Math.floor(balanceCanvasHeight * 0.015); // 1.5%
            const scoresFontSize = Math.floor(balanceCanvasHeight * 0.02); // 2%
            const legendFontSize = Math.floor(balanceCanvasHeight * 0.02); // 2%

            // Create and setup canvas
            const strengthCanvas = createCanvas(balanceCanvasWidth, balanceCanvasHeight);
            const strengthCtx = strengthCanvas.getContext('2d');

            // Set white background
            strengthCtx.fillStyle = 'white';
            strengthCtx.fillRect(0, 0, balanceCanvasWidth, balanceCanvasHeight);

            // Draw title at 0.5% from top
            strengthCtx.font = `${titleFontSize}px Arial`;
            strengthCtx.fillStyle = 'black';
            strengthCtx.textAlign = 'center';
            strengthCtx.fillText('Bias Score Distribution', balanceCanvasWidth / 2, topPadding + titleFontSize);

            // Draw personality colors under title
            const personalityY = topPadding + titleFontSize + legendFontSize + 5;
            const personalitySpacing = Math.floor(balanceCanvasWidth / (allPersonalityExplanations.length + 1));
            allPersonalityExplanations.forEach((personality, index) => {
                const x = leftPadding + (personalitySpacing * (index + 1));
                strengthCtx.fillStyle = colors[index];
                strengthCtx.beginPath();
                strengthCtx.arc(x - 40, personalityY, Math.floor(balanceCanvasHeight * 0.01), 0, 2 * Math.PI);
                strengthCtx.fill();
                strengthCtx.fillStyle = 'black';
                strengthCtx.font = `${legendFontSize}px Arial`;
                strengthCtx.textAlign = 'left';
                strengthCtx.fillText(personality.personality, x, personalityY + 5);
            });

            // Calculate spaces - ensure we stay within canvas
            const headerHeight = personalityY + legendFontSize + 10; // Space for title and personalities
            const footerHeight = legendFontSize + bottomPadding; // Space for legend text at bottom
            const availableHeight = balanceCanvasHeight - headerHeight - footerHeight;
            const frameHeight = availableHeight / biasTypes.length;

            // Draw frames for each bias type
            biasTypes.forEach((biasType, index) => {
                const frameY = headerHeight + (index * frameHeight);
                const centerX = balanceCanvasWidth / 2;

                // Draw alternating background
                strengthCtx.fillStyle = index % 2 === 0 ? '#f0f0f0' : '#ffffff';
                strengthCtx.fillRect(0, frameY, balanceCanvasWidth, frameHeight);

                // Draw center line
                strengthCtx.strokeStyle = '#000000';
                strengthCtx.beginPath();
                strengthCtx.moveTo(centerX, frameY);
                strengthCtx.lineTo(centerX, frameY + frameHeight);
                strengthCtx.stroke();

                // Draw bias name at 1% from left with bias name font size
                strengthCtx.font = `${biasNameFontSize}px Arial`;
                strengthCtx.fillStyle = 'black';
                strengthCtx.textAlign = 'left';

                // Split bias name into lines of max 2 words
                function splitIntoLines(text) {
                    const words = text.split(' ');
                    const lines = [];
                    for (let i = 0; i < words.length; i += 2) {
                        if (i + 1 < words.length) {
                            lines.push(words[i] + ' ' + words[i + 1]);
                        } else {
                            lines.push(words[i]);
                        }
                    }
                    return lines;
                }

                const lines = splitIntoLines(biasType);
                const lineHeight = biasNameFontSize * 1.2; // Add some spacing between lines
                const totalTextHeight = lineHeight * lines.length;
                const textStartY = frameY + (frameHeight - totalTextHeight) / 2 + biasNameFontSize; // Center text block in frame

                lines.forEach((line, index) => {
                    strengthCtx.fillText(line, leftPadding, textStartY + (index * lineHeight));
                });

                // Calculate bar dimensions
                const biasLabelWidth = Math.floor(balanceCanvasWidth * 0.2); // Fixed 20% width for bias labels
                const maxBarWidth = (balanceCanvasWidth / 2) - leftPadding - biasLabelWidth - Math.floor(balanceCanvasHeight * 0.01);
                const barHeight = Math.floor(frameHeight * 0.2);

                // Calculate bar positions for multiple personalities
                allPersonalityExplanations.forEach((personality, pIndex) => {
                    const bias = personality.scored_biases.find(b => b.bias_type === biasType);
                    if (bias) {
                        // Calculate vertical position to center bars as a group
                        const totalBarSpace = barHeight * allPersonalityExplanations.length;
                        const gapBetweenBars = (frameHeight - totalBarSpace) / (allPersonalityExplanations.length + 1);
                        const barY = frameY + gapBetweenBars + (pIndex * (barHeight + gapBetweenBars));

                        // Draw against score (left side)
                        const againstWidth = (bias.against_score / 10) * maxBarWidth;
                        strengthCtx.fillStyle = colors[pIndex];
                        strengthCtx.fillRect(centerX - againstWidth, barY, againstWidth, barHeight);

                        // Draw for score (right side)
                        const forWidth = (bias.for_score / 10) * maxBarWidth;
                        strengthCtx.fillRect(centerX, barY, forWidth, barHeight);

                        // Draw score values centered to their bars
                        strengthCtx.font = `${scoresFontSize}px Arial`;
                        strengthCtx.fillStyle = 'black';
                        strengthCtx.textAlign = 'right';
                        strengthCtx.fillText(-bias.against_score, centerX - againstWidth - 5, barY + (barHeight/2) + (scoresFontSize/3));
                        strengthCtx.textAlign = 'left';
                        strengthCtx.fillText(bias.for_score, centerX + forWidth + 5, barY + (barHeight/2) + (scoresFontSize/3));
                    }
                });
            });

            // Draw "Against Score" and "For Score" at bottom with 2% font size
            strengthCtx.font = `${legendFontSize}px Arial`;
            strengthCtx.fillStyle = 'black';
            strengthCtx.textAlign = 'center';
            strengthCtx.fillText('Against Score', balanceCanvasWidth * 0.25, balanceCanvasHeight - bottomPadding);
            strengthCtx.fillText('For Score', balanceCanvasWidth * 0.75, balanceCanvasHeight - bottomPadding);

            // Draw personality colors under title with 2% font size
            const balancePersonalityY = topPadding + titleFontSize + legendFontSize + 5;
            const balancePersonalitySpacing = Math.floor(balanceCanvasWidth / (allPersonalityExplanations.length + 1));
            allPersonalityExplanations.forEach((personality, index) => {
                const x = leftPadding + (balancePersonalitySpacing * (index + 1));
                strengthCtx.fillStyle = colors[index];
                strengthCtx.beginPath();
                strengthCtx.arc(x - 40, balancePersonalityY, Math.floor(balanceCanvasHeight * 0.01), 0, 2 * Math.PI);
                strengthCtx.fill();
                strengthCtx.fillStyle = 'black';
                strengthCtx.font = `${legendFontSize}px Arial`;
                strengthCtx.textAlign = 'left';
                strengthCtx.fillText(personality.personality, x, balancePersonalityY + 5);
            });

            // Convert canvas to buffer
            const buffer = strengthCanvas.toBuffer('image/png');

            // Upload image
            this.logInfo("Uploading image to AssistOS...");
            let balanceImageId;
            try {
                balanceImageId = await spaceModule.putImage(buffer);
                this.logInfo("Image uploaded successfully. Image ID:", balanceImageId);
            } catch (uploadError) {
                this.logError("Failed to upload image:", uploadError.message);
                throw uploadError;
            }

            // =============================================
            // Intensity DIAGRAMS: Split For and Against Analysis
            // =============================================

            const canvasWidth = 1200;
            const canvasHeight = 720;
            const padding = Math.floor(canvasHeight * 0.1);
            const biasNameDistance = Math.floor(canvasHeight * 0.08);

            // Create canvas for Against biases
            const againstCanvas = createCanvas(canvasWidth, canvasHeight);
            const againstCtx = againstCanvas.getContext('2d');

            // Set white background
            againstCtx.fillStyle = 'white';
            againstCtx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw title
            againstCtx.font = `bold ${Math.floor(canvasHeight * 0.03)}px Arial`;
            againstCtx.textAlign = 'center';
            againstCtx.fillStyle = 'black';
            againstCtx.fillText('Against Biases Multi-Personality Bias Intensity Analysis', canvasWidth/2, Math.floor(canvasHeight * 0.09)); // Move down 1% (from 0.08 to 0.09)

            // Calculate dimensions for the chart area
            const chartWidth = canvasWidth - (padding * 2);
            const chartHeight = canvasHeight - (padding * 3);
            const barWidth = Math.floor(chartWidth / (biasTypes.length * 2));

            // Draw grid lines
            againstCtx.strokeStyle = '#ddd';
            againstCtx.lineWidth = 1;
            for(let i = 0; i <= 10; i++) {
                const y = padding + chartHeight - (i * chartHeight/10);
                againstCtx.beginPath();
                againstCtx.setLineDash([5, 5]);
                againstCtx.moveTo(padding, y);
                againstCtx.lineTo(canvasWidth - padding, y);
                againstCtx.stroke();
                againstCtx.setLineDash([]);

                // Add Y-axis labels
                againstCtx.font = `${Math.floor(canvasHeight * 0.03)}px Arial`;
                againstCtx.textAlign = 'right';
                againstCtx.fillStyle = 'black';
                againstCtx.fillText(i.toString(), padding - 5, y + 5);
            }

            // Draw vertical dotted lines for each bias type
            biasTypes.forEach((_, typeIndex) => {
                const x = padding + (typeIndex * barWidth * 2) + barWidth/2;
                againstCtx.beginPath();
                againstCtx.setLineDash([5, 5]);
                againstCtx.moveTo(x, padding);
                againstCtx.lineTo(x, padding + chartHeight);
                againstCtx.stroke();
                againstCtx.setLineDash([]);
            });

            // Function to split bias name into lines of max 2 words
            function splitBiasName(biasName) {
                const words = biasName.split(' ');
                const lines = [];
                for (let i = 0; i < words.length; i += 2) {
                    if (i + 1 < words.length) {
                        lines.push(words[i] + ' ' + words[i + 1]);
                    } else {
                        lines.push(words[i]);
                    }
                }
                return lines;
            }

            // Draw bars for each bias type and personality
            biasTypes.forEach((biasType, typeIndex) => {
                const x = padding + (typeIndex * barWidth * 2) + barWidth/2;

                // Calculate center position based on number of personalities
                const numPersonalities = allPersonalityExplanations.length;
                let centerOffset;

                if (numPersonalities === 1) {
                    // For one personality, stay at start of bar
                    centerOffset = 0;
                } else {
                    // For multiple personalities, calculate the total width of all bars
                    const singleBarWidth = barWidth/numPersonalities;
                    const totalBarsWidth = singleBarWidth * numPersonalities;
                    // Center between first and last bar
                    centerOffset = (totalBarsWidth - singleBarWidth) / 2;
                }

                // Draw bias name at bottom, centered based on number of personalities
                againstCtx.save();
                againstCtx.translate(x - barWidth/4 + centerOffset, padding + chartHeight + biasNameDistance);
                againstCtx.rotate(-Math.PI/4);
                againstCtx.font = `${Math.floor(canvasHeight * 0.01875)}px Arial`;
                againstCtx.textAlign = 'center';
                againstCtx.fillStyle = 'black';

                // Split and draw bias name in lines
                const lines = splitBiasName(biasType);
                const lineHeight = Math.floor(canvasHeight * 0.02);
                // Calculate total height of text block to center it
                const totalHeight = lineHeight * (lines.length - 1);
                // Move starting position up by half the total height to center the text block
                const startY = -totalHeight / 2;

                lines.forEach((line, index) => {
                    againstCtx.fillText(line, 0, startY + (index * lineHeight));
                });
                againstCtx.restore();

                // Draw bars for each personality
                allPersonalityExplanations.forEach((personality, pIndex) => {
                    const bias = personality.scored_biases.find(b => b.bias_type === biasType);
                    if (bias) {
                        const score = bias.against_score;
                        // If score is 0, show a tiny bar (1% height)
                        const barHeight = score === 0 ?
                            Math.floor(chartHeight * 0.01) :
                            (score/10) * chartHeight;

                        againstCtx.fillStyle = colors[pIndex];
                        againstCtx.fillRect(
                            x + (pIndex * barWidth/allPersonalityExplanations.length) - barWidth/4,
                            padding + chartHeight - barHeight,
                            barWidth/allPersonalityExplanations.length,
                            barHeight
                        );
                    }
                });
            });

            // Add legend closer to the top
            const legendY = Math.floor(canvasHeight * 0.03);
            const legendSpacing = Math.floor(canvasWidth / (allPersonalityExplanations.length + 1));
            allPersonalityExplanations.forEach((personality, index) => {
                const x = legendSpacing * (index + 1);
                againstCtx.fillStyle = colors[index];
                againstCtx.beginPath();
                againstCtx.arc(x - 40, legendY, Math.floor(canvasHeight * 0.015), 0, 2 * Math.PI);
                againstCtx.fill();
                againstCtx.fillStyle = 'black';
                againstCtx.font = `${Math.floor(canvasHeight * 0.03)}px Arial`;
                againstCtx.textAlign = 'left';
                againstCtx.fillText(personality.personality, x - 20, legendY + 5);
            });

            // Similar adjustments for the For biases canvas...
            const forCanvas = createCanvas(canvasWidth, canvasHeight);
            const forCtx = forCanvas.getContext('2d');

            // Set white background
            forCtx.fillStyle = 'white';
            forCtx.fillRect(0, 0, canvasWidth, canvasHeight);

            // Draw title
            forCtx.font = `bold ${Math.floor(canvasHeight * 0.03)}px Arial`;
            forCtx.textAlign = 'center';
            forCtx.fillStyle = 'black';
            forCtx.fillText('For Biases Multi-Personality Bias Intensity Analysis', canvasWidth/2, Math.floor(canvasHeight * 0.09)); 

            // Calculate dimensions for the chart area
            const chartWidthFor = canvasWidth - (padding * 2);
            const chartHeightFor = canvasHeight - (padding * 3);
            const barWidthFor = Math.floor(chartWidthFor / (biasTypes.length * 2));

            // Draw grid lines
            forCtx.strokeStyle = '#ddd';
            forCtx.lineWidth = 1;
            for(let i = 0; i <= 10; i++) {
                const y = padding + chartHeightFor - (i * chartHeightFor/10);
                forCtx.beginPath();
                forCtx.setLineDash([5, 5]);
                forCtx.moveTo(padding, y);
                forCtx.lineTo(canvasWidth - padding, y);
                forCtx.stroke();
                forCtx.setLineDash([]);

                // Add Y-axis labels
                forCtx.font = `${Math.floor(canvasHeight * 0.03)}px Arial`;
                forCtx.textAlign = 'right';
                forCtx.fillStyle = 'black';
                forCtx.fillText(i.toString(), padding - 5, y + 5);
            }

            // Draw vertical dotted lines for each bias type
            biasTypes.forEach((_, typeIndex) => {
                const x = padding + (typeIndex * barWidthFor * 2) + barWidthFor/2;
                forCtx.beginPath();
                forCtx.setLineDash([5, 5]);
                forCtx.moveTo(x, padding);
                forCtx.lineTo(x, padding + chartHeightFor);
                forCtx.stroke();
                forCtx.setLineDash([]);
            });

            // Draw bars for each bias type and personality
            biasTypes.forEach((biasType, typeIndex) => {
                const x = padding + (typeIndex * barWidthFor * 2) + barWidthFor/2;

                // Calculate center position based on the number of personalities
                const numPersonalities = allPersonalityExplanations.length;
                let centerOffset;

                if (numPersonalities === 1) {
                    // For one personality, stay at start of bar
                    centerOffset = 0;
                } else {
                    // For multiple personalities, calculate the total width of all bars
                    const singleBarWidth = barWidthFor/numPersonalities;
                    const totalBarsWidth = singleBarWidth * numPersonalities;
                    // Center between first and last bar
                    centerOffset = (totalBarsWidth - singleBarWidth) / 2;
                }

                // Draw bias name at bottom, centered based on number of personalities
                forCtx.save();
                forCtx.translate(x - barWidthFor/4 + centerOffset, padding + chartHeightFor + biasNameDistance);
                forCtx.rotate(-Math.PI/4);
                forCtx.font = `${Math.floor(canvasHeight * 0.01875)}px Arial`;
                forCtx.textAlign = 'center';
                forCtx.fillStyle = 'black';

                // Split and draw bias name in lines
                const lines = splitBiasName(biasType);
                const lineHeight = Math.floor(canvasHeight * 0.02);
                // Calculate total height of text block to center it
                const totalHeight = lineHeight * (lines.length - 1);
                // Move starting position up by half the total height to center the text block
                const startY = -totalHeight / 2;

                lines.forEach((line, index) => {
                    forCtx.fillText(line, 0, startY + (index * lineHeight));
                });
                forCtx.restore();

                // Draw bars for each personality
                allPersonalityExplanations.forEach((personality, pIndex) => {
                    const bias = personality.scored_biases.find(b => b.bias_type === biasType);
                    if (bias) {
                        const score = bias.for_score;
                        // If score is 0, show a tiny bar (1% height)
                        const barHeight = score === 0 ?
                            Math.floor(chartHeightFor * 0.01) :
                            (score/10) * chartHeightFor;

                        forCtx.fillStyle = colors[pIndex];
                        forCtx.fillRect(
                            x + (pIndex * barWidthFor/allPersonalityExplanations.length) - barWidthFor/4,
                            padding + chartHeightFor - barHeight,
                            barWidthFor/allPersonalityExplanations.length,
                            barHeight
                        );
                    }
                });
            });

            // Add legend closer to the top
            const legendYFor = Math.floor(canvasHeight * 0.03);
            const legendSpacingFor = Math.floor(canvasWidth / (allPersonalityExplanations.length + 1));
            allPersonalityExplanations.forEach((personality, index) => {
                const x = legendSpacingFor * (index + 1);
                forCtx.fillStyle = colors[index];
                forCtx.beginPath();
                forCtx.arc(x - 40, legendYFor, Math.floor(canvasHeight * 0.015), 0, 2 * Math.PI);
                forCtx.fill();
                forCtx.fillStyle = 'black';
                forCtx.font = `${Math.floor(canvasHeight * 0.03)}px Arial`;
                forCtx.textAlign = 'left';
                forCtx.fillText(personality.personality, x - 20, legendYFor + 5);
            });

            // Upload images
            this.logInfo("Uploading images to AssistOS...");
            const againstBuffer = againstCanvas.toBuffer('image/png');
            const forBuffer = forCanvas.toBuffer('image/png');
            let againstImageId, forImageId;
            try {
                againstImageId = await spaceModule.putImage(againstBuffer);
                forImageId = await spaceModule.putImage(forBuffer);
                this.logInfo("Images uploaded successfully. Against Image ID:", againstImageId);
                this.logInfo("For Image ID:", forImageId);
            } catch (uploadError) {
                this.logError("Failed to upload images:", uploadError.message);
                throw uploadError;
            }

            // =============================================
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

            // Add balance diagram
            await documentModule.addParagraph(this.spaceId, documentId, visualChapterId, {
                text: "Comparison of total bias strength:",
                commands: {
                    image: {
                        id: balanceImageId
                    }
                }
            });

            // Add against biases diagram
            await documentModule.addParagraph(this.spaceId, documentId, visualChapterId, {
                text: "Against biases intensity analysis:",
                commands: {
                    image: {
                        id: againstImageId
                    }
                }
            });

            // Add for biases diagram
            await documentModule.addParagraph(this.spaceId, documentId, visualChapterId, {
                text: "For biases intensity analysis:",
                commands: {
                    image: {
                        id: forImageId
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