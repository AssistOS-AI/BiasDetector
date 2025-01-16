import {RoutingService} from "../../services/RoutingService.js";
import {BiasAnalysisService} from "../../services/BiasAnalysisService.js";

export class BiasDetectorPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.biasService = new BiasAnalysisService();
        this.invalidate();
    }

    async beforeRender() {
        // Display received parameters
        const receivedParams = this.element.querySelector('#receivedParams');
        if (receivedParams) {
            const text = this.element.getAttribute('data-text');
            const params = {
                text: text ? `${text.substring(0, 100)}...` : undefined,
                textLength: text ? text.length : 0,
                prompt: this.element.getAttribute('data-prompt'),
                personality: this.element.getAttribute('data-personality'),
                topBiases: this.element.getAttribute('data-top-biases')
            };
            receivedParams.innerHTML = `Received at ${new Date().toISOString()}:\n${JSON.stringify(params, null, 2)}`;
        }
    }

    async afterRender() {
        // Setup and start analysis
        this.setupEventListeners();
        await this.analyze();
    }

    // Add helper function to format bias names
    formatBiasName(biasName) {
        return biasName
            .replace(/_/g, ' ') // Replace underscores with spaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter of each word
            .join(' ');
    }

    setupEventListeners() {
        const backBtn = this.element.querySelector('#backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', async () => {
                await RoutingService.navigateInternal('bias-detector-landing', {});
            });
        }
    }

    async analyze() {
        const analysisResults = this.element.querySelector('#analysisResults');
        try {
            const text = this.element.getAttribute('data-text');
            const prompt = this.element.getAttribute('data-prompt');
            const personality = this.element.getAttribute('data-personality');
            const topBiases = parseInt(this.element.getAttribute('data-top-biases')) || 5;

            // Log initial parameters as an object
            console.log('Analysis Parameters:', {
                textPreview: text ? text.substring(0, 100) + '...' : 'undefined',
                textLength: text ? text.length : 0,
                prompt,
                personality,
                topBiases
            });

            if (!text || !personality) {
                throw new Error('Missing required parameters');
            }

            this.biasService.setPersonality(personality);
            this.biasService.setAnalysisPrompt(prompt);
            const biasResults = await this.biasService.analyzeText(text, topBiases);

            // Log analysis results as a structured object
            console.log('Analysis Results:', {
                biases: biasResults.biases,
                scores: biasResults.scores,
                explanations: biasResults.explanations // Full explanations without truncation
            });

            // Update visualization
            this.updateVisualization(biasResults);

            // Update results
            this.updateResults(biasResults);

        } catch (error) {
            console.error('Error during analysis:', error);
            if (analysisResults) {
                analysisResults.innerHTML += `\n\nError occurred:\n${error.message}`;
            }
        }
    }

    updateVisualization(biasResults) {
        if (!biasResults || !biasResults.biases || !biasResults.scores) {
            console.error('Invalid bias results for visualization');
            return;
        }

        const svg = this.element.querySelector('svg');
        if (!svg) {
            console.error('SVG element not found');
            return;
        }

        const width = parseInt(svg.getAttribute('width'));
        const height = parseInt(svg.getAttribute('height'));
        const leftPadding = width * 0.15; // 15% of width for left padding
        const rightPadding = width * 0.1; // 10% of width for right padding
        const bottomPadding = 70; // Extra padding for bottom labels
        const graphHeight = height - bottomPadding;
        const graphWidth = width - (leftPadding + rightPadding);
        const radius = Math.min(graphWidth / 2, height - bottomPadding) * 0.8; // Adjusted radius calculation

        // Get SVG groups
        const quadrants = svg.querySelector('#quadrants');
        const axes = svg.querySelector('#axes');
        const points = svg.querySelector('#points');
        const labels = svg.querySelector('#labels');

        if (!quadrants || !axes || !points || !labels) {
            console.error('Required SVG groups not found');
            return;
        }

        // Draw grid lines first
        const gridLines = [];
        for (let i = -10; i <= 10; i += 2) {
            // For vertical lines, map i directly to x position
            const x = leftPadding + ((i + 10) * radius / 10);
            // For horizontal lines, keep the same mapping
            const y = graphHeight - ((i + 10) * radius / 10);

            // Vertical grid lines
            gridLines.push(`
                <line class="scale-line" x1="${x}" y1="${graphHeight - 2 * radius}" x2="${x}" y2="${graphHeight}" />
            `);

            // Horizontal grid lines
            gridLines.push(`
                <line class="scale-line" x1="${leftPadding}" y1="${y}" x2="${leftPadding + 2 * radius}" y2="${y}" />
            `);
        }

        // Add zero reference lines with lighter style
        const zeroX = leftPadding + (10 * radius / 10); // X position for vertical zero line
        const zeroY = graphHeight - (10 * radius / 10); // Y position for horizontal zero line

        gridLines.push(`
            <!-- Vertical zero line -->
            <line class="zero-line" x1="${zeroX}" y1="${graphHeight - 2 * radius}" x2="${zeroX}" y2="${graphHeight}" 
                  style="stroke: #ccc; stroke-width: 1; stroke-opacity: 0.5;" />
            <!-- Horizontal zero line -->
            <line class="zero-line" x1="${leftPadding}" y1="${zeroY}" x2="${leftPadding + 2 * radius}" y2="${zeroY}"
                  style="stroke: #ccc; stroke-width: 1; stroke-opacity: 0.5;" />
        `);

        quadrants.innerHTML = gridLines.join('');

        // Draw main axes
        axes.innerHTML = `
            <!-- X-axis -->
            <line class="axis-line" x1="${leftPadding}" y1="${graphHeight}" x2="${leftPadding + 2 * radius}" y2="${graphHeight}" />
            <!-- Y-axis -->
            <line class="axis-line" x1="${leftPadding}" y1="${graphHeight}" x2="${leftPadding}" y2="${graphHeight - 2 * radius}" />
            
            <!-- Axis labels -->
            <text x="${leftPadding + 2 * radius + 20}" y="${graphHeight + 20}" class="axis-label">Bias Strength</text>
            <text x="${leftPadding - 40}" y="${graphHeight - 2 * radius - 10}" class="axis-label">Bias Impact</text>
            
            <!-- Scale markers -->
            ${Array.from({length: 11}, (_, i) => {
            const value = i * 2 - 10; // Values from -10 to 10
            // For x-axis values, map them directly
            const x = leftPadding + ((value + 10) * radius / 10);
            // For y-axis values, keep the same mapping
            const yPos = graphHeight - ((value + 10) * radius / 10);
            return `
                    <text x="${x}" y="${graphHeight + 20}" class="scale-text">${value}</text>
                    <text x="${leftPadding - 25}" y="${yPos}" class="scale-text">${value}</text>
                `;
        }).join('')}
        `;

        // Clear existing points and labels
        points.innerHTML = '';
        labels.innerHTML = '';

        // Draw points and labels
        biasResults.biases.forEach((bias, index) => {
            const score = biasResults.scores[index];

            // Calculate position (x is score mapped to -10 to 10 range, y is impact)
            const x = leftPadding + ((score + 10) * radius / 10); // Map score to x position
            const y = graphHeight - ((score + 10) * radius / 10); // Keep same y mapping

            // Add point
            const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            point.setAttribute("class", "bias-point");
            point.setAttribute("cx", x);
            point.setAttribute("cy", y);
            point.setAttribute("r", "5");
            point.setAttribute("fill", "#007bff");
            point.setAttribute("stroke", "#0056b3");
            points.appendChild(point);

            // Add score label above point
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("class", "bias-label");
            label.setAttribute("x", x);
            label.setAttribute("y", y - 15); // Position 15 pixels above the point
            label.setAttribute("text-anchor", "middle"); // Center the text above the point
            label.setAttribute("dominant-baseline", "auto");
            label.textContent = score.toFixed(1);
            labels.appendChild(label);
        });
    }

    updateResults(biasResults) {
        if (!biasResults || !biasResults.biases) {
            console.error('Invalid bias results for display');
            return;
        }

        const resultsContainer = this.element.querySelector('#biasResults');
        if (!resultsContainer) {
            console.error('Results container not found');
            return;
        }

        // Create HTML with full explanations
        const resultsHtml = biasResults.biases.map((bias, index) => {
            const score = biasResults.scores[index];
            const explanation = biasResults.explanations[index];
            const formattedBiasName = this.formatBiasName(bias);

            return `
                <div class="bias-item">
                    <div class="bias-name">${formattedBiasName}</div>
                    <div class="bias-score">Score: ${score.toFixed(2)}</div>
                    <div class="bias-explanation">${explanation}</div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHtml;
    }
} 