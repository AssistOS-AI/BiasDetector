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

    setupEventListeners() {
        const backBtn = this.element.querySelector('#backBtn');
        if (backBtn) {
            backBtn.addEventListener('click', async () => {
                await RoutingService.navigateInternal('bias-detector-landing', {});
            });
        }
    }

    prepareVisualizationData(biasResults) {
        if (!biasResults || !biasResults.biases || !biasResults.scores) {
            return [];
        }

        // Normalize scores to be between 0 and 1
        const maxScore = Math.max(...biasResults.scores);
        return biasResults.biases.map((bias, index) => ({
            name: bias,
            score: biasResults.scores[index] / (maxScore || 1)
        }));
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
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.4;

        // Get SVG groups
        const quadrants = svg.querySelector('#quadrants');
        const axes = svg.querySelector('#axes');
        const points = svg.querySelector('#points');
        const labels = svg.querySelector('#labels');

        if (!quadrants || !axes || !points || !labels) {
            console.error('Required SVG groups not found');
            return;
        }

        // Draw axis lines and labels
        const axisLength = radius * 1.2;
        axes.innerHTML = `
            <line class="axis-line" x1="${centerX - axisLength}" y1="${centerY}" x2="${centerX + axisLength}" y2="${centerY}" marker-end="url(#arrow)" marker-start="url(#arrow)"/>
            <line class="axis-line" x1="${centerX}" y1="${centerY + axisLength}" x2="${centerX}" y2="${centerY - axisLength}" marker-end="url(#arrow)" marker-start="url(#arrow)"/>
            <text x="${centerX + axisLength + 10}" y="${centerY + 20}" class="axis-label">Bias Strength</text>
            <text x="${centerX - 40}" y="${centerY - axisLength - 10}" class="axis-label">Bias Impact</text>
        `;

        // Draw scale markers
        const scaleLines = [];
        for (let i = -10; i <= 10; i += 2) {
            const x = centerX + (i * axisLength / 10);
            const y = centerY + (i * axisLength / 10);
            scaleLines.push(`
                <line class="scale-line" x1="${x}" y1="${centerY - 5}" x2="${x}" y2="${centerY + 5}"/>
                <line class="scale-line" x1="${centerX - 5}" y1="${y}" x2="${centerX + 5}" y2="${y}"/>
                <text x="${x}" y="${centerY + 20}" class="scale-text">${i}</text>
                <text x="${centerX - 25}" y="${y + 5}" class="scale-text">${-i}</text>
            `);
        }
        quadrants.innerHTML = scaleLines.join('');

        // Clear existing points and labels
        points.innerHTML = '';
        labels.innerHTML = '';

        // Calculate angles for radial layout
        const angleStep = (2 * Math.PI) / biasResults.biases.length;

        // Draw points and labels in a radial pattern
        biasResults.biases.forEach((bias, index) => {
            const angle = index * angleStep - Math.PI / 2; // Start from top
            const score = biasResults.scores[index];
            // Map the score (-10 to 10) to a position on the axis
            const distance = (score / 10) * radius;

            // Calculate position using polar coordinates
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;

            // Add point
            const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            point.setAttribute("class", "bias-point");
            point.setAttribute("cx", x);
            point.setAttribute("cy", y);
            point.setAttribute("r", "5");
            // Color based on score (red for negative, blue for positive)
            const color = score < 0 ? '#dc3545' : '#007bff';
            point.setAttribute("fill", color);
            point.setAttribute("stroke", score < 0 ? '#bd2130' : '#0056b3');
            points.appendChild(point);

            // Add label with score
            const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
            label.setAttribute("class", "bias-label");
            // Position label based on quadrant to avoid overlap
            const labelX = x + (Math.cos(angle) > 0 ? 10 : -10);
            const labelY = y + (Math.sin(angle) > 0 ? 20 : -10);
            label.setAttribute("x", labelX);
            label.setAttribute("y", labelY);
            label.setAttribute("text-anchor", Math.cos(angle) > 0 ? "start" : "end");
            label.textContent = `${bias} (${score.toFixed(1)})`;
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

            return `
                <div class="bias-item">
                    <div class="bias-name">${bias}</div>
                    <div class="bias-score">Score: ${score.toFixed(2)}</div>
                    <div class="bias-explanation">${explanation}</div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHtml;
    }
} 